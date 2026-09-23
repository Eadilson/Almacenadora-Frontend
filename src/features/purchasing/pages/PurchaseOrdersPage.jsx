import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileText, PackageCheck, Plus, Search, Truck, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { Pagination } from '@/components/data/Pagination.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { useListState } from '@/hooks/useListState';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format';
import { usePurchaseOrders, useSupplier } from '../hooks/usePurchasing.js';

/** Color del estado: el rojo se reserva para lo que exige atención. */
const STATUS_VARIANTS = {
  DRAFT: 'outline',
  CONFIRMED: 'default',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'secondary',
  CLOSED: 'secondary',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'DRAFT', label: 'Borradores' },
  { value: 'CONFIRMED', label: 'Confirmadas' },
  { value: 'PARTIALLY_RECEIVED', label: 'Recibidas en parte' },
  { value: 'RECEIVED', label: 'Recibidas' },
  { value: 'CANCELLED', label: 'Canceladas' },
  { value: 'CLOSED', label: 'Cerradas' },
];

/**
 * Órdenes de compra.
 *
 * El abastecimiento tiene un orden: se crea, se confirma, se recibe. Antes de la
 * tabla se muestra en qué etapa hay órdenes esperando algo de alguien —no es un
 * resumen decorativo, cada número lleva directo al filtro que lo explica.
 */
export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { activeBranchId, user } = useSession();
  const branchId = activeBranchId ?? user?.branches?.[0]?.id;
  // Se llega aquí desde la ficha de un proveedor («Ver todas» sus órdenes),
  // así que el filtro también puede venir de la URL.
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierId = searchParams.get('proveedorId');

  const { filters: listFilters, query, setFilter, setPage } = useListState({
    search: '',
    status: '',
  });

  const { data: filteredSupplier } = useSupplier(supplierId);
  const filters = useMemo(
    () => ({
      ...query,
      branchId,
      supplierId: supplierId || undefined,
    }),
    [branchId, query, supplierId],
  );

  const { data, isPending, isError, error, refetch } = usePurchaseOrders(filters);
  const rows = data?.items ?? [];
  const meta = data?.meta ?? {};

  // Cuántas órdenes esperan la siguiente acción, por etapa. Es el mismo total
  // exacto que ya usa la paginación (`meta.total` de esa misma consulta filtrada
  // por estado), pedido una vez por etapa en vez de una vez por fila: no es un
  // conteo aproximado ni un endpoint nuevo, es la cuenta real reutilizada como
  // resumen en lugar de como pie de página.
  const { data: draftData } = usePurchaseOrders(
    { status: 'DRAFT', branchId, limit: 1 },
    { enabled: !supplierId },
  );
  const { data: confirmedData } = usePurchaseOrders(
    { status: 'CONFIRMED', branchId, limit: 1 },
    { enabled: !supplierId },
  );
  const { data: partialData } = usePurchaseOrders(
    { status: 'PARTIALLY_RECEIVED', branchId, limit: 1 },
    { enabled: !supplierId },
  );
  const stages = [
    {
      status: 'DRAFT',
      icon: CheckCircle2,
      total: draftData?.meta?.total ?? 0,
      label: (n) => `${n} ${n === 1 ? 'en borrador' : 'en borrador'}, por confirmar`,
    },
    {
      status: 'CONFIRMED',
      icon: Truck,
      total: confirmedData?.meta?.total ?? 0,
      label: (n) => `${n} ${n === 1 ? 'confirmada' : 'confirmadas'}, esperando mercancía`,
    },
    {
      status: 'PARTIALLY_RECEIVED',
      icon: PackageCheck,
      total: partialData?.meta?.total ?? 0,
      label: (n) => `${n} con recepción pendiente`,
    },
  ].filter((stage) => stage.total > 0);

  const columns = [
    {
      key: 'number',
      header: 'Orden',
      render: (row) => <span className="font-mono text-xs">{row.number}</span>,
    },
    {
      key: 'supplier',
      header: 'Proveedor',
      render: (row) => <span className="font-medium">{row.supplier.name}</span>,
    },
    {
      key: 'issuedAt',
      header: 'Fecha',
      render: (row) => <span className="text-sm">{formatDate(row.issuedAt)}</span>,
    },
    {
      key: 'lines',
      header: 'Productos',
      numeric: true,
      render: (row) => <span className="text-muted-foreground">{row.lines.length}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      numeric: true,
      render: (row) => <span className="font-medium">{formatMoney(row.total)}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <Badge variant={STATUS_VARIANTS[row.status] ?? 'secondary'}>{row.statusLabel}</Badge>
          {row.pendingLines > 0 && row.isReceivable && (
            <span className="text-[11px] text-muted-foreground">
              {row.pendingLines} {row.pendingLines === 1 ? 'línea pendiente' : 'líneas pendientes'}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compras"
        icon={FileText}
        description="Órdenes a proveedores. Al recibir la mercancía entra al inventario y el costo se recalcula solo."
      >
        {can('purchases:create') && (
          <Button asChild>
            <Link to="/compras/nueva">
              <Plus aria-hidden="true" />
              Nueva orden
            </Link>
          </Button>
        )}
      </PageHeader>

      {supplierId && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-1">
            Proveedor: {filteredSupplier?.name ?? '…'}
            <button
              type="button"
              onClick={() => {
                setSearchParams((params) => {
                  params.delete('proveedorId');
                  return params;
                });
                setPage(1);
              }}
              className="rounded-full p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
              aria-label="Quitar filtro de proveedor"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </Badge>
        </div>
      )}

      {/* Las etapas son globales, no del proveedor filtrado: mezclar ambos
          contextos sería el mismo error que las StatCards de Ventas. */}
      {stages.length > 0 && !supplierId && (
        <div className="flex flex-wrap gap-3">
          {stages.map((stage) => (
            <button
              key={stage.status}
              type="button"
              onClick={() => {
                setFilter('status', listFilters.status === stage.status ? '' : stage.status);
              }}
              className={`flex items-center gap-2 rounded-xl border-[1.5px] px-4 py-2.5 text-sm font-medium transition-colors ${
                listFilters.status === stage.status
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-black/12 bg-card hover:bg-accent dark:border-white/15'
              }`}
            >
              <stage.icon className="size-4" aria-hidden="true" />
              {stage.label(stage.total)}
            </button>
          ))}
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
            placeholder="Buscar por número, proveedor o factura…"
            className="pl-9"
            aria-label="Buscar órdenes"
          />
        </div>

        <Select
          value={listFilters.status}
          onChange={(event) => setFilter('status', event.target.value)}
          className="w-52"
          aria-label="Estado"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        onRowClick={(row) => navigate(`/compras/${row.id}`)}
        emptyTitle={listFilters.status || listFilters.search ? 'Sin coincidencias' : 'Aún no hay compras'}
        emptyDescription={
          listFilters.status || listFilters.search
            ? 'Pruebe con otros filtros.'
            : 'Registre su primera orden para que la mercancía entre al inventario con su costo real.'
        }
        emptyAction={
          can('purchases:create') && !listFilters.status && !listFilters.search ? (
            <Button asChild>
              <Link to="/compras/nueva">
                <FileText aria-hidden="true" />
                Crear orden de compra
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Pagination meta={meta} onPageChange={setPage} itemLabel="órdenes" />
    </div>
  );
}
