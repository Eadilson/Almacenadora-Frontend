import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useDebounced } from '@/hooks/useDebounced';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format';
import { usePurchaseOrders } from '../hooks/usePurchasing.js';

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
 */
export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { can } = usePermission();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search, 300);
  const filters = useMemo(
    () => ({ search: debouncedSearch || undefined, status: status || undefined, page, limit: 25 }),
    [debouncedSearch, status, page],
  );

  const { data, isPending, isError, error, refetch } = usePurchaseOrders(filters);
  const rows = data?.items ?? [];
  const meta = data?.meta ?? {};

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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Compras</h1>
          <p className="text-sm text-muted-foreground">
            Órdenes a proveedores. Al recibir la mercancía entra al inventario y el costo se
            recalcula solo.
          </p>
        </div>

        {can('purchases:create') && (
          <Button asChild>
            <Link to="/compras/nueva">
              <Plus aria-hidden="true" />
              Nueva orden
            </Link>
          </Button>
        )}
      </header>

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
            placeholder="Buscar por número o proveedor…"
            className="pl-9"
            aria-label="Buscar órdenes"
          />
        </div>

        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
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
        emptyTitle={status || search ? 'Sin coincidencias' : 'Aún no hay compras'}
        emptyDescription={
          status || search
            ? 'Pruebe con otros filtros.'
            : 'Registre su primera orden para que la mercancía entre al inventario con su costo real.'
        }
        emptyAction={
          can('purchases:create') && !status && !search ? (
            <Button asChild>
              <Link to="/compras/nueva">
                <FileText aria-hidden="true" />
                Crear orden de compra
              </Link>
            </Button>
          ) : undefined
        }
      />

      {meta.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
          <p className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages} · {meta.total} órdenes
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
