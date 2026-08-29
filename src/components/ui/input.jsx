import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Campo de texto.
 *
 * Recibe `invalid` en lugar de deducir el estado: el borde rojo debe aparecer solo
 * cuando el formulario decide mostrar el error, no en cuanto el campo se toca.
 */
export const Input = forwardRef(({ className, type = 'text', invalid = false, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    aria-invalid={invalid || undefined}
    className={cn(
      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
      'ring-offset-background placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'file:border-0 file:bg-transparent file:text-sm file:font-medium',
      invalid && 'border-destructive focus-visible:ring-destructive',
      className,
    )}
    {...props}
  />
));

Input.displayName = 'Input';
