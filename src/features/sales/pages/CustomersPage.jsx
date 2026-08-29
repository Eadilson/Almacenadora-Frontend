import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Users } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { MoneyInput } from '@/components/forms/MoneyInput.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { useDebounced } from '@/hooks/useDebounced';
import { formatMoney, parseMoneyInput, toMajorString } from '@/lib/money';
import { useCustomers, useSalesMutations } from '../hooks/useSales.js';

const schema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  taxId: z.string().trim().max(30).optional(),
  email: z.string().trim().email('Correo inválido.').or(z.literal('')).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  creditEnabled: z.boolean().default(false),
  creditLimit: z.string().optional(),
  creditTermDays: z.coerce.number().int().min(0).max(365).optional(),
});

/**
 * Clientes.
 *
 * El crédito se administra desde aquí porque es una decisión de riesgo: quién puede
 * llevarse mercancía sin pagarla hoy, hasta cuánto y con qué plazo.
 */
export function CustomersPage() {
  const { can } = usePermission();
  const { tenant } = useSession();
  const currency = tenant?.currency ?? 'GTQ';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(/** @type {any} */ (null));
  const [creating, setCreating] = useState(false);

  const debouncedSearch = useDebounced(search, 300);
  const filters = useMemo(
    () => ({ search: debouncedSearch || undefined, page, limit: 25 }),
    [debouncedSearch, page],
  );

  const { data, isPending, isError, error, refetch } = useCustomers(filters);
  const { createCustomer, updateCustomer } = useSalesMutations();

  const rows = data?.items ?? [];
  const meta = data?.meta ?? {};
  const canManage = can('customers:create');

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      taxId: '',
      email: '',
      phone: '',
      address: '',
      creditEnabled: false,
      creditLimit: '',
      creditTermDays: 30,
    },
  });

  const creditEnabled = form.watch('creditEnabled');

  /** @param {any} customer */
  const openEdit = (customer) => {
    setEditing(customer);
    form.reset({
      name: customer.name ?? '',
      taxId: customer.taxId ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      creditEnabled: customer.credit?.enabled ?? false,
      creditLimit: customer.credit?.limit ? toMajorString(customer.credit.limit) : '',
      creditTermDays: customer.credit?.termDays ?? 30,
    });
  };

  const openCreate = () => {
    setCreating(true);
    form.reset({
      name: '',
      taxId: '',
      email: '',
      phone: '',
      address: '',
      creditEnabled: false,
      creditLimit: '',
      creditTermDays: 30,
    });
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const submit = form.handleSubmit(async (values) => {
    const limit = values.creditLimit ? parseMoneyInput(values.creditLimit, currency) : null;

    if (values.creditEnabled && values.creditLimit && !limit) {
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
      if (editing) {
        await updateCustomer.mutateAsync({
          id: editing.id,
          changes: {
            ...contact,
            credit: {
              enabled: values.creditEnabled,
              ...(limit ? { limit } : {}),
              termDays: Number(values.creditTermDays ?? 0),
            },
          },
        });
      } else {
        await createCustomer.mutateAsync({
          ...contact,
          creditEnabled: values.creditEnabled,
          ...(limit ? { creditLimit: limit } : {}),
          creditTermDays: Number(values.creditTermDays ?? 0),
        });
      }
      close();
    } catch (mutationError) {
      const apiError = /** @type {any} */ (mutationError);

      if (apiError?.isValidation) {
        for (const [field, message] of Object.entries(apiError.toFormErrors())) {
          form.setError(/** @type {any} */ (field), { message: /** @type {string} */ (message) });
        }
      } else {
        // Lo inesperado se muestra en lugar de callarse: en silencio, el diálogo
        // se queda abierto sin decir por qué y parece que el botón no funcionó.
        form.setError('name', {
          message: apiError?.message ?? 'No se pudo guardar el cliente. Inténtelo de nuevo.',
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
      header: 'Cliente',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          {row.taxId && <p className="text-xs text-muted-foreground">{row.taxId}</p>}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contacto',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.phone ?? row.email ?? '—'}</span>
      ),
    },
    {
      key: 'credit',
      header: 'Crédito',
      render: (row) =>
        row.credit.enabled ? (
          <div className="space-y-0.5">
            <Badge variant="warning">{formatMoney(row.credit.limit)}</Badge>
            <p className="text-[11px] text-muted-foreground">{row.credit.termDays} días</p>
          </div>
        ) : (
          <Badge variant="outline">Contado</Badge>
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) =>
        row.status === 'ACTIVE' ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant={row.status === 'BLOCKED' ? 'destructive' : 'secondary'}>
            {row.status === 'BLOCKED' ? 'Bloqueado' : 'Inactivo'}
          </Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {meta.total !== undefined
              ? `${meta.total} ${meta.total === 1 ? 'cliente' : 'clientes'}`
              : 'A quién le vende su empresa'}
          </p>
        </div>

        {canManage && (
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" />
            Nuevo cliente
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
            placeholder="Buscar por nombre, código o identificación…"
            className="pl-9"
            aria-label="Buscar clientes"
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
        emptyTitle="Sin clientes"
        emptyDescription="Registre clientes para vender a crédito y llevar su cuenta."
        emptyAction={
          canManage ? (
            <Button onClick={openCreate}>
              <Users aria-hidden="true" />
              Registrar cliente
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
            <DialogTitle>{editing ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
            <DialogDescription>
              {editing ? `Código ${editing.code}` : 'Se le asigna un código correlativo.'}
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
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="size-4" {...form.register('creditEnabled')} />
                Permitir compras a crédito
              </label>

              {creditEnabled && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    name="creditLimit"
                    label="Límite de crédito"
                    error={form.formState.errors.creditLimit?.message}
                    hint="Lo máximo que puede deber."
                  >
                    {({ id, invalid, describedBy }) => (
                      <MoneyInput
                        id={id}
                        currency={currency}
                        invalid={invalid}
                        aria-describedby={describedBy}
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
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createCustomer.isPending || updateCustomer.isPending}>
                {editing ? 'Guardar cambios' : 'Crear cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
