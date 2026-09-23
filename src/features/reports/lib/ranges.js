import { localISODate } from '@/lib/format';

/**
 * Períodos de consulta de los reportes.
 *
 * Vive aparte del selector para que ese archivo exporte solo componentes: mezclar
 * constantes y funciones rompe la recarga en caliente de Vite.
 */

/** Atajos de período: cubren casi todo lo que alguien pregunta. */
export const PRESETS = [
  { key: '7d', label: 'Últimos 7 días', days: 7 },
  { key: '30d', label: 'Últimos 30 días', days: 30 },
  { key: '90d', label: 'Últimos 90 días', days: 90 },
  { key: 'month', label: 'Este mes' },
  { key: 'year', label: 'Este año' },
];

/**
 * Calcula el rango de un atajo.
 *
 * Las fechas se envían como `YYYY-MM-DD` y no como instante: el servidor las
 * interpreta en la zona horaria de la empresa, que es donde ocurre el corte de
 * medianoche que le importa al comerciante.
 *
 * @param {string} key
 * @returns {{ from: string, to: string }}
 */
export function rangeFor(key) {
  const today = new Date();
  const iso = localISODate;

  if (key === 'month') {
    return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
  }

  if (key === 'year') {
    return { from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(today) };
  }

  const preset = PRESETS.find((item) => item.key === key);
  const from = new Date(today);
  from.setDate(from.getDate() - ((preset?.days ?? 30) - 1));
  return { from: iso(from), to: iso(today) };
}
