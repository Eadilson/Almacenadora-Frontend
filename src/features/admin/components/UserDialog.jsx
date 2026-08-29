import { useEffect, useMemo, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
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
import { Select } from '@/components/ui/select.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { useToast } from '@/hooks/useToast';
import { useDialogSubmit } from '@/hooks/useDialogSubmit';
import { useAdminMutations } from '../hooks/useAdmin.js';

/**
 * Genera una contraseña temporal legible.
 *
 * Se evitan caracteres que se confunden al dictarla en voz alta o al copiarla de
 * un papel: la O y el 0, la l y el 1. La seguridad la da su corta vida —el sistema
 * obliga a cambiarla al entrar—, no que sea imposible de leer.
 */
function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(16));
  return [...bytes].map((value) => alphabet[value % alphabet.length]).join('');
}

/**
 * Alta y edición de un usuario.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {any} [props.user] Ausente al crear.
 * @param {any[]} props.roles
 * @param {any[]} props.branches
 * @param {boolean} [props.isSelf]
 */
export function UserDialog({ open, onOpenChange, user, roles, branches, isSelf = false }) {
  const { createUser, updateUser } = useAdminMutations();
  const { toast } = useToast();

  const editing = Boolean(user);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [allBranches, setAllBranches] = useState(true);
  const [branchIds, setBranchIds] = useState(/** @type {string[]} */ ([]));
  const [temporaryPassword, setTemporaryPassword] = useState('');

  useEffect(() => {
    if (!open) return;

    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setRoleId(user?.roleId ?? roles[0]?.id ?? '');
    setAllBranches(user ? user.allBranches : true);
    setBranchIds(user?.branchIds ?? []);
    setTemporaryPassword(user ? '' : generateTemporaryPassword());
  }, [open, user, roles]);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === roleId),
    [roles, roleId],
  );

  const { error: submitError, submitting, run } = useDialogSubmit();

  const pending = createUser.isPending || updateUser.isPending || submitting;
  const canSubmit =
    name.trim().length > 0 && roleId && (editing || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) && !pending;

  async function submit() {
    const ok = await run(async () => {
      if (editing) {
        /** @type {Record<string, any>} */
        const changes = { name: name.trim(), branchIds: allBranches ? [] : branchIds };
        // Cambiar el propio rol lo rechaza el servidor: ni siquiera se envía.
        if (!isSelf && roleId !== user.roleId) changes.roleId = roleId;

        await updateUser.mutateAsync({ id: user.id, changes });
      } else {
        await createUser.mutateAsync({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          roleId,
          branchIds: allBranches ? [] : branchIds,
          temporaryPassword,
        });
      }
    });

    if (!ok) return;
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Editar a ${user.name}` : 'Agregar persona'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'El correo no se cambia: es su credencial de entrada y firma su historial.'
              : 'Se creará con una contraseña temporal que el sistema le pedirá cambiar al entrar.'}
          </DialogDescription>
        </DialogHeader>

        <FormField name="name" label="Nombre completo" required>
          {({ id }) => (
            <Input
              id={id}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="María Fernández"
              autoFocus
            />
          )}
        </FormField>

        <FormField name="email" label="Correo" required>
          {({ id }) => (
            <Input
              id={id}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="maria@sunegocio.com"
              disabled={editing}
            />
          )}
        </FormField>

        <FormField
          name="role"
          label="Rol"
          required
          hint={selectedRole ? `${selectedRole.permissions.length} permisos` : undefined}
        >
          {({ id }) => (
            <Select
              id={id}
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              disabled={isSelf}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        {isSelf && (
          <Alert>
            <AlertDescription>
              No puede cambiar su propio rol. Si se quitara permisos por error, nadie podría
              devolvérselos.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label className="flex items-start gap-3 rounded-md border p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={allBranches}
              onChange={(event) => setAllBranches(event.target.checked)}
            />
            <span className="space-y-0.5 text-sm">
              <span className="block font-medium">Acceso a todas las sucursales</span>
              <span className="block text-xs text-muted-foreground">
                Incluye las que se creen en el futuro.
              </span>
            </span>
          </label>

          {!allBranches && (
            <div className="space-y-1.5 rounded-md border p-3">
              {branches.map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={branchIds.includes(branch.id)}
                    onChange={(event) =>
                      setBranchIds((current) =>
                        event.target.checked
                          ? [...current, branch.id]
                          : current.filter((id) => id !== branch.id),
                      )
                    }
                  />
                  <span className="font-mono text-xs">{branch.code}</span>
                  <span>{branch.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {!editing && (
          <FormField
            name="temporaryPassword"
            label="Contraseña temporal"
            required
            hint="Entréguela en persona. El sistema pedirá cambiarla en la primera entrada."
          >
            {({ id }) => (
              <div className="flex gap-2">
                <Input
                  id={id}
                  value={temporaryPassword}
                  onChange={(event) => setTemporaryPassword(event.target.value)}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Generar otra"
                  onClick={() => setTemporaryPassword(generateTemporaryPassword())}
                >
                  <RefreshCw aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Copiar"
                  onClick={async () => {
                    await navigator.clipboard.writeText(temporaryPassword);
                    toast({ variant: 'success', title: 'Contraseña copiada' });
                  }}
                >
                  <Copy aria-hidden="true" />
                </Button>
              </div>
            )}
          </FormField>
        )}

        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSubmit} onClick={() => void submit()}>
            {pending ? 'Guardando…' : editing ? 'Guardar' : 'Crear usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
