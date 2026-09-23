import { Inbox, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';

/**
 * Estados de una pantalla: cargando, vacía, con error.
 *
 * Se agrupan aquí porque toda vista de datos necesita los tres y tratarlos como un
 * conjunto evita que alguna pantalla se quede sin uno. Una lista vacía sin mensaje
 * parece un error del sistema; un error sin acción deja al usuario atascado.
 */

/**
 * @param {{ label?: string, className?: string }} props
 */
export function PageLoader({ label = 'Cargando…', className }) {
  return (
    <div
      className={cn('flex min-h-[50vh] flex-col items-center justify-center gap-3', className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * @param {{ title: string, description?: string, icon?: React.ElementType, action?: React.ReactNode, className?: string }} props
 */
export function EmptyState({ title, description, icon = Inbox, action, className }) {
  const Icon = icon;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card p-10 text-center shadow-[0_12px_30px_-24px_rgb(15_23_42/0.45)]',
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Error de carga con acción de reintento.
 *
 * Muestra el identificador de la petición cuando lo hay: es el dato con el que
 * soporte puede rastrear el fallo completo en los registros del servidor.
 *
 * @param {{ error: import('@/api/ApiError').ApiError|Error|null, onRetry?: () => void, className?: string }} props
 */
export function ErrorState({ error, onRetry, className }) {
  const apiError = /** @type {any} */ (error);
  const requestId = apiError?.requestId ?? null;
  const isNetwork = apiError?.code === 'NETWORK_ERROR';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center shadow-[0_12px_30px_-24px_rgb(15_23_42/0.45)]',
        className,
      )}
      role="alert"
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10">
        <TriangleAlert className="size-5 text-destructive" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <p className="font-medium">
          {isNetwork ? 'Sin conexión con el servidor' : 'No se pudieron cargar los datos'}
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          {apiError?.message ?? 'Ocurrió un error inesperado.'}
        </p>
        {requestId && (
          <p className="select-all pt-1 font-mono text-[11px] text-muted-foreground">
            Referencia: {requestId}
          </p>
        )}
      </div>

      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Intentar de nuevo
        </Button>
      )}
    </div>
  );
}
