import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeftRight, Boxes, History, Search, TrendingDown, Wallet } from 'lucide-react';
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
  const { user, activeBranchId } = useSession();

  const branches = user?.branches ?? [];
  const branchId = activeBranchId ?? branches[0]?.id ?? '';
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
      <PageHeader
        title="Existencias"
        icon={Boxes}
        description="Qué hay disponible en cada sucursal y qué está por debajo del mínimo."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Unidades en existencia"
          value={summary ? formatQuantity(summary.totalUnits) : '—'}
          icon={Boxes}
          featured
          delay={0}
        />

        <StatCard
          label="Bajo el mínimo"
          value={summary?.belowMinimum ?? '—'}
          icon={TrendingDown}
          tone={summary?.belowMinimum ? 'warning' : 'default'}
          delay={40}
        >
          {Boolean(summary?.belowMinimum) && (
            <Button variant="outline" size="sm" onClick={() => setOnlyBelow(true)}>
              <AlertTriangle aria-hidden="true" />
              Ver cuáles
            </Button>
          )}
        </StatCard>

        {canSeeCost && (
          <StatCard
            label="Valor del inventario"
            value={summary?.valuation ? formatMoney(summary.valuation) : '—'}
            icon={Wallet}
            delay={80}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border-[1.5px] border-black/12 bg-card p-4 dark:border-white/15">
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

      <Pagination meta={meta} onPageChange={setPage} itemLabel="productos" />

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
