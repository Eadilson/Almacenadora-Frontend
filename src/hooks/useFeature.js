import { useSession } from './useSession.js';

/**
 * Comprueba las capacidades incluidas en el plan de la empresa.
 *
 * Se usa para no ofrecer funciones que el plan no incluye —y para invitar a
 * mejorarlo—, no para impedirlas: el servidor rechaza la petición con
 * `FEATURE_NOT_AVAILABLE` aunque el cliente la construya a mano.
 *
 * @returns {{ hasFeature: (feature: string) => boolean, plan: { key: string, name: string }|null }}
 */
export function useFeature() {
  const { hasFeature, tenant } = useSession();
  return { hasFeature, plan: tenant?.plan ?? null };
}
