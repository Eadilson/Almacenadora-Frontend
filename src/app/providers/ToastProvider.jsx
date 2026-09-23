import { useCallback, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ToastContext } from '@/app/contexts';
import { cn } from '@/lib/utils';

const DEFAULT_DURATION_MS = 5000;
/** Los errores permanecen más tiempo: el usuario necesita leerlos y, a veces, copiar el identificador. */
const ERROR_DURATION_MS = 9000;

const VARIANT_STYLES = {
  info: 'border-primary/30 bg-card',
  success: 'border-success/40 bg-card',
  warning: 'border-warning/40 bg-card',
  destructive: 'border-destructive/50 bg-card',
};

const VARIANT_ACCENT = {
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

/**
 * Avisos temporales.
 *
 * Implementación propia y deliberadamente pequeña, en lugar de una dependencia
 * más: la necesidad es mostrar cuatro tipos de mensaje y poder copiar el
 * identificador de la petición cuando algo falla.
 */
export function ToastProvider({ children }) {
  /** @type {[import('@/app/contexts').Toast[], Function]} */
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    ({ title, description, variant = 'info', requestId = null, duration }) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, title, description, variant, requestId }]);

      const timeout = duration ?? (variant === 'destructive' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);
      window.setTimeout(() => dismiss(id), timeout);

      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* `aria-live` para que un lector de pantalla anuncie los avisos sin robar el
          foco al usuario, que puede estar escribiendo en un formulario. */}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
        role="region"
        aria-live="polite"
        aria-label="Avisos"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto relative flex gap-3 overflow-hidden rounded-xl border-[1.5px] p-4 pr-10 shadow-card-hover animate-slide-in-right',
              VARIANT_STYLES[toast.variant],
            )}
          >
            <span
              className={cn('absolute inset-y-0 left-0 w-1', VARIANT_ACCENT[toast.variant])}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.description && (
                <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>
              )}
              {toast.requestId && (
                <p className="mt-2 select-all font-mono text-[11px] text-muted-foreground">
                  Referencia: {toast.requestId}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Cerrar aviso"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
