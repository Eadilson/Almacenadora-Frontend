import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/useToast';
import { useAdminMutations } from '../hooks/useAdmin.js';

/**
 * Cambio de la propia contraseña.
 *
 * Cierra el ciclo que abre el alta de un usuario: el administrador entrega una
 * contraseña temporal y aquí la persona la sustituye por una que solo ella conoce.
 *
 * Al terminar, todas las sesiones caen —incluida esta— y hay que volver a entrar.
 * Se avisa antes, no después: descubrir que te han cerrado la sesión sin
 * explicación parece un fallo.
 */
export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, logout } = useSession();
  const { changePassword } = useAdminMutations();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  const forced = Boolean(user?.mustChangePassword);

  const tooShort = newPassword.length > 0 && newPassword.length < 8;
  const mismatch = confirmation.length > 0 && newPassword !== confirmation;
  const sameAsCurrent = newPassword.length > 0 && newPassword === currentPassword;

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmation &&
    !sameAsCurrent &&
    !changePassword.isPending;

  async function submit() {
    setError('');

    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });

      toast({
        variant: 'success',
        title: 'Contraseña actualizada',
        description: 'Vuelva a entrar con su contraseña nueva.',
      });

      // La sesión ya no es válida en el servidor: se limpia también aquí.
      await logout?.();
      navigate('/login', { replace: true });
    } catch (caught) {
      setError(/** @type {any} */ (caught).message ?? 'No se pudo cambiar la contraseña.');
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="Cambiar contraseña"
        icon={KeyRound}
        description="Elija una que solo usted conozca."
      />

      {forced && (
        <Alert variant="warning">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>
            Está usando una contraseña temporal que le entregó un administrador. Cámbiela ahora:
            mientras no lo haga, otra persona conoce su clave.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" aria-hidden="true" />
            {user?.email}
          </CardTitle>
          <CardDescription>
            Al guardar se cerrarán todas sus sesiones, incluida esta, y tendrá que volver a entrar.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <FormField name="currentPassword" label="Contraseña actual" required>
            {({ id }) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoFocus
              />
            )}
          </FormField>

          <FormField
            name="newPassword"
            label="Contraseña nueva"
            required
            hint="Al menos 8 caracteres."
            error={
              tooShort
                ? 'Debe tener al menos 8 caracteres.'
                : sameAsCurrent
                  ? 'Debe ser distinta de la actual.'
                  : undefined
            }
          >
            {({ id, invalid }) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                invalid={invalid}
              />
            )}
          </FormField>

          <FormField
            name="confirmation"
            label="Repita la contraseña nueva"
            required
            error={mismatch ? 'Las dos contraseñas no coinciden.' : undefined}
          >
            {({ id, invalid }) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                invalid={invalid}
              />
            )}
          </FormField>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            {!forced && (
              <Button variant="outline" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
            )}
            <Button disabled={!canSubmit} onClick={() => void submit()}>
              {changePassword.isPending ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
