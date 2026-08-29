import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { buttonVariants } from './variants.js';
import { cn } from '@/lib/utils';

/**
 * Botón.
 *
 * Con `loading` queda deshabilitado y muestra un indicador: es lo que evita el
 * doble envío de un formulario, que en una venta significaría cobrar dos veces.
 * La idempotencia del servidor es la red de seguridad; esto es la primera barrera.
 */
export const Button = forwardRef(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref,
  ) => {
    const Component = asChild ? Slot : 'button';

    return (
      <Component
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            {children}
          </>
        ) : (
          children
        )}
      </Component>
    );
  },
);

Button.displayName = 'Button';
