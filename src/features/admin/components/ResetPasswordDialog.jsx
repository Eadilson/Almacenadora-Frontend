import { useEffect, useState } from 'react';
import { Copy, RefreshCw, TriangleAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { useToast } from '@/hooks/useToast';
import { useDialogSubmit } from '@/hooks/useDialogSubmit';
import { useAdminMutations } from '../hooks/useAdmin.js';

/**
 * @returns {string}
 */
function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(16));
  return [...bytes].map((value) => alphabet[value % alphabet.length]).join('');
}

/**
 * Restablecimiento de contraseña por un administrador.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {any} props.user
 */
export function ResetPasswordDialog({ open, onOpenChange, user }) {
  const { resetPassword } = useAdminMutations();
  const { toast } = useToast();

  const [password, setPassword] = useState('');

  const { error: submitError, clearError, submitting, run } = useDialogSubmit();

  useEffect(() => {
    if (!open) return;
    setPassword(generateTemporaryPassword());
    clearError();
  }, [open, clearError]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
          <DialogDescription>
            Se le asignará una contraseña temporal a {user?.name}. Tendrá que cambiarla al entrar.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="warning">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>
            Sus sesiones abiertas se cerrarán. Entréguele la contraseña en persona, no por un canal
            que otros puedan leer.
          </AlertDescription>
        </Alert>

        <FormField name="temporaryPassword" label="Contraseña temporal" required>
          {({ id }) => (
            <div className="flex gap-2">
              <Input
                id={id}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Generar otra"
                onClick={() => setPassword(generateTemporaryPassword())}
              >
                <RefreshCw aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Copiar"
                onClick={async () => {
                  await navigator.clipboard.writeText(password);
                  toast({ variant: 'success', title: 'Contraseña copiada' });
                }}
              >
                <Copy aria-hidden="true" />
              </Button>
            </div>
          )}
        </FormField>

        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={password.length < 12 || resetPassword.isPending || submitting}
            onClick={async () => {
              const ok = await run(() =>
                resetPassword.mutateAsync({ id: user.id, temporaryPassword: password }),
              );

              if (!ok) return;
              onOpenChange(false);
            }}
          >
            {resetPassword.isPending || submitting ? 'Restableciendo…' : 'Restablecer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
