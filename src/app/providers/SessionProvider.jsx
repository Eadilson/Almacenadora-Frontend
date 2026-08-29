import { useCallback, useEffect, useMemo, useState } from 'react';
import { SessionContext } from '@/app/contexts';
import { authApi } from '@/api/endpoints/auth';
import { refreshSession } from '@/api/client';
import { clearAccessToken, onSessionChange, setAccessToken } from '@/api/session';
import { configureFormatting } from '@/lib/format';
import { StorageKeys, readPreference, writePreference } from '@/lib/storage';

/**
 * Sesión de la aplicación.
 *
 * Al arrancar intenta renovar con la cookie `httpOnly`: es lo que permite que
 * recargar la página no expulse al usuario, sin necesidad de guardar el token en
 * `localStorage` —donde un XSS lo leería—. Si no hay cookie válida, el arranque
 * termina en «no autenticado» sin mostrar ningún error, porque no lo es.
 */
export function SessionProvider({ children }) {
  /** @type {[import('@/app/contexts').SessionStatus, Function]} */
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [activeBranchId, setActiveBranchId] = useState(() =>
    readPreference(StorageKeys.ACTIVE_BRANCH),
  );

  /**
   * Aplica los datos de la empresa al formato de fechas y números.
   *
   * Se hace en un solo lugar para que toda la aplicación muestre las fechas en la
   * zona horaria de la empresa y no en la del navegador: un usuario que consulta
   * desde otro país debe ver las mismas fechas que sus compañeros.
   */
  const applySession = useCallback(
    (session) => {
      setUser(session.user);
      setTenant(session.tenant);
      configureFormatting({
        timezone: session.tenant?.timezone,
        locale: session.tenant?.locale ? `${session.tenant.locale}` : undefined,
      });

      const branches = session.user?.branches ?? [];
      const stored = readPreference(StorageKeys.ACTIVE_BRANCH);
      const valid = branches.some((branch) => branch.id === stored);
      const next = valid ? stored : (branches.find((b) => b.isDefault) ?? branches[0])?.id ?? null;

      setActiveBranchId(next);
      if (next) writePreference(StorageKeys.ACTIVE_BRANCH, next);
      setStatus('authenticated');
    },
    [],
  );

  const clearSession = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setTenant(null);
    setStatus('unauthenticated');
  }, []);

  // Rehidratación al cargar la aplicación.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await refreshSession();
      if (cancelled) return;

      if (!token) {
        setStatus('unauthenticated');
        return;
      }

      try {
        const profile = await authApi.profile();
        if (!cancelled) applySession(profile);
      } catch {
        // El token se renovó pero el perfil falló: la sesión no es utilizable.
        if (!cancelled) clearSession();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  // La sesión también puede perderse fuera de la interfaz: un refresco fallido
  // durante una consulta cualquiera. Este suscriptor mantiene sincronizado el
  // estado visible con el real.
  useEffect(
    () =>
      onSessionChange((authenticated) => {
        if (!authenticated) {
          setUser(null);
          setTenant(null);
          setStatus('unauthenticated');
        }
      }),
    [],
  );

  const login = useCallback(
    async (credentials) => {
      const session = await authApi.login(credentials);
      setAccessToken(session.accessToken ?? null);
      applySession(session);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // El cierre local ocurre siempre, incluso si la petición falla: dejar al
      // usuario dentro porque el servidor no respondió sería peor.
      clearSession();
    }
  }, [clearSession]);

  const reload = useCallback(async () => {
    const profile = await authApi.profile();
    applySession(profile);
  }, [applySession]);

  const setActiveBranch = useCallback((branchId) => {
    setActiveBranchId(branchId);
    writePreference(StorageKeys.ACTIVE_BRANCH, branchId);
  }, []);

  const can = useCallback(
    (permission) => Boolean(user?.permissions?.includes(permission)),
    [user],
  );

  const hasFeature = useCallback(
    (feature) => Boolean(tenant?.features?.includes(feature)),
    [tenant],
  );

  const value = useMemo(
    () => ({
      status,
      user,
      tenant,
      login,
      logout,
      reload,
      can,
      hasFeature,
      activeBranchId,
      setActiveBranch,
    }),
    [status, user, tenant, login, logout, reload, can, hasFeature, activeBranchId, setActiveBranch],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
