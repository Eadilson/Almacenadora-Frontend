import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/endpoints/admin';
import { queryKeys } from '@/api/queryKeys';
import { useToast } from '@/hooks/useToast';

/**
 * Datos de administración.
 *
 * Cambiar un rol altera lo que sus usuarios pueden hacer, y el perfil de la sesión
 * lleva los permisos ya resueltos. Por eso las mutaciones invalidan también la
 * sesión: si no, quien acaba de recibir un permiso seguiría sin ver el menú
 * correspondiente hasta volver a entrar.
 */

/**
 * @param {Record<string, unknown>} filters
 */
export function useUsers(filters = {}) {
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: () => adminApi.listUsers(filters),
    placeholderData: (previous) => previous,
  });
}

export function useRoles() {
  return useQuery({ queryKey: queryKeys.roles.all, queryFn: () => adminApi.listRoles() });
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: queryKeys.roles.permissions,
    queryFn: () => adminApi.permissions(),
    // El catálogo solo cambia al desplegar una versión nueva del servidor.
    staleTime: 30 * 60 * 1000,
  });
}

export function useBranches() {
  return useQuery({ queryKey: queryKeys.branches.all, queryFn: () => adminApi.listBranches() });
}

export function useCompany() {
  return useQuery({ queryKey: queryKeys.company.settings, queryFn: () => adminApi.company() });
}

/**
 * @returns {Record<string, any>}
 */
export function useAdminMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.company.settings });
    void queryClient.invalidateQueries({ queryKey: queryKeys.session.profile });
  };

  /** @param {any} error */
  const onFail = (error) => {
    if (error.isValidation) return;
    toast({ variant: 'destructive', title: error.message });
  };

  return {
    createUser: useMutation({
      mutationFn: adminApi.createUser,
      onSuccess: (user) => {
        invalidate();
        toast({
          variant: 'success',
          title: `${user.name} ya puede entrar`,
          description: 'Entréguele la contraseña temporal: el sistema le pedirá cambiarla.',
        });
      },
      onError: onFail,
    }),

    updateUser: useMutation({
      mutationFn: adminApi.updateUser,
      onSuccess: () => {
        invalidate();
        toast({ variant: 'success', title: 'Usuario actualizado' });
      },
      onError: onFail,
    }),

    setUserStatus: useMutation({
      mutationFn: adminApi.setUserStatus,
      onSuccess: (user) => {
        invalidate();
        toast({
          variant: 'success',
          title: user.isActive ? `${user.name} reactivado` : `${user.name} desactivado`,
          description: user.isActive ? undefined : 'Sus sesiones abiertas se cerraron.',
        });
      },
      onError: onFail,
    }),

    resetPassword: useMutation({
      mutationFn: adminApi.resetPassword,
      onSuccess: () => {
        invalidate();
        toast({
          variant: 'success',
          title: 'Contraseña restablecida',
          description: 'Entréguela en persona: el sistema pedirá cambiarla al entrar.',
        });
      },
      onError: onFail,
    }),

    createRole: useMutation({
      mutationFn: adminApi.createRole,
      onSuccess: (role) => {
        invalidate();
        toast({ variant: 'success', title: `Rol «${role.name}» creado` });
      },
      onError: onFail,
    }),

    updateRole: useMutation({
      mutationFn: adminApi.updateRole,
      onSuccess: (role) => {
        invalidate();
        toast({
          variant: 'success',
          title: `Rol «${role.name}» actualizado`,
          description:
            role.userCount > 0
              ? `Afecta a ${role.userCount} usuario(s) desde su próxima petición.`
              : undefined,
        });
      },
      onError: onFail,
    }),

    deleteRole: useMutation({
      mutationFn: adminApi.deleteRole,
      onSuccess: () => {
        invalidate();
        toast({ variant: 'success', title: 'Rol eliminado' });
      },
      onError: onFail,
    }),

    createBranch: useMutation({
      mutationFn: adminApi.createBranch,
      onSuccess: (branch) => {
        invalidate();
        toast({ variant: 'success', title: `Sucursal «${branch.name}» creada` });
      },
      onError: onFail,
    }),

    updateBranch: useMutation({
      mutationFn: adminApi.updateBranch,
      onSuccess: () => {
        invalidate();
        toast({ variant: 'success', title: 'Sucursal actualizada' });
      },
      onError: onFail,
    }),

    updateCompany: useMutation({
      mutationFn: adminApi.updateCompany,
      onSuccess: () => {
        invalidate();
        toast({ variant: 'success', title: 'Configuración guardada' });
      },
      onError: onFail,
    }),

    changePassword: useMutation({
      mutationFn: adminApi.changePassword,
      onError: onFail,
    }),
  };
}
