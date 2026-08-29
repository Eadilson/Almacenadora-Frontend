import { useContext } from 'react';
import { SessionContext } from '@/app/contexts';

/**
 * Sesión activa: usuario, empresa, permisos y capacidades del plan.
 *
 * @returns {import('@/app/contexts').SessionContextValue}
 */
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession debe usarse dentro de <SessionProvider>.');
  }
  return context;
}
