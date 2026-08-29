import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Filter, Package, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { useDebounced } from '@/hooks/useDebounced';
import { formatMoney } from '@/lib/money';
import { formatQuantity } from '@/lib/format';
import { useCategories, useCategoryAttributes, useProducts } from '../hooks/useCatalog.js';
import { formatAttributeValue } from '../lib/dynamicSchema.js';

/**
 * Listado de productos.
 *
 * Las columnas y los filtros **no están escritos aquí**: se derivan de los
 * atributos que la empresa marcó como visibles en lista o filtrables en su
 * categoría. La misma pantalla muestra «Material» y «Peso» en una joyería, y
 * «Calibre» y «Color» en una ferretería.
 */
export function ProductsPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { tenant } = useSession();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('active');
  const [attributeFilters, setAttributeFilters] = useState({});
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);

  // Se espera a que el usuario deje de escribir: sin esto, cada pulsación lanzaría
  // una consulta y la lista parpadearía con resultados intermedios.
  const debouncedSearch = useDebounced(search, 300);

  const { data: categories = [] } = useCategories();
  const { data: attributeSet } = useCategoryAttributes(categoryId || null);

  const definitions = attributeSet?.attributes ?? [];
  const filterable = definitions.filter((definition) => definition.filterable);
  const listColumns = definitions.filter((definition) => definition.showInList);

  const filters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      categoryId: categoryId || undefined,
      includeDescendants: categoryId ? 'true' : undefined,
      isActive: status === 'all' ? undefined : String(status === 'active'),
      attributes: attributeFilters,
      sort,
      page,
      limit: 25,
    }),
    [debouncedSearch, categoryId, status, attributeFilters, sort, page],
  );

  const { data, isPending, isError, error, refetch, isFetching } = useProducts(filters);

  const products = data?.items ?? [];
  const meta = data?.meta ?? {};
  const canSeeCost = can('products:cost:read');

  /** @param {string} key @param {string} value */
  const setAttributeFilter = (key, value) => {
    setPage(1);
    setAttributeFilters((current) => {
      const next = { ...current };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const resetFilters = () => {
    setSearch('');
    setCategoryId('');
    setStatus('active');
    setAttributeFilters({});
    setPage(1);
  };

  const hasFilters =
    Boolean(search) || Boolean(categoryId) || status !== 'active' || Object.keys(attributeFilters).length > 0;

  const columns = [
    {
      key: 'sku',
      header: 'Código',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.sku}</span>,
    },
    {
      key: 'name',
      header: 'Producto',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          {row.brand && <p className="truncate text-xs text-muted-foreground">{row.brand}</p>}
        </div>
      ),
    },
    // Columnas del rubro: las decide la configuración de la empresa, no este archivo.
    ...listColumns.map((definition) => ({
      key: `attr-${definition.key}`,
      header: definition.label,
      render: (row) => (
        <span className="text-sm">
          {formatAttributeValue(definition, row.attributes?.[definition.key])}
        </span>
      ),
    })),
    {
      key: 'minStock',
      header: 'Mín.',
      numeric: true,
      render: (row) => (
        <span className="text-muted-foreground">{formatQuantity(row.minStock)}</span>
      ),
    },
    {
      key: 'salePrice.amount',
      header: 'Precio',
      numeric: true,
      sortable: true,
      render: (row) => <span className="font-medium">{formatMoney(row.salePrice)}</span>,
    },
    ...(canSeeCost
      ? [
          {
            key: 'margin',
            header: 'Margen',
            numeric: true,
            render: (row) =>
              row.marginBasisPoints === null || row.marginBasisPoints === undefined ? (
                '—'
              ) : (
                <span className={row.sellsBelowCost ? 'font-medium text-destructive' : ''}>
                  {(row.marginBasisPoints / 100).toFixed(1)}%
                </span>
              ),
          },
        ]
      : []),
    {
      key: 'isActive',
      header: 'Estado',
      render: (row) =>
        row.isActive ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="secondary">Inactivo</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground">
            {meta.total !== undefined
              ? `${meta.total} ${meta.total === 1 ? 'producto' : 'productos'} en el catálogo`
              : 'Catálogo de su empresa'}
          </p>
        </div>

        {can('products:create') && (
          <Button asChild>
            <Link to="/productos/nuevo">
              <Plus aria-hidden="true" />
              Nuevo producto
            </Link>
          </Button>
        )}
      </header>

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap gap-3">
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
              placeholder="Buscar por nombre, código, marca o atributo…"
              className="pl-9"
              aria-label="Buscar productos"
            />
          </div>

          <Select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              // Los filtros por atributo pertenecen a la categoría anterior: si no se
              // limpian, el servidor rechazaría la consulta por atributos que la nueva
              // categoría no define.
              setAttributeFilters({});
              setPage(1);
            }}
            className="w-52"
            aria-label="Filtrar por categoría"
          >
            <option value="">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>

          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="w-40"
            aria-label="Filtrar por estado"
          >
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </Select>

          {hasFilters && (
            <Button variant="ghost" onClick={resetFilters}>
              <X aria-hidden="true" />
              Limpiar
            </Button>
          )}
        </div>

        {/* Filtros del rubro: aparecen al elegir categoría, porque los atributos los
            define cada categoría. */}
        {filterable.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t pt-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Filter className="size-3.5" aria-hidden="true" />
              Filtros de {attributeSet?.categoryName}
            </span>

            {filterable.map((definition) =>
              definition.type === 'ENUM' || definition.type === 'MULTI_ENUM' ? (
                <Select
                  key={definition.key}
                  value={attributeFilters[definition.key] ?? ''}
                  onChange={(event) => setAttributeFilter(definition.key, event.target.value)}
                  className="w-44"
                  aria-label={`Filtrar por ${definition.label}`}
                >
                  <option value="">{definition.label}: todos</option>
                  {definition.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  key={definition.key}
                  value={attributeFilters[definition.key] ?? ''}
                  onChange={(event) => setAttributeFilter(definition.key, event.target.value)}
                  placeholder={definition.label}
                  className="w-44"
                  aria-label={`Filtrar por ${definition.label}`}
                />
              ),
            )}
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={products}
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        sort={sort}
        onSortChange={setSort}
        onRowClick={can('products:update') ? (row) => navigate(`/productos/${row.id}`) : undefined}
        emptyTitle={hasFilters ? 'Sin coincidencias' : 'Aún no hay productos'}
        emptyDescription={
          hasFilters
            ? 'Pruebe con otros filtros o límpielos para ver todo el catálogo.'
            : `Registre el primero de ${tenant?.tradeName ?? 'su empresa'} para empezar a controlar el inventario.`
        }
        emptyAction={
          can('products:create') && !hasFilters ? (
            <Button asChild>
              <Link to="/productos/nuevo">
                <Package aria-hidden="true" />
                Registrar producto
              </Link>
            </Button>
          ) : undefined
        }
      />

      {meta.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
          <p className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages}
            {isFetching && ' · actualizando…'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasPrev}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasNext}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
