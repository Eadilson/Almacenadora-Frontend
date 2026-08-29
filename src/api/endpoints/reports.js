import { api, unwrap } from '../client.js';

/**
 * Endpoints de reportes.
 *
 * Los campos de costo, utilidad y margen **llegan solo si el usuario tiene el
 * permiso financiero**: el servidor los omite, no los enmascara. Por eso las
 * pantallas comprueban `if (data.totals.grossProfit)` en lugar de mirar permisos
 * por su cuenta — la respuesta ya es la verdad.
 */

/**
 * @param {Record<string, unknown>} filters
 * @returns {string}
 */
export function toQuery(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export const reportsApi = {
  /** @param {Record<string, unknown>} filters */
  dashboard: (filters = {}) => api.get(`/reports/dashboard?${toQuery(filters)}`).then(unwrap),

  /** @param {Record<string, unknown>} filters */
  sales: (filters = {}) => api.get(`/reports/sales?${toQuery(filters)}`).then(unwrap),

  /** @param {Record<string, unknown>} filters */
  inventory: (filters = {}) => api.get(`/reports/inventory?${toQuery(filters)}`).then(unwrap),

  /** @param {Record<string, unknown>} filters */
  profit: (filters = {}) => api.get(`/reports/profit?${toQuery(filters)}`).then(unwrap),

  /** @param {Record<string, unknown>} filters */
  rotation: (filters = {}) => api.get(`/reports/rotation?${toQuery(filters)}`).then(unwrap),

  /** @param {Record<string, unknown>} filters */
  customers: (filters = {}) => api.get(`/reports/customers?${toQuery(filters)}`).then(unwrap),

  /** @param {Record<string, unknown>} filters */
  purchases: (filters = {}) => api.get(`/reports/purchases?${toQuery(filters)}`).then(unwrap),

  /**
   * Descarga el Excel del reporte.
   *
   * Se pide con el cliente autenticado y se entrega como blob, en lugar de apuntar
   * un `<a href>` a la URL: el token va en la cabecera `Authorization`, y un
   * enlace corriente no la lleva —daría 401—. Meterlo en la cadena de consulta
   * para sortearlo lo dejaría escrito en el historial del navegador y en los
   * registros del servidor, que es peor que el inconveniente que resuelve.
   *
   * El objeto URL se revoca en cuanto se dispara la descarga: sin eso, cada
   * exportación deja el archivo retenido en memoria hasta recargar la página.
   *
   * @param {{ report: string, filters?: Record<string, unknown> }} params
   * @returns {Promise<void>}
   */
  download: async ({ report, filters = {} }) => {
    const response = await api.get(`/reports/${report}/export?${toQuery(filters)}`, {
      responseType: 'blob',
    });

    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? `${report}.xlsx`;

    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
