import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Banknote, Receipt, Search, ShoppingCart, TrendingUp, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { StatCard } from '@/components/ui/stat-card.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { Pagination } from '@/components/data/Pagination.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { useListState } from '@/hooks/useListState';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/format';
import { useCustomer, useSalesList, useSalesSummary } from '../hooks/useSales.js';

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
  // Se llega aquí desde la ficha de un cliente («Ver todas» sus compras),
  // así que el filtro también puede venir de la URL, no solo de un control
  // en esta pantalla.
  const [searchParams, setSearchParams] = useSearchParams();
  const customerId = searchParams.get('clienteId');

  const branchId = activeBranchId ?? user?.branches?.[0]?.id;
  const { filters: listFilters, query, setFilter, setPage } = useListState({
    search: '',
    status: '',
    type: '',
  });

  const canSeeProfit = can('products:cost:read');
  const { data: filteredCustomer } = useCustomer(customerId);

  const filters = useMemo(
    () => ({
      ...query,
      branchId,
      customerId: customerId || undefined,
    }),
    [branchId, query, customerId],
  );

  const { data, isPending, isError, error, refetch } = useSalesList(filters);
  const { data: summary } = useSalesSummary(
    { branchId },
    { enabled: !customerId },
  );

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
      <PageHeader
        title="Ventas"
        icon={Receipt}
        description="Cada venta descuenta inventario y emite su factura."
      >
        {can('sales:create') && (
          <Button asChild>
            <Link to="/ventas/nueva">
              <ShoppingCart aria-hidden="true" />
              Nueva venta
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* El resumen es del día y de la sucursal, no del cliente: mostrarlo
          filtrado por cliente mezclaría dos contextos distintos (una foto de
          hoy sobre un historial que no tiene límite de fecha). Con el filtro
          activo, esta pantalla deja de ser el panel del día y pasa a ser el
          historial de una relación comercial — el mismo motivo por el que
          Movimientos y Abonos tampoco llevan StatCards. */}
      {summary && !customerId && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total cobrado"
            value={formatMoney(summary.total)}
            icon={Banknote}
            featured
            delay={0}
          />
          <StatCard label="Ventas de hoy" value={String(summary.count)} icon={Receipt} delay={40} />
          <StatCard
            label="Efectivo y tarjeta"
            value={formatMoney(summary.cash)}
            icon={Wallet}
            delay={80}
          />
          {canSeeProfit && summary.grossProfit && (
            <StatCard
              label="Utilidad del día"
              value={formatMoney(summary.grossProfit)}
              icon={TrendingUp}
              delay={120}
            />
          )}
        </div>
      )}

      {customerId && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-1">
            Cliente: {filteredCustomer?.name ?? '…'}
            <button
              type="button"
              onClick={() => {
                setSearchParams((params) => {
                  params.delete('clienteId');
                  return params;
                });
                setPage(1);
              }}
              className="rounded-full p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
              aria-label="Quitar filtro de cliente"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </Badge>
        </div>
      )}

      <div className="flex flex-wrap gap-3 rounded-xl border-[1.5px] border-black/12 bg-card p-4 dark:border-white/15">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={listFilters.search}
            onChange={(event) => setFilter('search', event.target.value)}
            placeholder="Buscar por número, factura o cliente…"
            className="pl-9"
            aria-label="Buscar ventas"
          />
        </div>

        <Select
          value={listFilters.status}
          onChange={(event) => setFilter('status', event.target.value)}
          className="w-44"
          aria-label="Estado"
        >
          <option value="">Todos los estados</option>
          <option value="CONFIRMED">Confirmadas</option>
          <option value="VOIDED">Anuladas</option>
        </Select>

        <Select
          value={listFilters.type}
          onChange={(event) => setFilter('type', event.target.value)}
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

      <Pagination meta={meta} onPageChange={setPage} itemLabel="ventas" />
    </div>
  );
}
