import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Desplegable nativo.
 *
 * Se usa el `<select>` del navegador y no un componente propio: en un sistema de
 * gestión se rellenan decenas de campos al día, y el nativo gana en teclado, en
 * búsqueda por escritura, en pantalla táctil y en lectores de pantalla. Un
 * desplegable a medida solo se justifica cuando hace falta buscar entre cientos de
 * opciones —ahí llegará un `Combobox` aparte.
 */
export const Select = forwardRef(({ className, invalid = false, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex h-10 w-full appearance-none rounded-xl border border-input bg-background/85 px-3 py-2 pr-9 text-sm shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)] transition-[border-color,box-shadow,background-color]',
        'ring-offset-background hover:border-foreground/25 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-destructive focus-visible:ring-destructive',
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden="true"
    />
  </div>
));

Select.displayName = 'Select';
