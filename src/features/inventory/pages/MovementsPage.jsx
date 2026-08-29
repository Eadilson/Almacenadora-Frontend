import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { formatMoney } from '@/lib/money';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useMovements } from '../hooks/useInventory.js';

/** Tipos que el usuario puede filtrar, con nombres del negocio. */
const TYPES = [
  { value: '', label: 'Todos los movimientos' },
  { value: 'OPENING_BALANCE', label: 'Saldo inicial' },
  { value: 'PURCHASE', label: 'Compras' },
  { value: 'SALE', label: 'Ventas' },
  { value: 'ADJUSTMENT_IN', label: 'Ajustes de entrada' },
  { value: 'ADJUSTMENT_OUT', label: 'Ajustes de salida' },
  { value: 'LOSS', label: 'Pérdidas' },
  { value: 'SALE_RETURN', label: 'Devoluciones de cliente' },
  { value: 'PURCHASE_RETURN', label: 'Devoluciones a proveedor' },
];

/**
 * Historial de movimientos de toda la empresa.
 *
 * Responde a «¿quién tocó el inventario y por qué?». Junto con la bitácora de
 * auditoría, es lo que permite investigar un faltante en lugar de suponer.
 */
export function MovementsPage() {
  const { can } = usePermission();
  const { user, activeBranchId } = useSession();

  const branches = user?.branches ?? [];
  const [branchId, setBranchId] = useState(activeBranchId ?? '');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({
      branchId: branchId || undefined,
      type: type || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      limit: 25,
    }),
    [branchId, type, from, to, page],
  );

  const { data, isPending, isError, error, refetch } = useMovements(filters);
  const rows = data?.items ?? [];
  const meta = data?.meta ?? {};
  const canSeeCost = can('products:cost:read');

  const columns = [
    {
      key: 'occurredAt',
      header: 'Fecha',
      render: (row) => <span className="text-sm">{formatDateTime(row.occurredAt)}</span>,
    },
    {
      key: 'product',
      header: 'Producto',
      render: (row) =>
        row.product ? (
          <Link
            to={`/productos/${row.product.id}/kardex`}
            className="min-w-0 hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="truncate font-medium">{row.product.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{row.product.sku}</p>
          </Link>
        ) : (
          '—'
        ),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.direction === 'IN' ? (
            <ArrowDownLeft className="size-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <ArrowUpRight className="size-4 shrink-0 text-destructive" aria-hidden="true" />
          )}
          <span className="text-sm">{row.typeLabel}</span>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Motivo',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.reason ?? row.reference?.docNumber ?? '—'}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      numeric: true,
      render: (row) => (
        <span className={row.direction === 'IN' ? 'text-success' : 'text-destructive'}>
          {row.direction === 'IN' ? '+' : '−'}
          {formatQuantity(row.quantity)}
        </span>
      ),
    },
    {
      key: 'balanceAfter',
      header: 'Saldo',
      numeric: true,
      render: (row) => formatQuantity(row.balanceAfter),
    },
    ...(canSeeCost
      ? [
          {
            key: 'totalCost',
            header: 'Valor',
            numeric: true,
            render: (row) => (row.totalCost ? formatMoney(row.totalCost) : '—'),
          },
        ]
      : []),
    {
      key: 'registeredBy',
      header: 'Registrado por',
      render: (row) =>
        row.registeredBy ? (
          <Badge variant="secondary">{row.registeredBy.name}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Sistema</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
        <p className="text-sm text-muted-foreground">
          Todo cambio de existencias, con su motivo y su responsable.
        </p>
      </header>

      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
        <Select
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setPage(1);
          }}
          className="w-56"
          aria-label="Tipo de movimiento"
        >
          {TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {branches.length > 1 && (
          <Select
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value);
              setPage(1);
            }}
            className="w-48"
            aria-label="Sucursal"
          >
            <option value="">Todas las sucursales</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        )}

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            className="w-40"
            aria-label="Desde"
          />
          <span className="text-sm text-muted-foreground">a</span>
          <Input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            className="w-40"
            aria-label="Hasta"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        rowKey={(row) => row.id}
        emptyTitle="Sin movimientos"
        emptyDescription="No hay movimientos de inventario con los filtros aplicados."
      />

      {meta.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
          <p className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages} · {meta.total} movimientos
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
