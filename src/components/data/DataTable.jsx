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

  /** @param {string} key */
  const toggleSort = (key) => {
    if (!onSortChange) return;
    // Primer clic ascendente, segundo descendente: es el orden que la gente espera.
    onSortChange(activeField === key && !descending ? `-${key}` : key);
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
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
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer' : undefined}
            >
              {columns.map((column) => (
                <TableCell key={column.key} numeric={column.numeric} className={column.className}>
                  {column.render ? column.render(row) : (row[column.key] ?? '—')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
