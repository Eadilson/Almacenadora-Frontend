import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { useDialogSubmit } from '@/hooks/useDialogSubmit';
import { useAdminMutations } from '../hooks/useAdmin.js';

/**
 * Editor de un rol.
 *
 * Los permisos se muestran agrupados y con nombre legible —«Anular ventas», no
 * `sales:void`— porque quien configura esto suele ser el dueño del comercio. Los
 * que uno mismo no posee aparecen bloqueados en lugar de ocultos: es más honesto
 * mostrar que existen y que no se pueden conceder, que fingir que no están.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {any} [props.role] Ausente al crear.
 * @param {any[]} props.catalog
 */
export function RoleDialog({ open, onOpenChange, role, catalog }) {
  const { createRole, updateRole } = useAdminMutations();

  const editing = Boolean(role);

  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState(/** @type {string[]} */ ([]));

  useEffect(() => {
    if (!open) return;
    setKey(role?.key ?? '');
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setSelected(role?.permissions ?? []);
  }, [open, role]);

  const { error: submitError, submitting, run } = useDialogSubmit();

  const pending = createRole.isPending || updateRole.isPending || submitting;
  const canSubmit =
    name.trim().length > 0 &&
    selected.length > 0 &&
    (editing || /^[A-Za-z][A-Za-z0-9_]*$/.test(key)) &&
    !pending;

  /** @param {string} permission */
  const toggle = (permission) =>
    setSelected((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );

  /** @param {any} group */
  const toggleGroup = (group) => {
    const grantable = group.permissions
      .filter((/** @type {any} */ p) => p.grantable)
      .map((/** @type {any} */ p) => p.key);
    const allSelected = grantable.every((/** @type {string} */ k) => selected.includes(k));

    setSelected((current) =>
      allSelected
        ? current.filter((item) => !grantable.includes(item))
        : [...new Set([...current, ...grantable])],
    );
  };

  async function submit() {
    const ok = await run(async () => {
      if (editing) {
        await updateRole.mutateAsync({
          id: role.id,
          changes: { name: name.trim(), description: description.trim(), permissions: selected },
        });
      } else {
        await createRole.mutateAsync({
          key: key.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim(),
          permissions: selected,
        });
      }
    });

    if (!ok) return;
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Editar «${role.name}»` : 'Crear rol'}</DialogTitle>
          <DialogDescription>
            Marque lo que este puesto debe poder hacer. Lo que no marque, no lo podrá hacer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="name" label="Nombre" required>
            {({ id }) => (
              <Input
                id={id}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Encargado de bodega"
                autoFocus
              />
            )}
          </FormField>

          <FormField
            name="key"
            label="Clave"
            required
            hint={editing ? 'No se puede cambiar.' : 'Letras, números y guion bajo.'}
          >
            {({ id }) => (
              <Input
                id={id}
                value={key}
                onChange={(event) => setKey(event.target.value.toUpperCase())}
                placeholder="BODEGA"
                className="font-mono"
                disabled={editing}
              />
            )}
          </FormField>
        </div>

        <FormField name="description" label="Descripción">
          {({ id }) => (
            <Textarea
              id={id}
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Recibe mercancía y ajusta existencias, sin acceso a precios de costo."
            />
          )}
        </FormField>

        <Separator />

        <div className="space-y-4">
          <p className="text-sm font-medium">
            Permisos <span className="tabular text-muted-foreground">({selected.length})</span>
          </p>

          {catalog.map((/** @type {any} */ group) => {
            const grantable = group.permissions.filter((/** @type {any} */ p) => p.grantable);
            const allSelected =
              grantable.length > 0 &&
              grantable.every((/** @type {any} */ p) => selected.includes(p.key));

            return (
              <div key={group.key} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{group.label}</p>
                  {grantable.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => toggleGroup(group)}>
                      {allSelected ? 'Quitar todo' : 'Marcar todo'}
                    </Button>
                  )}
                </div>

                <ul className="space-y-1.5">
                  {group.permissions.map((/** @type {any} */ permission) => (
                    <li key={permission.key}>
                      <label
                        className={`flex items-start gap-2 text-sm ${
                          permission.grantable ? '' : 'opacity-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={selected.includes(permission.key)}
                          disabled={!permission.grantable}
                          onChange={() => toggle(permission.key)}
                        />
                        <span>
                          <span className="flex items-center gap-1.5">
                            {permission.label}
                            {!permission.grantable && (
                              <Lock
                                className="size-3"
                                aria-label="Usted no tiene este permiso, así que no puede concederlo"
                              />
                            )}
                          </span>
                          {permission.description && (
                            <span className="block text-xs text-muted-foreground">
                              {permission.description}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

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
            {pending ? 'Guardando…' : editing ? 'Guardar' : 'Crear rol'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
