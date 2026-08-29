import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Tabla.
 *
 * El contenedor propio con `overflow-x-auto` es intencionado: una tabla ancha debe
 * desplazarse dentro de sí misma. Si el desplazamiento horizontal lo asume el
 * cuerpo de la página, la navegación y el encabezado se salen de la pantalla.
 */
export const Table = forwardRef(({ className, containerClassName, ...props }, ref) => (
  <div className={cn('relative w-full overflow-x-auto', containerClassName)}>
    <table
      ref={ref}
      className={cn('w-full caption-bottom border-collapse text-sm', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

export const TableHeader = forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

export const TableFooter = forwardRef(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

export const TableRow = forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className,
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

/**
 * Celda de encabezado. Con `numeric` alinea a la derecha, que es como se leen las
 * columnas de importes y cantidades.
 */
export const TableHead = forwardRef(({ className, numeric = false, ...props }, ref) => (
  <th
    ref={ref}
    scope="col"
    className={cn(
      'h-11 whitespace-nowrap px-3 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground',
      numeric && 'text-right',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef(({ className, numeric = false, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('px-3 py-2.5 align-middle', numeric && 'text-right tabular', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

export const TableCaption = forwardRef(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
));
TableCaption.displayName = 'TableCaption';
