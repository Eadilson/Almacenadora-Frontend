import { api, unwrap, unwrapPage } from '../client.js';

/**
 * Endpoints de crédito y cartera.
 *
 * @typedef {object} AccountDto
 * @property {string} id
 * @property {string} customerId
 * @property {import('@/lib/money').MoneyDto} balance
 * @property {import('@/lib/money').MoneyDto} creditLimit
 * @property {import('@/lib/money').MoneyDto} availableCredit
 * @property {import('@/lib/money').MoneyDto} overdueAmount
 * @property {import('@/lib/money').MoneyDto} unappliedCredit
 * @property {string|null} oldestDueDate
 * @property {string|null} lastPaymentAt
 * @property {string} status
 * @property {string} statusLabel
 * @property {boolean} isSettled
 * @property {{ key: string, label: string, amount: import('@/lib/money').MoneyDto }[]} aging
 *
 * @typedef {object} OpenDocumentDto
 * @property {string} id
 * @property {string|null} docNumber
 * @property {string} entryDate
 * @property {string|null} dueDate
 * @property {import('@/lib/money').MoneyDto} amount
 * @property {import('@/lib/money').MoneyDto} outstanding
 * @property {string} status
 * @property {string} statusLabel
 * @property {boolean} isOverdue
 * @property {number} daysOverdue
 *
 * @typedef {object} PaymentDto
 * @property {string} id
 * @property {string} number
 * @property {string} customerId
 * @property {string} receivedAt
 * @property {string} method
 * @property {string} methodLabel
 * @property {import('@/lib/money').MoneyDto} amount
 * @property {import('@/lib/money').MoneyDto} appliedAmount
 * @property {import('@/lib/money').MoneyDto} unappliedAmount
 * @property {string} status
 * @property {string} statusLabel
 * @property {boolean} isVoided
 * @property {any[]} allocations
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

export const creditApi = {
  /** @param {Record<string, unknown>} filters */
  listPortfolio: (filters = {}) =>
    api.get(`/customer-accounts?${toQuery(filters)}`).then(unwrapPage),

  aging: () => api.get('/customer-accounts/aging').then(unwrap),

  /** @param {string} customerId */
  account: (customerId) => api.get(`/customer-accounts/${customerId}`).then(unwrap),

  /**
   * @param {string} customerId
   * @param {Record<string, unknown>} filters
   */
  statement: (customerId, filters = {}) =>
    api.get(`/customer-accounts/${customerId}/statement?${toQuery(filters)}`).then(unwrap),

  /**
   * @param {{ customerId: string, changes: Record<string, unknown> }} params
   */
  updatePolicy: ({ customerId, changes }) =>
    api.patch(`/customer-accounts/${customerId}/credit`, changes).then(unwrap),

  /** @param {Record<string, unknown>} filters */
  listPayments: (filters = {}) => api.get(`/payments?${toQuery(filters)}`).then(unwrapPage),

  /** @param {string} id */
  payment: (id) => api.get(`/payments/${id}`).then(unwrap),

  /**
   * Registra un abono.
   *
   * La clave de idempotencia la genera la pantalla al abrir el cobro, no en cada
   * envío: es lo que hace que pulsar dos veces registre un abono y no dos.
   *
   * @param {{ payload: Record<string, unknown>, idempotencyKey: string }} params
   */
  registerPayment: ({ payload, idempotencyKey }) =>
    api.post('/payments', payload, { headers: { 'Idempotency-Key': idempotencyKey } }).then(unwrap),

  /** @param {{ id: string, reason: string }} params */
  voidPayment: ({ id, reason }) => api.post(`/payments/${id}/void`, { reason }).then(unwrap),
};
