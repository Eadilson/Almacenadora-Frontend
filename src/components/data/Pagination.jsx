import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';

function getVisiblePages(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (page >= totalPages - 2) {
    pages.add(totalPages - 3);
    pages.add(totalPages - 2);
    pages.add(totalPages - 1);
  }

  return [...pages]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b)
    .flatMap((value, index, sorted) => {
      const previous = sorted[index - 1];
      return previous && value - previous > 1 ? ['ellipsis', value] : [value];
    });
}

/**
 * Paginación de un listado.
 *
 * Este bloque —«Página X de Y» más Anterior/Siguiente— se repetía, casi
 * carácter por carácter, en once pantallas distintas. Cada una lo había
 * copiado de la anterior, así que un ajuste (una etiqueta, un espaciado)
 * exigía tocar las once. Aquí vive una sola vez.
 *
 * La paginación la decide el servidor, nunca el cliente: `meta` es la
 * respuesta tal cual llega (`page`, `totalPages`, `hasPrev`, `hasNext`),
 * y este componente no hace más que mostrarla y avisar del cambio de página.
 *
 * @param {object} props
 * @param {{ page: number, totalPages: number, total?: number, hasPrev?: boolean, hasNext?: boolean }} props.meta
 * @param {(page: number) => void} props.onPageChange
 * @param {boolean} [props.isFetching] Página actual revalidándose en segundo plano.
 * @param {string} [props.itemLabel] Nombre de lo que se cuenta, en plural («productos», «cuentas») — se omite el total si no se da.
 */
export function Pagination({ meta, onPageChange, isFetching = false, itemLabel }) {
  if (!meta || meta.totalPages <= 1) return null;

  const pages = getVisiblePages(meta.page, meta.totalPages);

  return (
    <nav
      className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between"
      aria-label="Paginación"
    >
      <div className="flex items-center justify-between gap-3 sm:justify-start">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Página <span className="font-medium text-foreground">{meta.page}</span> de{' '}
          {meta.totalPages}
          {itemLabel && meta.total !== undefined && ` · ${meta.total} ${itemLabel}`}
          {isFetching && ' · actualizando…'}
        </p>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular text-muted-foreground sm:hidden">
          {meta.page}/{meta.totalPages}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <Button
          variant="outline"
          size="sm"
          disabled={!meta.hasPrev}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>

        <div className="hidden items-center gap-1 lg:flex">
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            disabled={!meta.hasPrev}
            onClick={() => onPageChange(1)}
            aria-label="Ir a la primera página"
          >
            <ChevronsLeft aria-hidden="true" />
          </Button>

          {pages.map((page, index) =>
            page === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                className="flex size-9 items-center justify-center text-sm text-muted-foreground"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                aria-current={page === meta.page ? 'page' : undefined}
                className={cn(
                  'flex size-9 items-center justify-center rounded-xl text-sm font-medium tabular transition-colors',
                  page === meta.page
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {page}
              </button>
            ),
          )}

          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            disabled={!meta.hasNext}
            onClick={() => onPageChange(meta.totalPages)}
            aria-label="Ir a la última página"
          >
            <ChevronsRight aria-hidden="true" />
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={!meta.hasNext}
          onClick={() => onPageChange(meta.page + 1)}
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
