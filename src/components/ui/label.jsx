import { forwardRef } from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

/**
 * Etiqueta de campo.
 *
 * Marca los obligatorios con un asterisco accesible: el símbolo se oculta a los
 * lectores de pantalla y se sustituye por texto, para que no se lea «asterisco».
 */
export const Label = forwardRef(({ className, required = false, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className,
    )}
    {...props}
  >
    {children}
    {required && (
      <>
        <span aria-hidden="true" className="ml-0.5 text-destructive">
          *
        </span>
        <span className="sr-only"> (obligatorio)</span>
      </>
    )}
  </LabelPrimitive.Root>
));

Label.displayName = 'Label';
