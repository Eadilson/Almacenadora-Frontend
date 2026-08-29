import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeftRight, Boxes, History, Search, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { useDebounced } from '@/hooks/useDebounced';
import { formatMoney } from '@/lib/money';
import { formatQuantity, formatRelative } from '@/lib/format';
import { useCategories } from '@/features/catalog/hooks/useCatalog.js';
import { StockMovementDialog } from '../components/StockMovementDialog.jsx';
import { useStock, useStockSummary } from '../hooks/useInventory.js';

/**
 * Existencias por sucursal.
 *
 * Es la pantalla que responde la pregunta diaria del negocio: qué hay, qué falta y
 * cuánto vale. Los faltantes se destacan porque son los que cuestan ventas.
 */
export function StockPage() {
  const { can } = usePermission();
  const { user, activeBranchId, setActiveBranch } = useSession();

  const branches = user?.branches ?? [];
  const [branchId, setBranchId] = useState(activeBranchId ?? branches[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [onlyBelow, setOnlyBelow] = useState(false);
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(/** @type {any} */ (null));

  const debouncedSearch = useDebounced(search, 300);
  const { data: categories = [] } = useCategories();

  const filters = useMemo(
    () => ({
      branchId: branchId || undefined,
      categoryId: categoryId || undefined,
      search: debouncedSearch || undefined,
      belowMinimum: onlyBelow || undefined,
      page,
      limit: 25,
    }),
    [branchId, categoryId, debouncedSearch, onlyBelow, page],
  );

  const { data, isPending, isError, error, refetch } = useStock(filters);
  const { data: summary } = useStockSummary(branchId || undefined);

  const rows = data?.items ?? [];
  const meta = data?.meta ?? {};
  const canAdjust = can('stock:adjust');
  const canSeeCost = can('products:cost:read');

  /** @param {string} value */
  const changeBranch = (value) => {
    setBranchId(value);
    setActiveBranch(value);
    setPage(1);
  };

  const columns = [
    {
      key: 'sku',
      header: 'Código',
      render: (row) => <span className="font-mono text-xs">{row.product.sku}</span>,
    },
    {
      key: 'name',
      header: 'Producto',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.product.name}</p>
          {!row.product.isActive && (
            <Badge variant="secondary" className="mt-0.5 text-[10px]">
              Inactivo
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'onHand',
      header: 'Existencia',
      numeric: true,
      render: (row) => (
        <span className={row.belowMinimum ? 'font-semibold text-warning' : 'font-medium'}>
          {formatQuantity(row.onHand)}
        </span>
      ),
    },
    {
      key: 'minStock',
      header: 'Mínimo',
      numeric: true,
      render: (row) => <span className="text-muted-foreground">{formatQuantity(row.minStock)}</span>,
    },
    ...(canSeeCost
      ? [
          {
            key: 'valuation',
            header: 'Valor',
            numeric: true,
            render: (row) => (row.valuation ? formatMoney(row.valuation) : '—'),
          },
        ]
      : []),
    {
      key: 'lastMovementAt',
      header: 'Último movimiento',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.lastMovementAt ? formatRelative(row.lastMovementAt) : 'Sin movimientos'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-px',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Kardex de ${row.product.name}`}>
            <Link to={`/productos/${row.productId}/kardex?branchId=${row.branchId}`}>
              <History aria-hidden="true" />
            </Link>
          </Button>
          {canAdjust && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Mover existencias de ${row.product.name}`}
              onClick={() =>
                setTarget({
                  product: row.product,
                  branchId: row.branchId,
                  onHand: row.onHand,
                  hasMovements: Boolean(row.lastMovementAt),
                })
              }
            >
              <ArrowLeftRight aria-hidden="true" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Existencias</h1>
        <p className="text-sm text-muted-foreground">
          Qué hay disponible en cada sucursal y qué está por debajo del mínimo.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Boxes className="size-4" aria-hidden="true" />
              Unidades en existencia
            </CardDescription>
            <CardTitle className="text-2xl tabular">
              {summary ? formatQuantity(summary.totalUnits) : '—'}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className={summary?.belowMinimum ? 'border-warning/50' : undefined}>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <TrendingDown className="size-4" aria-hidden="true" />
              Bajo el mínimo
            </CardDescription>
            <CardTitle className="text-2xl tabular">{summary?.belowMinimum ?? '—'}</CardTitle>
          </CardHeader>
          {Boolean(summary?.belowMinimum) && (
            <CardContent className="pt-0">
              <Button variant="outline" size="sm" onClick={() => setOnlyBelow(true)}>
                <AlertTriangle aria-hidden="true" />
                Ver cuáles
              </Button>
            </CardContent>
          )}
        </Card>

        {canSeeCost && (
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Valor del inventario</CardDescription>
              <CardTitle className="text-2xl">
                {summary?.valuation ? formatMoney(summary.valuation) : '—'}
              </CardTitle>
            </CardHeader>
          </Card>
        )}
      </div>

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
            placeholder="Buscar por nombre o código…"
            className="pl-9"
            aria-label="Buscar productos"
          />
        </div>

        {branches.length > 1 && (
          <Select
            value={branchId}
            onChange={(event) => changeBranch(event.target.value)}
            className="w-48"
            aria-label="Sucursal"
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        )}

        <Select
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setPage(1);
          }}
          className="w-48"
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>

        <Button
          variant={onlyBelow ? 'default' : 'outline'}
          onClick={() => {
            setOnlyBelow((current) => !current);
            setPage(1);
          }}
        >
          <AlertTriangle aria-hidden="true" />
          Solo faltantes
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        rowKey={(row) => row.id}
        emptyTitle={onlyBelow ? 'Ningún producto bajo el mínimo' : 'Sin existencias registradas'}
        emptyDescription={
          onlyBelow
            ? 'Todo el inventario está por encima de su umbral.'
            : 'Registre el saldo inicial de sus productos para empezar a controlar el inventario.'
        }
      />

      {meta.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
          <p className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages} · {meta.total} productos
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

      <StockMovementDialog
        open={Boolean(target)}
        onOpenChange={(open) => !open && setTarget(null)}
        product={target?.product ?? null}
        branchId={target?.branchId ?? branchId}
        currentStock={target?.onHand}
        hasMovements={target?.hasMovements ?? true}
      />
    </div>
  );
}
