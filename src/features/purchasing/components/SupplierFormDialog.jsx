import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { applyServerErrors } from '@/lib/applyServerErrors';
import { usePermission } from '@/hooks/usePermission';
import { usePurchasingMutations } from '../hooks/usePurchasing.js';

const schema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  taxId: z.string().trim().max(30).optional(),
  contactName: z.string().trim().max(120).optional(),
  email: z.string().trim().email('Correo inválido.').or(z.literal('')).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  paymentTermDays: z.coerce.number().int().min(0).max(365).optional(),
});

/**
 * Alta y edición de proveedor, en un diálogo.
 *
 * Vivía dentro de `SuppliersPage` — se extrae por la misma razón que el de
 * cliente: la ficha del proveedor también necesita poder editar sin volver
 * al listado.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {any} [props.supplier] `null`/`undefined` crea; un proveedor edita.
 * @param {(supplier: any) => void} [props.onSaved]
 */
export function SupplierFormDialog({ open, onOpenChange, supplier = null, onSaved }) {
  const { can } = usePermission();
  const { createSupplier, updateSupplier, deactivateSupplier } = usePurchasingMutations();
  const [saveError, setSaveError] = useState('');

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      taxId: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      paymentTermDays: 0,
    },
  });

  useEffect(() => {
    if (!open) return;
    setSaveError('');
    form.reset({
      name: supplier?.name ?? '',
      taxId: supplier?.taxId ?? '',
      contactName: supplier?.contactName ?? '',
      email: supplier?.email ?? '',
      phone: supplier?.phone ?? '',
      address: supplier?.address ?? '',
      paymentTermDays: supplier?.paymentTermDays ?? 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplier?.id]);

  const submit = form.handleSubmit(async (values) => {
    // Los campos vacíos se envían como null: una cadena vacía y «sin dato» son
    // cosas distintas, y guardar la primera ensucia la ficha.
    const payload = {
      name: values.name,
      taxId: values.taxId || null,
      contactName: values.contactName || null,
      email: values.email || null,
      phone: values.phone || null,
      address: values.address || null,
      paymentTermDays: Number(values.paymentTermDays ?? 0),
    };

    try {
      let saved;
      if (supplier) {
        saved = await updateSupplier.mutateAsync({ id: supplier.id, changes: payload });
      } else {
        // El código no se ofrece a escribir: lo asigna el servidor, correlativo,
        // igual que el de un cliente.
        saved = await createSupplier.mutateAsync(payload);
      }
      onOpenChange(false);
      onSaved?.(saved);
    } catch (mutationError) {
      const apiError = /** @type {any} */ (mutationError);

      if (apiError?.code === 'DUPLICATE_RESOURCE') {
        // El servidor dice qué campo chocó (`taxId`, el único que la persona
        // escribe y que puede repetirse); si algún día fuera otro que sí está
        // en este formulario, se apunta ahí en vez de siempre a Nombre.
        const conflictField = /** @type {string[]|undefined} */ (apiError.meta?.fields)?.find(
          (field) => field === 'taxId',
        );
        form.setError(conflictField ?? 'name', { message: apiError.message });
      } else {
        applyServerErrors(form, apiError, setSaveError, {
          fallbackMessage: 'No se pudo guardar. Inténtelo de nuevo.',
        });
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{supplier ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
          <DialogDescription>
            {supplier ? `Código ${supplier.code}` : 'El código se asigna solo, correlativo, al guardar.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              name="name"
              label="Nombre"
              required
              error={form.formState.errors.name?.message}
              className="sm:col-span-2"
            >
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  autoFocus
                  {...form.register('name')}
                />
              )}
            </FormField>

            <FormField name="taxId" label="Identificación fiscal" error={form.formState.errors.taxId?.message}>
              {({ id, invalid, describedBy }) => (
                <Input id={id} invalid={invalid} aria-describedby={describedBy} {...form.register('taxId')} />
              )}
            </FormField>

            <FormField
              name="contactName"
              label="Persona de contacto"
              error={form.formState.errors.contactName?.message}
            >
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  {...form.register('contactName')}
                />
              )}
            </FormField>

            <FormField
              name="paymentTermDays"
              label="Plazo de pago (días)"
              error={form.formState.errors.paymentTermDays?.message}
              hint="Cero significa compra de contado."
            >
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  max={365}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  className="text-right tabular"
                  {...form.register('paymentTermDays')}
                />
              )}
            </FormField>

            <FormField name="email" label="Correo" error={form.formState.errors.email?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  type="email"
                  invalid={invalid}
                  aria-describedby={describedBy}
                  {...form.register('email')}
                />
              )}
            </FormField>

            <FormField name="phone" label="Teléfono" error={form.formState.errors.phone?.message}>
              {({ id, invalid, describedBy }) => (
                <Input id={id} invalid={invalid} aria-describedby={describedBy} {...form.register('phone')} />
              )}
            </FormField>

            <FormField
              name="address"
              label="Dirección"
              error={form.formState.errors.address?.message}
              className="sm:col-span-2"
            >
              {({ id, invalid, describedBy }) => (
                <Input id={id} invalid={invalid} aria-describedby={describedBy} {...form.register('address')} />
              )}
            </FormField>
          </div>

          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            {supplier?.isActive && can('purchases:void') && (
              <Button
                type="button"
                variant="outline"
                className="sm:mr-auto"
                disabled={deactivateSupplier.isPending}
                onClick={async () => {
                  await deactivateSupplier.mutateAsync(supplier.id);
                  onOpenChange(false);
                }}
              >
                Desactivar
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createSupplier.isPending || updateSupplier.isPending}>
              {supplier ? 'Guardar cambios' : 'Crear proveedor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
