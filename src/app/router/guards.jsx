import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { PageLoader } from '@/components/feedback/states.jsx';
import { Button } from '@/components/ui/button.jsx';

/**
 * Guardias de navegación.
 *
 * **No son seguridad**: impiden mostrar una pantalla, no acceder a los datos. El
 * servidor rechaza cualquier petición sin permiso aunque el usuario escriba la ruta
 * a mano (docs/04-multitenant-seguridad-auditoria.md §4.4).
 */

/**
 * Exige sesión activa.
 *
 * Mientras se rehidrata la sesión con la cookie de refresco se muestra un
 * indicador: redirigir en ese momento expulsaría al usuario en cada recarga.
 */
export function RequireAuth() {
  const { status, user } = useSession();
  const location = useLocation();

  if (status === 'loading') return <PageLoader label="Restaurando su sesión…" />;

  if (status === 'unauthenticated') {
    // Se recuerda a dónde quería ir para devolverlo ahí después de entrar.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  /**
   * Quien entra con una contraseña temporal va directo a cambiarla.
   *
   * No es una molestia gratuita: esa clave la eligió otra persona y se la dictó,
   * así que hasta que la cambie hay alguien más que puede entrar como él. Dejarlo
   * navegar con un «ya la cambiaré luego» convierte una medida temporal en
   * permanente.
   */
  if (user?.mustChangePassword && location.pathname !== '/cambiar-clave') {
    return <Navigate to="/cambiar-clave" replace />;
  }

  return <Outlet />;
}

/**
 * Impide volver al inicio de sesión con la sesión ya abierta.
 */
export function RequireGuest() {
  const { status } = useSession();

  if (status === 'loading') return <PageLoader label="Comprobando su sesión…" />;
  if (status === 'authenticated') return <Navigate to="/" replace />;

  return <Outlet />;
}

/**
 * Exige un permiso concreto para entrar en una sección.
 *
 * @param {{ permission: string, feature?: string }} props
 */
export function RequirePermission({ permission, feature }) {
  const { can, hasFeature } = useSession();

  const allowed = can(permission) && (!feature || hasFeature(feature));
  if (!allowed) return <AccessDenied />;

  return <Outlet />;
}

/**
 * Pantalla de acceso denegado.
 *
 * Explica qué falta y ofrece una salida, en lugar de dejar al usuario en un
 * callejón sin más información que «no autorizado».
 */
export function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <ShieldOff className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">No tiene acceso a esta sección</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Su rol no incluye los permisos necesarios. Si cree que debería tenerlos, solicítelo al
          administrador de su empresa.
        </p>
      </div>
      <Button variant="outline" asChild>
        <a href="/">Volver al panel</a>
      </Button>
    </div>
  );
}
