import { api, unwrap } from '../client.js';

/**
 * Endpoints de compras.
 *
 * @typedef {object} Supplier
 * @property {string} id
 * @property {string} code
 * @property {string} name
 * @property {string|null} taxId
 * @property {string|null} email
 * @property {string|null} phone
 * @property {number} paymentTermDays
 * @property {boolean} sellsOnCredit
 * @property {boolean} isActive
 *
 * @typedef {object} PurchaseOrder
 * @property {string} id
 * @property {string} number
 * @property {string} status
 * @property {string} statusLabel
 * @property {{ name: string, code: string }} supplier
 * @property {any[]} lines
 * @property {import('@/lib/money').MoneyDto} subtotal
 * @property {import('@/lib/money').MoneyDto} additionalCostsTotal
 * @property {import('@/lib/money').MoneyDto} total
 * @property {boolean} isReceivable
 * @property {number} pendingLines
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

export const purchasingApi = {
  // ── Proveedores ───────────────────────────────────────────────────────────
  /**
   * @param {Record<string, unknown>} filters
   * @returns {Promise<{ items: Supplier[], meta: Record<string, any> }>}
   */
  listSuppliers: (filters = {}) =>
    api
      .get(`/suppliers?${toQuery(filters)}`)
      .then((response) => ({ items: response.data.data, meta: response.data.meta ?? {} })),

  /** @param {string} id @returns {Promise<Supplier>} */
  getSupplier: (id) => api.get(`/suppliers/${id}`).then(unwrap),

  /** @param {Record<string, unknown>} payload @returns {Promise<Supplier>} */
  createSupplier: (payload) => api.post('/suppliers', payload).then(unwrap),

  /** @param {{ id: string, changes: Record<string, unknown> }} params */
  updateSupplier: ({ id, changes }) => api.patch(`/suppliers/${id}`, changes).then(unwrap),

  /** @param {string} id */
  deactivateSupplier: (id) => api.delete(`/suppliers/${id}`).then(unwrap),

  // ── Órdenes ───────────────────────────────────────────────────────────────
  /**
   * @param {Record<string, unknown>} filters
   * @returns {Promise<{ items: PurchaseOrder[], meta: Record<string, any> }>}
   */
  listOrders: (filters = {}) =>
    api
      .get(`/purchase-orders?${toQuery(filters)}`)
      .then((response) => ({ items: response.data.data, meta: response.data.meta ?? {} })),

  /** @param {string} id @returns {Promise<PurchaseOrder>} */
  getOrder: (id) => api.get(`/purchase-orders/${id}`).then(unwrap),

  /** @param {Record<string, unknown>} payload @returns {Promise<PurchaseOrder>} */
  createOrder: (payload) => api.post('/purchase-orders', payload).then(unwrap),

  /** @param {string} id */
  confirmOrder: (id) => api.post(`/purchase-orders/${id}/confirm`).then(unwrap),

  /** @param {{ id: string, reason: string }} params */
  cancelOrder: ({ id, reason }) => api.post(`/purchase-orders/${id}/cancel`, { reason }).then(unwrap),

  /**
   * Recepción de mercancía: entra al inventario y recalcula el costo promedio.
   *
   * @param {{ id: string, lines: { productId: string, quantity: string }[], notes?: string }} params
   */
  receive: ({ id, lines, notes }) =>
    api.post(`/purchase-orders/${id}/receipts`, { lines, notes }).then(unwrap),
};
