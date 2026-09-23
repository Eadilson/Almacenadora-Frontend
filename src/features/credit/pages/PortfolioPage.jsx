import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard, HandCoins, Search, Users, Wallet } from 'lucide-react';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { StatCard } from '@/components/ui/stat-card.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { Pagination } from '@/components/data/Pagination.jsx';
import { AgingBars } from '@/components/charts/AgingBars.jsx';
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
      header: 'Vencimiento',
      // Con la cuenta en mora, `oldestDueDate` es cuándo empezó a deberse; al
      // día, es su próximo vencimiento. Es el mismo campo leído en los dos
      // sentidos, no un dato nuevo: aquí solo se distingue «ya venció» de
      // «está por vencer» para que un pago que se atrasa dentro de unos días
      // no se descubra hasta que ya es mora.
      render: (/** @type {any} */ row) => {
        if (!row.oldestDueDate) return <span className="text-muted-foreground">—</span>;
        if (row.status === 'OVERDUE') {
          return <span className="text-destructive">Venció {formatDate(row.oldestDueDate)}</span>;
        }

        const daysLeft = Math.ceil(
          (new Date(row.oldestDueDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
        );
        if (row.status === 'CURRENT' && daysLeft >= 0 && daysLeft <= 7) {
          return (
            <span className="text-warning">
              Vence en {daysLeft === 0 ? 'hoy' : `${daysLeft} día${daysLeft === 1 ? '' : 's'}`}
            </span>
          );
        }
        return formatDate(row.oldestDueDate);
      },
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
      <PageHeader
        title="Cartera"
        icon={CreditCard}
        description="Lo que está pendiente de cobro, ordenado por lo que más urge."
      />

      {aging && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Por cobrar" value={formatMoney(aging.balance)} icon={Wallet} featured delay={0} />
            <StatCard
              label="En mora"
              value={formatMoney(aging.overdue)}
              icon={AlertTriangle}
              tone={aging.overdue.amount > 0 ? 'destructive' : 'default'}
              delay={40}
            />
            <StatCard
              label="Clientes con deuda"
              value={String(aging.accounts)}
              hint={aging.overdueAccounts > 0 ? `${aging.overdueAccounts} en mora` : undefined}
              icon={Users}
              tone={aging.overdueAccounts > 0 ? 'warning' : 'default'}
              delay={80}
            />
            <StatCard
              label="Saldo a favor de clientes"
              value={formatMoney(aging.unappliedCredit)}
              icon={HandCoins}
              delay={120}
            />
          </section>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Antigüedad de saldos</CardTitle>
              <CardDescription>
                Cuánto lleva pendiente cada peso, contando desde su vencimiento.
              </CardDescription>
            </CardHeader>
            <div className="px-6 pb-6">
              <AgingBars buckets={aging.buckets} total={aging.balance.amount} />
            </div>
          </Card>
        </>
      )}

      <div className="flex flex-wrap gap-3 rounded-xl border-[1.5px] border-black/12 bg-card p-4 dark:border-white/15">
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

      <Pagination meta={meta} onPageChange={setPage} itemLabel="cuentas" />

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wallet className="size-3.5" aria-hidden="true" />
        Toque una fila para ver el estado de cuenta y registrar un abono.
      </p>
    </div>
  );
}
