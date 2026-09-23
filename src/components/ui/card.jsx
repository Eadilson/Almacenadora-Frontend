import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * `interactive` es para una tarjeta que en sí misma es el disparador de algo
 * —un enlace, un botón envuelto en ella— nunca para una que solo muestra un
 * dato o contiene un formulario: eso se lee, no se agarra, y moverlo al pasar
 * el cursor sería decoración sobre información. Por eso viene apagada por
 * omisión.
 *
 * El levantamiento va detrás de `hover:hover` además de `:hover`: sin eso, un
 * toque en pantalla táctil deja la tarjeta "flotando" hasta el siguiente
 * toque, porque el navegador simula un `:hover` que nunca se suelta.
 *
 * La aparición (`animate-card-in`) va activada por omisión, no como algo que
 * cada pantalla tenga que pedir: es la que hace que una tarjeta se sienta
 * construida al llegar, en vez de aparecer de golpe como un `<div>` cualquiera.
 * Ocurre una vez por montaje —al entrar a la pantalla, no en cada tecla— así
 * que cae dentro de lo ocasional, no de lo que se repite. `noAnimateIn` es la
 * salida para el caso raro de una tarjeta que nace ya dentro de algo que
 * anima por su cuenta (un diálogo, por ejemplo) y no debe competir con eso.
 */
export const Card = forwardRef(
  ({ className, interactive = false, noAnimateIn = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // El borde del token global (`--border`) es casi invisible sobre una
        // tarjeta blanca: se apoya en la sombra para separarse, pero a
        // tamaño de pantalla completa se pierde. Este es más oscuro y algo
        // más grueso a propósito — se nota la tarjeta como objeto, no solo
        // como un bloque de texto con aire alrededor.
        'rounded-2xl border border-border bg-card text-card-foreground shadow-[0_12px_30px_-24px_rgb(15_23_42/0.45)]',
        !noAnimateIn && 'animate-card-in motion-reduce:animate-none',
        interactive &&
          'cursor-pointer transition-[transform,box-shadow] duration-200 ease-out hover:shadow-card-hover active:shadow-card active:duration-100 motion-reduce:transition-shadow [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1 [@media(hover:hover)_and_(pointer:fine)]:active:translate-y-0 motion-reduce:[@media(hover:hover)_and_(pointer:fine)]:hover:translate-y-0',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export const CardHeader = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';
