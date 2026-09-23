import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { Pagination } from '@/components/data/Pagination.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useListState } from '@/hooks/useListState';
import { formatMoney } from '@/lib/money';
import { useCustomers } from '../hooks/useSales.js';
import { CustomerFormDialog } from '../components/CustomerFormDialog.jsx';

/**
 * Clientes.
 *
 * El crédito se administra desde aquí porque es una decisión de riesgo: quién puede
 * llevarse mercancía sin pagarla hoy, hasta cuánto y con qué plazo. No hay un
 * interruptor de «tiene crédito o no» aparte del límite: dejarlo en cero es, por
 * sí mismo, un cliente de contado. Un interruptor aparte solo añadiría un estado
 * que puede desincronizarse del límite —cargado pero apagado, o al revés— sin
 * resolver nada que el límite no resuelva ya.
 *
 * La fila lleva a la ficha del cliente (`/clientes/:id`), no directo a
 * editar: un cliente es una relación comercial —compras, crédito, abonos—,
 * no solo un registro que se abre para cambiarle el teléfono. Editar sigue
 * ahí, como una acción propia, sin competir con la fila.
 */
export function CustomersPage() {
  const navigate = useNavigate();
  const { can } = usePermission();

  const { filters, query, setFilter, setPage } = useListState({ search: '' });
  const [editing, setEditing] = useState(/** @type {any} */ (null));
  const [creating, setCreating] = useState(false);

  const { data, isPending, isError, error, refetch } = useCustomers(query);

  const rows = data?.items ?? [];
  const meta = data?.meta ?? {};
  const canManage = can('customers:create');

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
        row.credit.limit.amount > 0 ? (
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
        title="Clientes"
        icon={Users}
        description={
          meta.total !== undefined
            ? `${meta.total} ${meta.total === 1 ? 'cliente' : 'clientes'}`
            : 'A quién le vende su empresa'
        }
      >
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Nuevo cliente
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
        onRowClick={(row) => navigate(`/clientes/${row.id}`)}
        emptyTitle="Sin clientes"
        emptyDescription="Registre clientes para vender a crédito y llevar su cuenta."
        emptyAction={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Users aria-hidden="true" />
              Registrar cliente
            </Button>
          ) : undefined
        }
      />

      <Pagination meta={meta} onPageChange={setPage} />

      <CustomerFormDialog open={creating} onOpenChange={setCreating} />
      <CustomerFormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        customer={editing}
      />
    </div>
  );
}
