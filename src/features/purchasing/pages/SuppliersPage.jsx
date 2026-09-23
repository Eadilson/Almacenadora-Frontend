import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Pencil, Phone, Plus, Search, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { Pagination } from '@/components/data/Pagination.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useListState } from '@/hooks/useListState';
import { useSuppliers } from '../hooks/usePurchasing.js';
import { SupplierFormDialog } from '../components/SupplierFormDialog.jsx';

/**
 * Proveedores.
 *
 * El plazo de pago es el dato que decide si una compra es de contado o a crédito,
 * así que se muestra en la lista: es lo que el encargado necesita ver antes de
 * elegir a quién comprarle.
 *
 * La fila lleva a la ficha del proveedor (`/proveedores/:id`), no directo a
 * editar: un proveedor es una relación —lo que se le ha comprado, cuánto, cuándo
 * fue la última vez—, no solo un registro de contacto. Editar sigue siendo una
 * acción propia, igual que en Clientes.
 */
export function SuppliersPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { filters, query, setFilter, setPage } = useListState({ search: '' });
  const [editing, setEditing] = useState(/** @type {any} */ (null));
  const [creating, setCreating] = useState(false);

  const { data, isPending, isError, error, refetch } = useSuppliers(query);

  const rows = data?.items ?? [];
  const meta = data?.meta ?? {};
  const canManage = can('purchases:create');

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
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            className: 'w-px',
            render: (/** @type {any} */ row) => (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Editar ${row.name}`}
                onClick={(/** @type {any} */ event) => {
                  event.stopPropagation();
                  setEditing(row);
                }}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proveedores"
        icon={Truck}
        description={
          meta.total !== undefined
            ? `${meta.total} ${meta.total === 1 ? 'proveedor' : 'proveedores'}`
            : 'A quién le compra su empresa'
        }
      >
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Nuevo proveedor
          </Button>
        )}
      </PageHeader>

      <div className="rounded-xl border-[1.5px] border-black/12 bg-card p-4 dark:border-white/15">
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
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
        onRowClick={(row) => navigate(`/proveedores/${row.id}`)}
        emptyTitle="Sin proveedores"
        emptyDescription="Registre a quién le compra para poder crear órdenes de compra."
        emptyAction={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Truck aria-hidden="true" />
              Registrar proveedor
            </Button>
          ) : undefined
        }
      />

      <Pagination meta={meta} onPageChange={setPage} />

      <SupplierFormDialog open={creating} onOpenChange={setCreating} />
      <SupplierFormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        supplier={editing}
      />
    </div>
  );
}
