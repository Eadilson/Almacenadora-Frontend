import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Search, Wallet } from 'lucide-react';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { useDebounced } from '@/hooks/useDebounced';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format';
import { useAging, usePortfolio } from '../hooks/useCredit.js';

const STATUS_VARIANTS = {
  CURRENT: 'success',
  OVERDUE: 'destructive',
  BLOCKED: 'warning',
  SETTLED: 'secondary',
};

/**
 * Cartera de clientes.
 *
 * Ordena por lo que más urge cobrar: primero la mora, luego el saldo. La pregunta
 * que un cobrador se hace al abrir esta pantalla es «¿a quién llamo hoy?», y la
 * respuesta debe estar en la primera fila.
 */
export function PortfolioPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search, 300);

  const filters = useMemo(
    () => ({
      status: status || undefined,
      onlyOverdue: onlyOverdue || undefined,
      page,
      limit: 25,
    }),
    [status, onlyOverdue, page],
  );

  const { data, isPending, isError, error, refetch } = usePortfolio(filters);
  const { data: aging } = useAging();

  // El buscador filtra en el cliente sobre la página cargada: la cartera se
  // consulta por cuenta y el servidor no indexa por nombre de cliente. Con
  // veinticinco filas es instantáneo y evita una consulta cruzada por cada tecla.
  const rows = useMemo(() => {
    const items = data?.items ?? [];
    if (!debouncedSearch) return items;

    const needle = debouncedSearch.toLowerCase();
    return items.filter((/** @type {any} */ row) =>
      [row.customer?.name, row.customer?.code, row.customer?.taxId]
        .filter(Boolean)
        .some((/** @type {string} */ value) => value.toLowerCase().includes(needle)),
    );
  }, [data, debouncedSearch]);

  const meta = data?.meta ?? {};

  const columns = [
    {
      key: 'customer',
      header: 'Cliente',
      render: (/** @type {any} */ row) => (
        <div>
          <p className="font-medium">{row.customer?.name ?? 'Cliente eliminado'}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.customer?.code}</p>
        </div>
      ),
    },
    {
      key: 'balance',
      header: 'Debe',
      numeric: true,
      render: (/** @type {any} */ row) => (
        <span className="font-medium">{formatMoney(row.balance)}</span>
      ),
    },
    {
      key: 'overdueAmount',
      header: 'En mora',
      numeric: true,
      render: (/** @type {any} */ row) =>
        row.overdueAmount.amount > 0 ? (
          <span className="font-medium text-destructive">{formatMoney(row.overdueAmount)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'oldestDueDate',
      header: 'Vencido desde',
      render: (/** @type {any} */ row) =>
        row.oldestDueDate ? (
          formatDate(row.oldestDueDate)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'availableCredit',
      header: 'Disponible',
      numeric: true,
      render: (/** @type {any} */ row) => (
        <span className="text-muted-foreground">{formatMoney(row.availableCredit)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (/** @type {any} */ row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'secondary'}>{row.statusLabel}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Cartera</h1>
        <p className="text-sm text-muted-foreground">
          Lo que está pendiente de cobro, ordenado por lo que más urge.
        </p>
      </header>

      {aging && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Por cobrar</CardDescription>
                <CardTitle className="text-2xl">{formatMoney(aging.balance)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>En mora</CardDescription>
                <CardTitle
                  className={`text-2xl ${aging.overdue.amount > 0 ? 'text-destructive' : ''}`}
                >
                  {formatMoney(aging.overdue)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Clientes con deuda</CardDescription>
                <CardTitle className="tabular text-2xl">
                  {aging.accounts}
                  {aging.overdueAccounts > 0 && (
                    <span className="ml-2 text-sm font-normal text-destructive">
                      {aging.overdueAccounts} en mora
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Saldo a favor de clientes</CardDescription>
                <CardTitle className="text-2xl">{formatMoney(aging.unappliedCredit)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Antigüedad de saldos</CardTitle>
              <CardDescription>
                Cuánto lleva pendiente cada peso, contando desde su vencimiento.
              </CardDescription>
            </CardHeader>
            <div className="scroll-x px-6 pb-6">
              <div className="flex min-w-[36rem] gap-3">
                {aging.buckets.map((/** @type {any} */ bucket) => {
                  const share =
                    aging.balance.amount > 0
                      ? Math.round((bucket.amount.amount / aging.balance.amount) * 100)
                      : 0;

                  return (
                    <div key={bucket.key} className="flex-1 space-y-2">
                      <p className="text-xs text-muted-foreground">{bucket.label}</p>
                      <p className="font-medium tabular">{formatMoney(bucket.amount)}</p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${
                            bucket.key === 'current' ? 'bg-success' : 'bg-destructive'
                          }`}
                          style={{ width: `${share}%` }}
                        />
                      </div>
                      <p className="text-xs tabular text-muted-foreground">{share}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </>
      )}

      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar cliente en esta página…"
            className="pl-9"
            aria-label="Buscar en la cartera"
          />
        </div>

        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="w-44"
          aria-label="Estado de la cuenta"
        >
          <option value="">Todos los estados</option>
          <option value="CURRENT">Al día</option>
          <option value="OVERDUE">En mora</option>
          <option value="BLOCKED">Bloqueadas</option>
          <option value="SETTLED">Saldadas</option>
        </Select>

        <Button
          variant={onlyOverdue ? 'default' : 'outline'}
          onClick={() => {
            setOnlyOverdue((value) => !value);
            setPage(1);
          }}
        >
          <AlertTriangle aria-hidden="true" />
          Solo con mora
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        onRowClick={(/** @type {any} */ row) => navigate(`/creditos/${row.customerId}`)}
        emptyTitle={debouncedSearch ? 'Sin coincidencias' : 'Nadie debe nada'}
        emptyDescription={
          debouncedSearch
            ? 'Ningún cliente de esta página coincide con la búsqueda.'
            : 'Las ventas al crédito aparecerán aquí en cuanto se registren.'
        }
      />

      {meta.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
          <p className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages} · {meta.total} cuentas
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasPrev}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasNext}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente
            </Button>
          </div>
        </nav>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wallet className="size-3.5" aria-hidden="true" />
        Toque una fila para ver el estado de cuenta y registrar un abono.
      </p>
    </div>
  );
}
