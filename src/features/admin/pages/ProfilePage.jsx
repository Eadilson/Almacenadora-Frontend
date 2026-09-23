import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/useToast';
import { formatDateTime } from '@/lib/format';
import { initialsOf } from '@/lib/utils';

/**
 * Perfil de la sesión actual.
 *
 * Solo el nombre se edita aquí: el correo es la credencial de entrada y firma el
 * historial de quién hizo qué, y el rol y las sucursales los decide
 * Administración, no la propia persona. Es la misma restricción que rige la
 * ficha de un usuario ajeno, aplicada a la propia.
 */
export function ProfilePage() {
  const { user, tenant, updateProfile, logoutAllSessions } = useSession();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [closingSessions, setClosingSessions] = useState(false);

  // Si la sesión se recarga con datos nuevos —tras renovar el token, por
  // ejemplo—, el campo no debe quedarse mostrando lo que ya se guardó antes.
  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  const dirty = name.trim() !== (user?.name ?? '') && name.trim().length > 0;

  async function submit() {
    setError('');
    setSaving(true);

    try {
      await updateProfile({ name: name.trim() });
      toast({ variant: 'success', title: 'Perfil actualizado' });
    } catch (caught) {
      setError(/** @type {any} */ (caught).message ?? 'No se pudo guardar el cambio.');
    } finally {
      setSaving(false);
    }
  }

  async function closeOtherSessions() {
    setClosingSessions(true);
    try {
      await logoutAllSessions();
    } catch {
      // El cierre local ya ocurrió aunque la petición fallara: no hay nada más
      // que mostrar aquí, la persona ya está viendo la pantalla de entrada.
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center gap-4">
        <Avatar className="size-14">
          <AvatarFallback className="text-lg">{initialsOf(user?.name ?? '')}</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{user?.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{user?.role?.name}</Badge>
            {user?.lastLoginAt && (
              <span className="text-xs text-muted-foreground">
                Último acceso {formatDateTime(user.lastLoginAt)}
              </span>
            )}
          </div>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos personales</CardTitle>
          <CardDescription>El correo es su credencial de entrada y no se cambia aquí.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField name="name" label="Nombre" required>
            {({ id }) => (
              <Input
                id={id}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            )}
          </FormField>

          <FormField name="email" label="Correo">
            {({ id }) => <Input id={id} value={user?.email ?? ''} disabled />}
          </FormField>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button disabled={!dirty || saving} onClick={() => void submit()}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acceso y sucursales</CardTitle>
          <CardDescription>Lo que su rol le permite ver y dónde puede operar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Empresa</p>
              <p className="text-sm font-medium">{tenant?.tradeName ?? tenant?.legalName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plan</p>
              <p className="text-sm font-medium">{tenant?.plan?.name}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Sucursales asignadas</p>
            {user?.branches?.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {user.branches.map((branch) => (
                  <Badge key={branch.id} variant="outline">
                    {branch.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Todas las sucursales.</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Cambiar el rol o las sucursales es una decisión de Administración, no de esta pantalla.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seguridad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Contraseña</p>
                <p className="text-xs text-muted-foreground">Cámbiela periódicamente.</p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link to="/cambiar-clave">Cambiar</Link>
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Cerrar todas las sesiones</p>
                <p className="text-xs text-muted-foreground">
                  Incluida esta. Úselo si sospecha que alguien más tiene acceso con su cuenta.
                </p>
              </div>
            </div>
            <Button variant="outline" disabled={closingSessions} onClick={() => void closeOtherSessions()}>
              <LogOut aria-hidden="true" />
              {closingSessions ? 'Cerrando…' : 'Cerrar todas'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
