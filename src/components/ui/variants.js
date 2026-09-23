import { cva } from 'class-variance-authority';

/**
 * Definiciones de variantes visuales.
 *
 * Viven fuera de los componentes para que cada archivo de componente exporte solo
 * componentes: es lo que permite que la recarga en caliente de Vite conserve el
 * estado de la pantalla al editarlos.
 */

export const buttonVariants = cva(
  // `transform` entra a la lista de propiedades en transición junto a las de
  // color: es lo que permite el retroceso leve al pulsar (abajo, por tamaño)
  // sin que la sombra o el color salten en seco.
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border border-primary bg-primary text-primary-foreground shadow-[0_1px_1px_hsl(var(--foreground)/0.08),0_10px_22px_-16px_hsl(var(--primary)/0.8)] hover:bg-primary/90 hover:shadow-[0_1px_2px_hsl(var(--foreground)/0.08),0_14px_28px_-18px_hsl(var(--primary)/0.85)]',
        // Las acciones irreversibles —anular una venta, ajustar inventario— llevan
        // esta variante para que el usuario reconozca el peligro antes de pulsar.
        destructive:
          'border border-destructive bg-destructive text-destructive-foreground shadow-[0_1px_1px_hsl(var(--foreground)/0.08),0_10px_22px_-16px_hsl(var(--destructive)/0.8)] hover:bg-destructive/90',
        outline:
          'border border-input bg-background/90 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)] hover:border-foreground/20 hover:bg-accent hover:text-accent-foreground',
        secondary: 'border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        success:
          'border border-success bg-success text-success-foreground shadow-[0_1px_1px_hsl(var(--foreground)/0.08),0_10px_22px_-16px_hsl(var(--success)/0.8)] hover:bg-success/90',
      },
      size: {
        // El levantamiento (1px, con mouse real) más el retroceso al pulsar
        // (0.98, casi imperceptible) son las dos mitades del mismo gesto:
        // sube al acercarse, confirma al soltar. `active:translate-y-0`
        // cancela el levantamiento durante la propia pulsación para que no
        // compitan los dos movimientos a la vez.
        default:
          'h-10 px-4 py-2 active:scale-[0.98] motion-reduce:active:scale-100 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-px [@media(hover:hover)_and_(pointer:fine)]:active:translate-y-0 motion-reduce:[@media(hover:hover)_and_(pointer:fine)]:hover:translate-y-0',
        sm: 'h-9 rounded-xl px-3 text-xs active:scale-[0.98] motion-reduce:active:scale-100 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-px [@media(hover:hover)_and_(pointer:fine)]:active:translate-y-0 motion-reduce:[@media(hover:hover)_and_(pointer:fine)]:hover:translate-y-0',
        lg: 'h-11 rounded-xl px-6 active:scale-[0.98] motion-reduce:active:scale-100 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-px [@media(hover:hover)_and_(pointer:fine)]:active:translate-y-0 motion-reduce:[@media(hover:hover)_and_(pointer:fine)]:hover:translate-y-0',
        // Los botones del punto de venta se pulsan cientos de veces al día, a
        // veces en pantalla táctil: necesitan un área generosa y **ningún**
        // efecto añadido, ni siquiera este — a esa frecuencia hasta un
        // retroceso de un 2% es una distracción, no una confirmación.
        pos: 'h-14 rounded-lg px-6 text-base',
        icon: 'size-10 active:scale-[0.98] motion-reduce:active:scale-100 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-px [@media(hover:hover)_and_(pointer:fine)]:active:translate-y-0 motion-reduce:[@media(hover:hover)_and_(pointer:fine)]:hover:translate-y-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        // Tinte suave, no relleno sólido: el mismo lenguaje que ya usa Alert
        // (`border-X/30 bg-X/5-10`). Un estado se lee en el texto, no solo en
        // un bloque de color a todo volumen — es lo que separa una etiqueta
        // de un semáforo.
        default: 'border-primary/25 bg-primary/10 text-primary',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-destructive/25 bg-destructive/10 text-destructive',
        success: 'border-success/25 bg-success/10 text-success',
        warning: 'border-warning/25 bg-warning/10 text-warning',
        outline: 'text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export const alertVariants = cva(
  'relative flex w-full gap-3 rounded-lg border p-4 text-sm [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:translate-y-0.5',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-card-foreground',
        info: 'border-primary/30 bg-primary/5 text-foreground',
        destructive: 'border-destructive/40 bg-destructive/5 text-foreground',
        success: 'border-success/40 bg-success/5 text-foreground',
        warning: 'border-warning/40 bg-warning/5 text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);
