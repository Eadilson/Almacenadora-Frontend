import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Phone, Plus, Search, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useDebounced } from '@/hooks/useDebounced';
import { useSuppliers, usePurchasingMutations } from '../hooks/usePurchasing.js';

const schema = z.object({
  code: z.string().trim().max(20).optional(),
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  taxId: z.string().trim().max(30).optional(),
  contactName: z.string().trim().max(120).optional(),
  email: z.string().trim().email('Correo inválido.').or(z.literal('')).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  paymentTermDays: z.coerce.number().int().min(0).max(365).optional(),
});

/**
 * Proveedores.
 *
 * El plazo de pago es el dato que decide si una compra es de contado o a crédito,
 * así que se muestra en la lista: es lo que el encargado necesita ver antes de
 * elegir a quién comprarle.
 */
export function SuppliersPage() {
  const { can } = usePermission();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(/** @type {any} */ (null));
  const [creating, setCreating] = useState(false);

  const debouncedSearch = useDebounced(search, 300);
  const filters = useMemo(
    () => ({ search: debouncedSearch || undefined, page, limit: 25 }),
    [debouncedSearch, page],
  );

  const { data, isPending, isError, error, refetch } = useSuppliers(filters);
  const { createSupplier, updateSupplier, deactivateSupplier } = usePurchasingMutations();

  const rows = data?.items ?? [];
  const meta = data?.meta ?? {};
  const canManage = can('purchases:create');

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      name: '',
      taxId: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      paymentTermDays: 0,
    },
  });

  /** @param {any} supplier */
  const openEdit = (supplier) => {
    setEditing(supplier);
    form.reset({
      code: supplier.code ?? '',
      name: supplier.name ?? '',
      taxId: supplier.taxId ?? '',
      contactName: supplier.contactName ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      address: supplier.address ?? '',
      paymentTermDays: supplier.paymentTermDays ?? 0,
    });
  };

  const openCreate = () => {
    setCreating(true);
    form.reset({
      code: '',
      name: '',
      taxId: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      paymentTermDays: 0,
    });
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
  };

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
      if (editing) {
        await updateSupplier.mutateAsync({ id: editing.id, changes: payload });
      } else {
        await createSupplier.mutateAsync({
          ...payload,
          ...(values.code ? { code: values.code } : {}),
        });
      }
      close();
    } catch (mutationError) {
      const apiError = /** @type {any} */ (mutationError);

      if (apiError?.isValidation) {
        for (const [field, message] of Object.entries(apiError.toFormErrors())) {
          form.setError(/** @type {any} */ (field), { message: /** @type {string} */ (message) });
        }
      } else if (apiError?.code === 'DUPLICATE_RESOURCE') {
        form.setError('code', { message: apiError.message });
      } else {
        // Cualquier otra cosa se muestra en vez de callarse. Tragarla producía el
        // peor estado posible: el servidor guardaba, el diálogo seguía abierto sin
        // ninguna explicación, y la persona volvía a pulsar creando un duplicado.
        form.setError('name', {
          message: apiError?.message ?? 'No se pudo guardar. Inténtelo de nuevo.',
        });
      }
    }
  });

  const columns = [
    {
      key: 'code',
      header: 'Código',
      render: (row) => <span className="font-mono text-xs">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Proveedor',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          {row.contactName && (
            <p className="truncate text-xs text-muted-foreground">{row.contactName}</p>
          )}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contacto',
      render: (row) => (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {row.email && (
            <p className="flex items-center gap-1.5">
              <Mail className="size-3" aria-hidden="true" />
              {row.email}
            </p>
          )}
          {row.phone && (
            <p className="flex items-center gap-1.5">
              <Phone className="size-3" aria-hidden="true" />
              {row.phone}
            </p>
          )}
          {!row.email && !row.phone && '—'}
        </div>
      ),
    },
    {
      key: 'paymentTermDays',
      header: 'Pago',
      render: (row) =>
        row.sellsOnCredit ? (
          <Badge variant="secondary">{row.paymentTermDays} días</Badge>
        ) : (
          <Badge variant="outline">Contado</Badge>
        ),
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (row) =>
        row.isActive ? <Badge variant="success">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1>
          <p className="text-sm text-muted-foreground">
            {meta.total !== undefined
              ? `${meta.total} ${meta.total === 1 ? 'proveedor' : 'proveedores'}`
              : 'A quién le compra su empresa'}
          </p>
        </div>

        {canManage && (
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" />
            Nuevo proveedor
          </Button>
        )}
      </header>

      <div className="rounded-lg border bg-card p-4">
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre, código o identificación fiscal…"
            className="pl-9"
            aria-label="Buscar proveedores"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        onRowClick={canManage ? openEdit : undefined}
        emptyTitle="Sin proveedores"
        emptyDescription="Registre a quién le compra para poder crear órdenes de compra."
        emptyAction={
          canManage ? (
            <Button onClick={openCreate}>
              <Truck aria-hidden="true" />
              Registrar proveedor
            </Button>
          ) : undefined
        }
      />

      {meta.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
          <p className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!meta.hasPrev} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </nav>
      )}

      <Dialog open={creating || Boolean(editing)} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Código ${editing.code}`
                : 'Si no indica un código, se asigna uno correlativo.'}
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

              {!editing && (
                <FormField
                  name="code"
                  label="Código"
                  error={form.formState.errors.code?.message}
                  hint="Opcional."
                >
                  {({ id, invalid, describedBy }) => (
                    <Input
                      id={id}
                      invalid={invalid}
                      aria-describedby={describedBy}
                      className="font-mono"
                      placeholder="PRV-0001"
                      {...form.register('code')}
                    />
                  )}
                </FormField>
              )}

              <FormField name="taxId" label="Identificación fiscal" error={form.formState.errors.taxId?.message}>
                {({ id, invalid, describedBy }) => (
                  <Input id={id} invalid={invalid} aria-describedby={describedBy} {...form.register('taxId')} />
                )}
              </FormField>

              <FormField name="contactName" label="Persona de contacto" error={form.formState.errors.contactName?.message}>
                {({ id, invalid, describedBy }) => (
                  <Input id={id} invalid={invalid} aria-describedby={describedBy} {...form.register('contactName')} />
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

            <DialogFooter>
              {editing && editing.isActive && can('purchases:void') && (
                <Button
                  type="button"
                  variant="outline"
                  className="sm:mr-auto"
                  disabled={deactivateSupplier.isPending}
                  onClick={async () => {
                    await deactivateSupplier.mutateAsync(editing.id);
                    close();
                  }}
                >
                  Desactivar
                </Button>
              )}
              <Button type="button" variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createSupplier.isPending || updateSupplier.isPending}>
                {editing ? 'Guardar cambios' : 'Crear proveedor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
