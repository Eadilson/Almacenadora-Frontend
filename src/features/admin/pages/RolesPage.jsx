import { useState } from 'react';
import { Lock, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { ErrorState, PageLoader } from '@/components/feedback/states.jsx';
import { usePermission } from '@/hooks/usePermission';
import { RoleDialog } from '../components/RoleDialog.jsx';
import { useAdminMutations, usePermissionCatalog, useRoles } from '../hooks/useAdmin.js';

/**
 * Roles y permisos.
 *
 * El sistema nunca pregunta «¿es gerente?» sino «¿tiene permiso para anular una
 * venta?». Eso permite que cada comercio nombre los puestos como quiera sin tocar
 * el código, y es lo que hace esta pantalla útil en lugar de decorativa.
 */
export function RolesPage() {
  const { can } = usePermission();
  const { deleteRole } = useAdminMutations();

  const [editing, setEditing] = useState(/** @type {any} */ (null));
  const [creating, setCreating] = useState(false);

  const { data: roles, isPending, isError, error, refetch } = useRoles();
  const { data: catalog } = usePermissionCatalog();

  if (isPending) return <PageLoader label="Cargando roles…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const canManage = can('roles:manage');

  /**
   * @param {string[]} permissions
   * @returns {Record<string, number>}
   */
  const countByGroup = (permissions) => {
    /** @type {Record<string, number>} */
    const counts = {};

    for (const group of catalog ?? []) {
      const n = group.permissions.filter((/** @type {any} */ p) =>
        permissions.includes(p.key),
      ).length;
      if (n > 0) counts[group.label] = n;
    }

    return counts;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Roles y permisos</h1>
          <p className="text-sm text-muted-foreground">
            Qué puede hacer cada puesto. Los nombres los decide usted.
          </p>
        </div>

        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Crear rol
          </Button>
        )}
      </header>

      <Alert>
        <AlertDescription>
          Solo puede conceder permisos que usted mismo tenga. Los roles marcados con un candado
          vienen con el sistema y no se modifican: duplíquelos si necesita una variante.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        {(roles ?? []).map((/** @type {any} */ role) => {
          const groups = countByGroup(role.permissions);

          return (
            <Card key={role.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {role.name}
                      {role.isSystem && (
                        <Lock
                          className="size-3.5 text-muted-foreground"
                          aria-label="Rol del sistema"
                        />
                      )}
                    </CardTitle>
                    <CardDescription>
                      {role.description || 'Sin descripción.'}
                    </CardDescription>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    {canManage && role.editable && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(role)}>
                        Editar
                      </Button>
                    )}

                    {canManage && role.deletable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Eliminar"
                        onClick={async () => {
                          await deleteRole.mutateAsync(role.id);
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="secondary">
                    <ShieldCheck aria-hidden="true" />
                    {role.permissions.length} permisos
                  </Badge>
                  <span className="text-muted-foreground">
                    {role.userCount === 0
                      ? 'Nadie lo usa'
                      : `${role.userCount} usuario${role.userCount === 1 ? '' : 's'}`}
                  </span>
                </div>

                <ul className="flex flex-wrap gap-1.5">
                  {Object.entries(groups).map(([label, count]) => (
                    <li
                      key={label}
                      className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {label} <span className="tabular">{count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <RoleDialog
        open={creating || Boolean(editing)}
        onOpenChange={(/** @type {boolean} */ open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        role={editing}
        catalog={catalog ?? []}
      />
    </div>
  );
}
