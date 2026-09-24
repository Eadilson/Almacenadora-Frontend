/**
 * Claves de TanStack Query, centralizadas.
 *
 * Dispersar las claves por los componentes es la causa habitual de datos obsoletos
 * en pantalla: una mutación invalida `['products']` mientras la lista se registró
 * como `['product-list']`, y el usuario ve información vieja sin que nada falle de
 * forma visible. Con un único catálogo, la invalidación es verificable de un
 * vistazo.
 *
 * Jerarquía: invalidar `queryKeys.products.all` alcanza a listas y detalles.
 */
export const queryKeys = {
  session: {
    profile: ['session', 'profile'],
  },
  meta: {
    apiInfo: ['meta', 'api-info'],
    health: ['meta', 'health'],
  },
  products: {
    all: ['products'],
    list: (/** @type {Record<string, unknown>} */ filters) => ['products', 'list', filters],
    detail: (/** @type {string} */ id) => ['products', 'detail', id],
  },
  categories: {
    all: ['categories'],
    tree: ['categories', 'tree'],
    attributes: (/** @type {string} */ id) => ['categories', id, 'attributes'],
  },
  units: {
    all: ['units'],
  },
  suppliers: {
    all: ['suppliers'],
    detail: (/** @type {string} */ id) => ['suppliers', 'detail', id],
  },
  purchaseOrders: {
    all: ['purchase-orders'],
    list: (/** @type {Record<string, unknown>} */ filters) => ['purchase-orders', 'list', filters],
    detail: (/** @type {string} */ id) => ['purchase-orders', 'detail', id],
  },
  stock: {
    all: ['stock'],
    byProduct: (/** @type {string} */ id) => ['stock', 'product', id],
    low: ['stock', 'low'],
    movements: (/** @type {Record<string, unknown>} */ filters) => ['stock', 'movements', filters],
  },
  customers: {
    all: ['customers'],
    list: (/** @type {Record<string, unknown>} */ filters) => ['customers', 'list', filters],
    detail: (/** @type {string} */ id) => ['customers', 'detail', id],
    account: (/** @type {string} */ id) => ['customers', id, 'account'],
  },
  sales: {
    all: ['sales'],
    list: (/** @type {Record<string, unknown>} */ filters) => ['sales', 'list', filters],
    detail: (/** @type {string} */ id) => ['sales', 'detail', id],
  },
  credit: {
    all: ['credit'],
    portfolio: (/** @type {Record<string, unknown>} */ filters) => ['credit', 'portfolio', filters],
    aging: ['credit', 'aging'],
    account: (/** @type {string} */ customerId) => ['credit', 'account', customerId],
    statement: (
      /** @type {string} */ customerId,
      /** @type {Record<string, unknown>} */ filters,
    ) => ['credit', 'statement', customerId, filters],
  },
  payments: {
    all: ['payments'],
    list: (/** @type {Record<string, unknown>} */ filters) => ['payments', 'list', filters],
    detail: (/** @type {string} */ id) => ['payments', 'detail', id],
  },
  cash: {
    all: ['cash'],
    current: (/** @type {string} */ branchId) => ['cash', 'current', branchId],
    list: (/** @type {Record<string, unknown>} */ filters) => ['cash', 'list', filters],
    detail: (/** @type {string} */ id, /** @type {Record<string, unknown>} */ filters) => [
      'cash',
      'detail',
      id,
      filters,
    ],
  },
  reports: {
    all: ['reports'],
    dashboard: (/** @type {Record<string, unknown>} */ range) => ['reports', 'dashboard', range],
    detail: (/** @type {string} */ report, /** @type {Record<string, unknown>} */ filters) => [
      'reports',
      report,
      filters,
    ],
  },
  users: {
    all: ['users'],
    list: (/** @type {Record<string, unknown>} */ filters) => ['users', 'list', filters],
    detail: (/** @type {string} */ id) => ['users', 'detail', id],
  },
  roles: {
    all: ['roles'],
    permissions: ['roles', 'permissions'],
  },
  branches: {
    all: ['branches'],
  },
  company: {
    settings: ['company', 'settings'],
  },
};
