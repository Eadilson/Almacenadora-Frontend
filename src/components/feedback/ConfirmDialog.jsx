import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { useDialogSubmit } from '@/hooks/useDialogSubmit';

/**
 * Confirmación de una acción, sin campos que llenar.
 *
 * Existe porque «eliminar rol» y «desactivar usuario» eran un solo clic sin
 * vuelta atrás: la persona rozaba el botón y ya estaba hecho. Y como cualquier
 * otro diálogo de esta familia, si el servidor rechaza la operación el aviso se
 * ve aquí mismo — no se pierde en un rechazo sin capturar.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {string} [props.confirmLabel]
 * @param {'destructive'|'default'} [props.variant]
 * @param {() => Promise<unknown>} props.onConfirm
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  variant = 'destructive',
  onConfirm,
}) {
  const { error, clearError, submitting, run } = useDialogSubmit();

  // La misma instancia se reutiliza para objetivos distintos (un rol, luego
  // otro): sin esto, el error de un intento fallido seguía visible al abrir
  // el diálogo para algo que todavía no se ha intentado.
  useEffect(() => {
    if (open) clearError();
  }, [open, clearError]);

  const handleConfirm = async () => {
    const ok = await run(onConfirm);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant={variant} disabled={submitting} onClick={() => void handleConfirm()}>
            {submitting ? 'Un momento…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
