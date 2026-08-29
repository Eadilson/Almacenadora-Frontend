import { api, unwrap } from '../client.js';

/**
 * Endpoints de inventario.
 *
 * @typedef {object} StockRow
 * @property {string} id
 * @property {string} productId
 * @property {string} branchId
 * @property {{ id: string, sku: string, name: string, attributes: Record<string, unknown>, salePrice: import('@/lib/money').MoneyDto }} product
 * @property {string} onHand
 * @property {string} available
 * @property {string} minStock
 * @property {boolean} belowMinimum
 * @property {import('@/lib/money').MoneyDto} [averageCost]
 * @property {import('@/lib/money').MoneyDto} [valuation]
 * @property {string|null} lastMovementAt
 *
 * @typedef {object} Movement
 * @property {string} id
 * @property {number} seq
 * @property {string} type
 * @property {string} typeLabel
 * @property {'IN'|'OUT'} direction
 * @property {string} quantity
 * @property {string} balanceAfter
 * @property {string|null} reason
 * @property {string} occurredAt
 * @property {import('@/lib/money').MoneyDto} [unitCost]
 */

/**
 * @param {Record<string, unknown>} filters
 * @returns {string}
 */
function toQuery(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export const inventoryApi = {
  /**
   * @param {Record<string, unknown>} filters
   * @returns {Promise<{ items: StockRow[], meta: Record<string, any> }>}
   */
  listStock: (filters = {}) =>
    api
      .get(`/stock?${toQuery(filters)}`)
      .then((response) => ({ items: response.data.data, meta: response.data.meta ?? {} })),

  /**
   * @param {string} [branchId]
   * @returns {Promise<{ belowMinimum: number, totalUnits: string, valuation?: import('@/lib/money').MoneyDto }>}
   */
  summary: (branchId) => api.get(`/stock/summary?${toQuery({ branchId })}`).then(unwrap),

  /**
   * Kardex de un producto: su saldo y el historial que lo explica.
   *
   * @param {string} productId
   * @param {Record<string, unknown>} filters
   */
  kardex: (productId, filters = {}) =>
    api
      .get(`/products/${productId}/kardex?${toQuery(filters)}`)
      .then((response) => ({ ...response.data.data, meta: response.data.meta ?? {} })),

  /**
   * @param {Record<string, unknown>} filters
   * @returns {Promise<{ items: any[], meta: Record<string, any> }>}
   */
  listMovements: (filters = {}) =>
    api
      .get(`/stock-movements?${toQuery(filters)}`)
      .then((response) => ({ items: response.data.data, meta: response.data.meta ?? {} })),

  /** @param {Record<string, unknown>} payload */
  openingBalance: (payload) => api.post('/stock-movements/opening', payload).then(unwrap),

  /** @param {Record<string, unknown>} payload */
  adjust: (payload) => api.post('/stock-movements/adjustment', payload).then(unwrap),

  /** @param {Record<string, unknown>} payload */
  registerLoss: (payload) => api.post('/stock-movements/loss', payload).then(unwrap),

  /** @param {{ movementId: string, reason: string }} params */
  correct: ({ movementId, reason }) =>
    api.post(`/stock-movements/${movementId}/correction`, { reason }).then(unwrap),
};
