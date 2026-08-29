import { cn } from '@/lib/utils';

/**
 * Marcador de carga.
 *
 * Se prefiere a un indicador giratorio centrado porque conserva la forma de la
 * pantalla: el usuario ve dónde va a aparecer cada dato y la interfaz no salta al
 * llegar la respuesta.
 */
export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * @param {{ rows?: number, columns?: number }} props
 */
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="space-y-3" role="status" aria-label="Cargando datos">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton key={columnIndex} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
