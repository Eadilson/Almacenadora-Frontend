import { useSession } from './useSession.js';

/**
 * Comprueba permisos del usuario.
 *
 * **Esto no es un control de acceso.** Sirve para no mostrar acciones que el
 * usuario no puede ejecutar, lo que mejora la experiencia; la decisión real la toma
 * el servidor en cada petición. Ocultar un botón nunca protege un endpoint
 * (docs/04-multitenant-seguridad-auditoria.md §4.4).
 *
 * Se pregunta siempre por **permisos**, jamás por el nombre del rol: los roles son
 * configurables por cada empresa y un `role === 'ADMIN'` en el cliente se rompe en
 * cuanto un cliente renombra o duplica un rol.
 *
 * @returns {{ can: (permission: string) => boolean, canAny: (permissions: string[]) => boolean, canAll: (permissions: string[]) => boolean }}
 */
export function usePermission() {
  const { can } = useSession();

  return {
    can,
    canAny: (permissions) => permissions.some(can),
    canAll: (permissions) => permissions.every(can),
  };
}
