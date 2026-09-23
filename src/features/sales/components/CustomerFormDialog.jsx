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
import { Separator } from '@/components/ui/separator.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { MoneyInput } from '@/components/forms/MoneyInput.jsx';
import { useSession } from '@/hooks/useSession';
import { parseMoneyInput, toMajorString } from '@/lib/money';
import { applyServerErrors } from '@/lib/applyServerErrors';
import { useSalesMutations } from '../hooks/useSales.js';

const schema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  taxId: z.string().trim().max(30).optional(),
  email: z.string().trim().email('Correo inválido.').or(z.literal('')).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  creditLimit: z.string().optional(),
  creditTermDays: z.coerce.number().int().min(0).max(365).optional(),
});

/**
 * Alta y edición de cliente, en un diálogo.
 *
 * Vivía dentro de `CustomersPage` — se extrae porque la ficha de cliente
 * también necesita poder editar sin volver al listado; repetir el formulario
 * en los dos sitios habría significado mantener la misma validación y el
 * mismo manejo de errores por partida doble.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {any} [props.customer] `null`/`undefined` crea; un cliente edita.
 * @param {(customer: any) => void} [props.onSaved]
 */
export function CustomerFormDialog({ open, onOpenChange, customer = null, onSaved }) {
  const { tenant } = useSession();
  const currency = tenant?.currency ?? 'GTQ';
  const { createCustomer, updateCustomer } = useSalesMutations();
  const [saveError, setSaveError] = useState('');

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      taxId: '',
      email: '',
      phone: '',
      address: '',
      creditLimit: '',
      creditTermDays: 30,
    },
  });

  // Se recarga cada vez que el diálogo se abre para un cliente distinto —o
  // para crear uno nuevo—, no en cada tecla.
  useEffect(() => {
    if (!open) return;
    setSaveError('');
    form.reset({
      name: customer?.name ?? '',
      taxId: customer?.taxId ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      address: customer?.address ?? '',
      creditLimit: customer?.credit?.limit ? toMajorString(customer.credit.limit) : '',
      creditTermDays: customer?.credit?.termDays ?? 30,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.id]);

  const submit = form.handleSubmit(async (values) => {
    // Vacío es cero, no «no cambiar»: si no fuera así, borrar el límite para
    // quitarle el crédito a alguien lo dejaría exactamente como estaba.
    const limit = parseMoneyInput(values.creditLimit || '0', currency);

    if (!limit) {
      form.setError('creditLimit', { message: 'Importe inválido.' });
      return;
    }

    const contact = {
      name: values.name,
      taxId: values.taxId || null,
      email: values.email || null,
      phone: values.phone || null,
      address: values.address || null,
    };

    try {
      let saved;
      if (customer) {
        saved = await updateCustomer.mutateAsync({
          id: customer.id,
          changes: { ...contact, credit: { limit, termDays: Number(values.creditTermDays ?? 0) } },
        });
      } else {
        saved = await createCustomer.mutateAsync({
          ...contact,
          creditLimit: limit,
          creditTermDays: Number(values.creditTermDays ?? 0),
        });
      }
      onOpenChange(false);
      onSaved?.(saved);
    } catch (mutationError) {
      // Lo que no señala ningún campo real —una regla de negocio, una caída de
      // red— se muestra en `saveError`; antes se fijaba sobre "name" sin
      // relación con el error real y el diálogo parecía no reaccionar.
      applyServerErrors(form, /** @type {any} */ (mutationError), setSaveError, {
        fallbackMessage: 'No se pudo guardar el cliente. Inténtelo de nuevo.',
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          <DialogDescription>
            {customer ? `Código ${customer.code}` : 'Se le asigna un código correlativo.'}
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

            <FormField name="phone" label="Teléfono" error={form.formState.errors.phone?.message}>
              {({ id, invalid, describedBy }) => (
                <Input id={id} invalid={invalid} aria-describedby={describedBy} {...form.register('phone')} />
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

            <FormField name="address" label="Dirección" error={form.formState.errors.address?.message}>
              {({ id, invalid, describedBy }) => (
                <Input id={id} invalid={invalid} aria-describedby={describedBy} {...form.register('address')} />
              )}
            </FormField>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Crédito</p>
              <p className="text-xs text-muted-foreground">
                Déjelo en cero para un cliente de contado: no hay un interruptor aparte, el límite
                es lo que decide.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                name="creditLimit"
                label="Límite de crédito"
                error={form.formState.errors.creditLimit?.message}
                hint="Lo máximo que puede deber. Cero es contado."
              >
                {({ id, invalid, describedBy }) => (
                  <MoneyInput
                    id={id}
                    currency={currency}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    placeholder="0.00"
                    {...form.register('creditLimit')}
                  />
                )}
              </FormField>

              <FormField
                name="creditTermDays"
                label="Plazo (días)"
                error={form.formState.errors.creditTermDays?.message}
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
                    {...form.register('creditTermDays')}
                  />
                )}
              </FormField>
            </div>
          </div>

          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createCustomer.isPending || updateCustomer.isPending}>
              {customer ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
