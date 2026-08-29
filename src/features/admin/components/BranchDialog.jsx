import { useEffect, useState } from 'react';
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
import { useDialogSubmit } from '@/hooks/useDialogSubmit';
import { useAdminMutations } from '../hooks/useAdmin.js';

/**
 * Alta y edición de una sucursal.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {any} [props.branch] Ausente al crear.
 */
export function BranchDialog({ open, onOpenChange, branch }) {
  const { createBranch, updateBranch } = useAdminMutations();

  const editing = Boolean(branch);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setCode(branch?.code ?? '');
    setName(branch?.name ?? '');
    setAddress(branch?.address ?? '');
    setPhone(branch?.phone ?? '');
    setIsDefault(Boolean(branch?.isDefault));
    setIsActive(branch ? branch.isActive : true);
  }, [open, branch]);

  const { error: submitError, submitting, run } = useDialogSubmit();

  const pending = createBranch.isPending || updateBranch.isPending || submitting;
  const canSubmit = name.trim().length > 0 && (editing || code.trim().length > 0) && !pending;

  async function submit() {
    const ok = await run(async () => {
      if (editing) {
        await updateBranch.mutateAsync({
          id: branch.id,
          changes: {
            name: name.trim(),
            address: address.trim() || null,
            phone: phone.trim() || null,
            isDefault,
            isActive,
          },
        });
      } else {
        await createBranch.mutateAsync({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          isDefault,
        });
      }
    });

    // El diálogo solo se cierra si de verdad se guardó. Cerrarlo pase lo que pase
    // haría creer que la operación salió bien.
    if (!ok) return;
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Editar ${branch.name}` : 'Nueva sucursal'}</DialogTitle>
          <DialogDescription>
            El código identifica la sucursal en los números de documento y no se cambia después.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField name="code" label="Código" required className="sm:col-span-1">
            {({ id }) => (
              <Input
                id={id}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="SUC2"
                className="font-mono"
                disabled={editing}
                maxLength={10}
              />
            )}
          </FormField>

          <FormField name="name" label="Nombre" required className="sm:col-span-2">
            {({ id }) => (
              <Input
                id={id}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Sucursal Zona 10"
                autoFocus
              />
            )}
          </FormField>
        </div>

        <FormField name="address" label="Dirección">
          {({ id }) => (
            <Input id={id} value={address} onChange={(event) => setAddress(event.target.value)} />
          )}
        </FormField>

        <FormField name="phone" label="Teléfono">
          {({ id }) => (
            <Input
              id={id}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="2233-4455"
            />
          )}
        </FormField>

        <label className="flex items-start gap-3 rounded-md border p-3">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={isDefault}
            onChange={(event) => setIsDefault(event.target.checked)}
          />
          <span className="space-y-0.5 text-sm">
            <span className="block font-medium">Sucursal predeterminada</span>
            <span className="block text-xs text-muted-foreground">
              Es donde se registra una venta si el usuario no elige otra. Solo puede haber una.
            </span>
          </span>
        </label>

        {editing && (
          <label className="flex items-start gap-3 rounded-md border p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <span className="space-y-0.5 text-sm">
              <span className="block font-medium">Activa</span>
              <span className="block text-xs text-muted-foreground">
                Una sucursal inactiva no aparece al vender, pero su historial se conserva.
              </span>
            </span>
          </label>
        )}

        {editing && branch?.isDefault && !isActive && (
          <Alert variant="destructive">
            <AlertDescription>
              No se puede desactivar la sucursal predeterminada. Marque otra como predeterminada
              primero.
            </AlertDescription>
          </Alert>
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
            {pending ? 'Guardando…' : editing ? 'Guardar' : 'Crear sucursal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
