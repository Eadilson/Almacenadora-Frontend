import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { TableSkeleton } from '@/components/ui/skeleton.jsx';
import { EmptyState, ErrorState } from '@/components/feedback/states.jsx';
import { cn } from '@/lib/utils';

/**
 * Tabla de datos genérica.
 *
 * Reúne en un solo componente lo que toda pantalla de listado necesita: carga,
 * vacío, error, ordenamiento y alineación numérica. Sin esto, cada módulo
 * reimplementa los mismos cuatro estados y alguno se olvida de uno.
 *
 * El ordenamiento y la paginación son **controlados**: los decide el servidor. La
 * tabla solo informa de la intención del usuario, porque ordenar en el cliente solo
 * ordenaría la página visible y daría una impresión falsa del conjunto.
 *
 * @typedef {object} Column
 * @property {string} key Identificador; coincide con el campo que acepta la API en `sort`.
 * @property {string} header
 * @property {(row: any) => React.ReactNode} [render] Contenido de la celda.
 * @property {boolean} [numeric] Alinea a la derecha con dígitos tabulares.
 * @property {boolean} [sortable]
 * @property {string} [className]
 *
 * @param {object} props
 * @param {Column[]} props.columns
 * @param {any[]} [props.rows]
 * @param {boolean} [props.isPending]
 * @param {boolean} [props.isError]
 * @param {unknown} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {string} [props.sort] Campo activo, con `-` para descendente.
 * @param {(sort: string) => void} [props.onSortChange]
 * @param {(row: any) => void} [props.onRowClick]
 * @param {(row: any) => string} [props.rowKey]
 * @param {React.ReactNode} [props.emptyAction]
 * @param {string} [props.emptyTitle]
 * @param {string} [props.emptyDescription]
 */
export function DataTable({
  columns,
  rows = [],
  isPending = false,
  isError = false,
  error = null,
  onRetry,
  sort = '',
  onSortChange,
  onRowClick,
  rowKey = (row) => row.id,
  emptyAction,
  emptyTitle = 'Sin resultados',
  emptyDescription = 'No hay datos que coincidan con los filtros aplicados.',
}) {
  if (isPending) return <TableSkeleton columns={columns.length} />;
  if (isError) return <ErrorState error={/** @type {any} */ (error)} onRetry={onRetry} />;
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  const activeField = sort.startsWith('-') ? sort.slice(1) : sort;
  const descending = sort.startsWith('-');

  /** @param {Column} column @param {any} row */
  const renderCell = (column, row) => column.render ? column.render(row) : (row[column.key] ?? '—');

  /** @param {{ target: EventTarget|null, currentTarget: EventTarget|null }} event */
  const startsFromNestedAction = (event) => {
    if (!(event.target instanceof Element)) return false;

    const action = event.target.closest(
      'a,button,input,select,textarea,[role="button"],[role="link"]',
    );
    return Boolean(action && action !== event.currentTarget);
  };

  /** @param {string} key */
  const toggleSort = (key) => {
    if (!onSortChange) return;
    // Primer clic ascendente, segundo descendente: es el orden que la gente espera.
    onSortChange(activeField === key && !descending ? `-${key}` : key);
  };

  /** @param {React.MouseEvent} event @param {any} row */
  const openRow = (event, row) => {
    if (!onRowClick || startsFromNestedAction(event)) return;
    onRowClick(row);
  };

  /** @param {React.KeyboardEvent} event @param {any} row */
  const openRowFromKeyboard = (event, row) => {
    if (!onRowClick || startsFromNestedAction(event) || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }
    event.preventDefault();
    onRowClick(row);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:hidden" role="list">
        {rows.map((row, rowIndex) => (
          <div
            key={rowKey(row)}
            role={onRowClick ? 'button' : 'listitem'}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? (event) => openRow(event, row) : undefined}
            onKeyDown={(event) => openRowFromKeyboard(event, row)}
            className={cn(
              'animate-card-in rounded-2xl border border-border bg-card p-4 shadow-[0_12px_30px_-24px_rgb(15_23_42/0.45)] transition-[border-color,box-shadow,transform] duration-200 ease-out',
              onRowClick &&
                'cursor-pointer hover:border-primary/25 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] motion-reduce:active:scale-100',
            )}
            style={{ animationDelay: `${Math.min(rowIndex, 6) * 35}ms` }}
          >
            <div className="space-y-3">
              {columns.map((column) => (
                <div
                  key={column.key}
                  className={cn(
                    'flex items-start justify-between gap-4 border-t border-border/70 pt-3 first:border-t-0 first:pt-0',
                    !column.header && 'justify-end',
                  )}
                >
                  {column.header && (
                    <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {column.header}
                    </span>
                  )}
                  <div
                    className={cn(
                      'min-w-0 text-right text-sm',
                      column.numeric && 'tabular',
                      !column.header && 'text-left',
                      column.className,
                    )}
                  >
                    {renderCell(column, row)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_30px_-24px_rgb(15_23_42/0.45)] md:block">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/45 backdrop-blur">
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => {
                const isActive = activeField === column.key;
                const sortable = column.sortable && onSortChange;

                return (
                  <TableHead
                    key={column.key}
                    numeric={column.numeric}
                    className={column.className}
                    aria-sort={isActive ? (descending ? 'descending' : 'ascending') : undefined}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded transition-colors hover:text-foreground',
                          column.numeric && 'flex-row-reverse',
                          isActive && 'text-foreground',
                        )}
                      >
                        {column.header}
                        {isActive ? (
                          descending ? (
                            <ArrowDown className="size-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowUp className="size-3.5" aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow
                key={rowKey(row)}
                onClick={onRowClick ? (event) => openRow(event, row) : undefined}
                onKeyDown={(event) => openRowFromKeyboard(event, row)}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  'animate-card-in',
                  onRowClick &&
                    'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                )}
                style={{ animationDelay: `${Math.min(rowIndex, 8) * 20}ms` }}
              >
                {columns.map((column) => (
                  <TableCell key={column.key} numeric={column.numeric} className={column.className}>
                    {renderCell(column, row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
