import { useMemo, useState } from 'react';
import { KeyRound, Search, UserPlus, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { useDebounced } from '@/hooks/useDebounced';
import { formatDateTime } from '@/lib/format';
import { UserDialog } from '../components/UserDialog.jsx';
import { ResetPasswordDialog } from '../components/ResetPasswordDialog.jsx';
import { useAdminMutations, useBranches, useRoles, useUsers } from '../hooks/useAdmin.js';

/**
 * Personal de la empresa.
 *
 * Un usuario no se borra: se desactiva. Sus ventas, ajustes y anulaciones siguen
 * llevando su nombre, y borrarlo dejaría el historial firmado por un fantasma.
 */
export function UsersPage() {
  const { can } = usePermission();
  const { user: me } = useSession();
  const { setUserStatus } = useAdminMutations();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [roleId, setRoleId] = useState('');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState(/** @type {any} */ (null));
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(/** @type {any} */ (null));

  const debouncedSearch = useDebounced(search, 300);

  const filters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: status || undefined,
      roleId: roleId || undefined,
      page,
      limit: 25,
    }),
    [debouncedSearch, status, roleId, page],
  );

  const { data, isPending, isError, error, refetch } = useUsers(filters);
  const { data: roles } = useRoles();
  const { data: branches } = useBranches();

  const rows = data?.items ?? [];
  const meta = data?.meta ?? {};

  const columns = [
    {
      key: 'name',
      header: 'Persona',
      render: (/** @type {any} */ row) => (
        <div>
          <p className="font-medium">
            {row.name}
            {row.id === me?.id && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">(usted)</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      render: (/** @type {any} */ row) => (
        <Badge variant="secondary">{row.role?.name ?? 'Sin rol'}</Badge>
      ),
    },
    {
      key: 'branches',
      header: 'Sucursales',
      render: (/** @type {any} */ row) =>
        row.allBranches ? (
          <span className="text-muted-foreground">Todas</span>
        ) : (
          <span>{row.branchIds.length}</span>
        ),
    },
    {
      key: 'lastLoginAt',
      header: 'Última entrada',
      render: (/** @type {any} */ row) =>
        row.lastLoginAt ? (
          <span className="text-sm">{formatDateTime(row.lastLoginAt)}</span>
        ) : (
          <span className="text-sm text-muted-foreground">Nunca</span>
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (/** @type {any} */ row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={row.isActive ? 'success' : 'secondary'}>{row.statusLabel}</Badge>
          {row.mustChangePassword && (
            <Badge variant="warning" title="Debe cambiar su contraseña al entrar">
              Clave temporal
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (/** @type {any} */ row) => (
        <div className="flex justify-end gap-1">
          {can('users:deactivate') && row.id !== me?.id && (
            <>
              <Button
                variant="ghost"
                size="sm"
                title="Restablecer contraseña"
                onClick={(/** @type {any} */ event) => {
                  event.stopPropagation();
                  setResetting(row);
                }}
              >
                <KeyRound aria-hidden="true" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                title={row.isActive ? 'Desactivar' : 'Reactivar'}
                onClick={async (/** @type {any} */ event) => {
                  event.stopPropagation();
                  await setUserStatus.mutateAsync({ id: row.id, active: !row.isActive });
                }}
              >
                <UserX aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Quién entra al sistema y qué puede hacer cada uno.
          </p>
        </div>

        {can('users:invite') && (
          <Button onClick={() => setCreating(true)}>
            <UserPlus aria-hidden="true" />
            Agregar persona
          </Button>
        )}
      </header>

      <Alert>
        <AlertDescription>
          Un usuario que ya no trabaja aquí se <strong>desactiva</strong>, no se borra: sus ventas y
          movimientos siguen llevando su nombre en el historial.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
        <div className="relative min-w-56 flex-1">
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
            placeholder="Buscar por nombre o correo…"
            className="pl-9"
            aria-label="Buscar usuarios"
          />
        </div>

        <Select
          value={roleId}
          onChange={(event) => {
            setRoleId(event.target.value);
            setPage(1);
          }}
          className="w-48"
          aria-label="Rol"
        >
          <option value="">Todos los roles</option>
          {(roles ?? []).map((/** @type {any} */ role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </Select>

        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="w-40"
          aria-label="Estado"
        >
          <option value="">Todos</option>
          <option value="ACTIVE">Activos</option>
          <option value="INACTIVE">Inactivos</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        onRowClick={(/** @type {any} */ row) => can('users:update') && setEditing(row)}
        emptyTitle="Sin usuarios"
        emptyDescription="Agregue a las personas que van a usar el sistema."
      />

      {meta.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
          <p className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages} · {meta.total} usuarios
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasPrev}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasNext}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente
            </Button>
          </div>
        </nav>
      )}

      <UserDialog
        open={creating || Boolean(editing)}
        onOpenChange={(/** @type {boolean} */ open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        user={editing}
        roles={roles ?? []}
        branches={branches ?? []}
        isSelf={editing?.id === me?.id}
      />

      <ResetPasswordDialog
        open={Boolean(resetting)}
        onOpenChange={(/** @type {boolean} */ open) => !open && setResetting(null)}
        user={resetting}
      />
    </div>
  );
}
