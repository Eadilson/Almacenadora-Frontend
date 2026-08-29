import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Diálogo modal.
 *
 * Se apoya en Radix por lo que no se ve: foco atrapado dentro del diálogo, cierre
 * con Escape, restauración del foco al cerrar y anuncio correcto a los lectores de
 * pantalla. Reimplementar eso a mano sale mal casi siempre, y el fallo solo lo nota
 * quien navega con teclado.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * @param {{ className?: string, children: React.ReactNode }} props
 */
export function DialogContent({ className, children, ...props }) {
  return (
    <DialogPrimitive.Portal>
      {/*
        La cortina solo se atenúa: no se mueve, así que no lleva escala — una
        superficie que no es un objeto agarrable no necesita comportarse como uno.
        Bajo «reducir movimiento» se cae a la misma opacidad, sin cambios.
      */}
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
          'data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out',
          'motion-reduce:data-[state=open]:animate-fade-in motion-reduce:data-[state=closed]:animate-none',
        )}
      />
      {/*
        El diálogo nace centrado y muere en el mismo sitio: no hay de dónde
        deslizarlo, así que lo que lo hace sentir un objeto y no un recorte de CSS
        es una leve escala con posada sin rebote (spring críticamente amortiguado,
        no un `ease` parejo). Bajo «reducir movimiento» queda solo el fundido.
      */}
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100vh-4rem)] overflow-y-auto rounded-lg border bg-background p-6 shadow-lg',
          'data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out',
          'motion-reduce:data-[state=open]:animate-fade-in motion-reduce:data-[state=closed]:animate-none',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-[color,background-color,transform] duration-100 hover:bg-accent hover:text-foreground active:scale-90 motion-reduce:active:scale-100"
          aria-label="Cerrar"
        >
          <X className="size-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/**
 * @param {{ className?: string, children: React.ReactNode }} props
 */
export function DialogHeader({ className, ...props }) {
  return <div className={cn('mb-4 space-y-1.5 pr-8', className)} {...props} />;
}

export const DialogTitle = ({ className, ...props }) => (
  <DialogPrimitive.Title
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
);

export const DialogDescription = ({ className, ...props }) => (
  <DialogPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />
);

/**
 * @param {{ className?: string, children: React.ReactNode }} props
 */
export function DialogFooter({ className, ...props }) {
  return (
    <div className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
  );
}
