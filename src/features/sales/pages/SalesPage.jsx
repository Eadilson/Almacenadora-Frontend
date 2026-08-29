import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Receipt, Search, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { useDebounced } from '@/hooks/useDebounced';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/format';
import { useSalesList, useSalesSummary } from '../hooks/useSales.js';

const STATUS_VARIANTS = {
  CONFIRMED: 'success',
  VOIDED: 'destructive',
  DRAFT: 'outline',
  PARTIALLY_RETURNED: 'warning',
  RETURNED: 'secondary',
};

const TYPE_VARIANTS = { CASH: 'secondary', CREDIT: 'warning', MIXED: 'outline' };

/**
 * Listado de ventas y resumen del día.
 */
export function SalesPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { user, activeBranchId } = useSession();

  const branches = user?.branches ?? [];
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search, 300);
  const canSeeProfit = can('products:cost:read');

  const filters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: status || undefined,
      type: type || undefined,
      page,
      limit: 25,
    }),
    [debouncedSearch, status, type, page],
  );

  const { data, isPending, isError, error, refetch } = useSalesList(filters);
  const { data: summary } = useSalesSummary({ branchId: activeBranchId ?? branches[0]?.id });

  const rows = data?.items ?? [];
  const meta = data?.meta ?? {};

  const columns = [
    {
      key: 'number',
      header: 'Venta',
      render: (row) => (
        <div>
          <p className="font-mono text-xs">{row.number}</p>
          {row.invoiceNumber && (
            <p className="font-mono text-[11px] text-muted-foreground">{row.invoiceNumber}</p>
          )}
        </div>
      ),
    },
    {
      key: 'issuedAt',
      header: 'Fecha',
      render: (row) => <span className="text-sm">{formatDateTime(row.issuedAt)}</span>,
    },
    {
      key: 'customer',
      header: 'Cliente',
      render: (row) => (
        <span className={row.customer?.name ? '' : 'text-muted-foreground'}>
          {row.customer?.name ?? 'Consumidor final'}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Pago',
      render: (row) => <Badge variant={TYPE_VARIANTS[row.type] ?? 'secondary'}>{row.typeLabel}</Badge>,
    },
    {
      key: 'total',
      header: 'Total',
      numeric: true,
      render: (row) => <span className="font-medium">{formatMoney(row.total)}</span>,
    },
    ...(canSeeProfit
      ? [
          {
            key: 'grossProfit',
            header: 'Utilidad',
            numeric: true,
            render: (row) => (row.grossProfit ? formatMoney(row.grossProfit) : '—'),
          },
        ]
      : []),
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'secondary'}>{row.statusLabel}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
          <p className="text-sm text-muted-foreground">
            Cada venta descuenta inventario y emite su factura.
          </p>
        </div>

        {can('sales:create') && (
          <Button asChild>
            <Link to="/ventas/nueva">
              <ShoppingCart aria-hidden="true" />
              Nueva venta
            </Link>
          </Button>
        )}
      </header>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Ventas de hoy</CardDescription>
              <CardTitle className="text-2xl tabular">{summary.count}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total cobrado</CardDescription>
              <CardTitle className="text-2xl">{formatMoney(summary.total)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Efectivo y tarjeta</CardDescription>
              <CardTitle className="text-2xl">{formatMoney(summary.cash)}</CardTitle>
            </CardHeader>
          </Card>
          {canSeeProfit && summary.grossProfit && (
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Utilidad del día</CardDescription>
                <CardTitle className="text-2xl">{formatMoney(summary.grossProfit)}</CardTitle>
              </CardHeader>
            </Card>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por número, factura o cliente…"
            className="pl-9"
            aria-label="Buscar ventas"
          />
        </div>

        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="w-44"
          aria-label="Estado"
        >
          <option value="">Todos los estados</option>
          <option value="CONFIRMED">Confirmadas</option>
          <option value="VOIDED">Anuladas</option>
        </Select>

        <Select
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setPage(1);
          }}
          className="w-40"
          aria-label="Forma de pago"
        >
          <option value="">Todo pago</option>
          <option value="CASH">Contado</option>
          <option value="CREDIT">Crédito</option>
          <option value="MIXED">Mixta</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        onRowClick={(row) => navigate(`/ventas/${row.id}`)}
        emptyTitle="Sin ventas"
        emptyDescription="Las ventas que registre en el punto de venta aparecerán aquí."
        emptyAction={
          can('sales:create') ? (
            <Button asChild>
              <Link to="/ventas/nueva">
                <Receipt aria-hidden="true" />
                Registrar venta
              </Link>
            </Button>
          ) : undefined
        }
      />

      {meta.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
          <p className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages} · {meta.total} ventas
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!meta.hasPrev} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
