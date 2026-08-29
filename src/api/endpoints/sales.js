import { api, unwrap } from '../client.js';

/**
 * Endpoints de ventas.
 *
 * @typedef {object} Customer
 * @property {string} id
 * @property {string} code
 * @property {string} name
 * @property {string|null} taxId
 * @property {{ enabled: boolean, limit: import('@/lib/money').MoneyDto, termDays: number }} credit
 * @property {string} status
 * @property {boolean} isActive
 *
 * @typedef {object} Sale
 * @property {string} id
 * @property {string} number
 * @property {string} type
 * @property {string} typeLabel
 * @property {string} status
 * @property {string} statusLabel
 * @property {any} customer
 * @property {any[]} lines
 * @property {import('@/lib/money').MoneyDto} total
 * @property {import('@/lib/money').MoneyDto} paidAmount
 * @property {import('@/lib/money').MoneyDto} creditAmount
 * @property {string|null} invoiceNumber
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

export const salesApi = {
  // ── Clientes ──────────────────────────────────────────────────────────────
  /**
   * @param {Record<string, unknown>} filters
   * @returns {Promise<{ items: Customer[], meta: Record<string, any> }>}
   */
  listCustomers: (filters = {}) =>
    api
      .get(`/customers?${toQuery(filters)}`)
      .then((response) => ({ items: response.data.data, meta: response.data.meta ?? {} })),

  /** @param {string} id @returns {Promise<Customer>} */
  getCustomer: (id) => api.get(`/customers/${id}`).then(unwrap),

  /** @param {Record<string, unknown>} payload @returns {Promise<Customer>} */
  createCustomer: (payload) => api.post('/customers', payload).then(unwrap),

  /** @param {{ id: string, changes: Record<string, unknown> }} params */
  updateCustomer: ({ id, changes }) => api.patch(`/customers/${id}`, changes).then(unwrap),

  // ── Ventas ────────────────────────────────────────────────────────────────
  /**
   * @param {Record<string, unknown>} filters
   * @returns {Promise<{ items: Sale[], meta: Record<string, any> }>}
   */
  listSales: (filters = {}) =>
    api
      .get(`/sales?${toQuery(filters)}`)
      .then((response) => ({ items: response.data.data, meta: response.data.meta ?? {} })),

  /** @param {string} id @returns {Promise<Sale>} */
  getSale: (id) => api.get(`/sales/${id}`).then(unwrap),

  /**
   * Confirma una venta.
   *
   * Envía `Idempotency-Key`: si la respuesta se pierde y el cajero reintenta, el
   * servidor devuelve la venta original en lugar de cobrar dos veces. La clave la
   * genera el cliente **una vez por intento de venta**, no por reintento.
   *
   * @param {{ payload: Record<string, unknown>, idempotencyKey: string }} params
   */
  createSale: ({ payload, idempotencyKey }) =>
    api.post('/sales', payload, { headers: { 'Idempotency-Key': idempotencyKey } }).then(unwrap),

  /** @param {{ id: string, reason: string }} params */
  voidSale: ({ id, reason }) => api.post(`/sales/${id}/void`, { reason }).then(unwrap),

  /**
   * Devuelve parte o todo lo vendido.
   *
   * A diferencia de anular, la factura sigue siendo válida por lo que sí se
   * quedó el cliente: esto emite una nota de crédito aparte.
   *
   * @param {{ id: string, reason: string, lines: { productId: string, quantity: string }[] }} params
   */
  returnSale: ({ id, reason, lines }) =>
    api.post(`/sales/${id}/return`, { reason, lines }).then(unwrap),

  /** @param {Record<string, unknown>} filters */
  summary: (filters = {}) => api.get(`/sales/summary?${toQuery(filters)}`).then(unwrap),
};
