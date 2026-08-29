import { api, unwrap } from '../client.js';

/**
 * Endpoints del catálogo.
 *
 * @typedef {object} AttributeDefinition
 * @property {string} key
 * @property {string} label
 * @property {'STRING'|'NUMBER'|'DECIMAL'|'BOOLEAN'|'DATE'|'ENUM'|'MULTI_ENUM'} type
 * @property {boolean} required
 * @property {string[]} options
 * @property {string|null} unit
 * @property {number|null} scale
 * @property {boolean} filterable
 * @property {boolean} showInList
 * @property {number} order
 * @property {string|null} helpText
 *
 * @typedef {object} Category
 * @property {string} id
 * @property {string} name
 * @property {string|null} parentId
 * @property {'NONE'|'LOT'|'SERIAL'} trackingMode
 * @property {boolean} isActive
 * @property {number|null} productCount
 * @property {AttributeDefinition[]} attributes
 *
 * @typedef {object} Unit
 * @property {string} id
 * @property {string} code
 * @property {string} name
 * @property {number} decimalPlaces
 * @property {boolean} isDiscrete
 * @property {boolean} isActive
 *
 * @typedef {object} Product
 * @property {string} id
 * @property {string} sku
 * @property {string[]} barcodes
 * @property {string} name
 * @property {string} description
 * @property {string} categoryId
 * @property {string|null} brand
 * @property {string} unitId
 * @property {Record<string, unknown>} attributes
 * @property {import('@/lib/money').MoneyDto} salePrice
 * @property {import('@/lib/money').MoneyDto} [cost]
 * @property {import('@/lib/money').MoneyDto} [grossProfit]
 * @property {number|null} [marginBasisPoints]
 * @property {boolean} [sellsBelowCost]
 * @property {string} minStock
 * @property {boolean} isActive
 */

export const catalogApi = {
  // ── Unidades ──────────────────────────────────────────────────────────────
  /** @returns {Promise<Unit[]>} */
  listUnits: () => api.get('/units').then(unwrap),

  /** @param {{ code: string, name: string, decimalPlaces: number }} payload @returns {Promise<Unit>} */
  createUnit: (payload) => api.post('/units', payload).then(unwrap),

  // ── Categorías ────────────────────────────────────────────────────────────
  /** @returns {Promise<Category[]>} */
  listCategories: () => api.get('/categories').then(unwrap),

  /** @param {string} id @returns {Promise<Category>} */
  getCategory: (id) => api.get(`/categories/${id}`).then(unwrap),

  /** @param {Record<string, unknown>} payload @returns {Promise<Category>} */
  createCategory: (payload) => api.post('/categories', payload).then(unwrap),

  /** @param {{ id: string, changes: Record<string, unknown> }} params @returns {Promise<Category>} */
  updateCategory: ({ id, changes }) => api.patch(`/categories/${id}`, changes).then(unwrap),

  /** @param {string} id @returns {Promise<Category>} */
  deactivateCategory: (id) => api.delete(`/categories/${id}`).then(unwrap),

  /**
   * Definiciones de atributo de una categoría.
   *
   * Es la llamada que hace posible el formulario dinámico: con su respuesta se
   * construyen los campos **y** su validación, desde la misma fuente que valida el
   * servidor, de modo que ambos lados no puedan divergir.
   *
   * @param {string} id
   * @returns {Promise<{ categoryId: string, categoryName: string, trackingMode: string, attributes: AttributeDefinition[] }>}
   */
  getCategoryAttributes: (id) => api.get(`/categories/${id}/attributes`).then(unwrap),

  /** @param {{ categoryId: string, definition: Record<string, unknown> }} params */
  addAttribute: ({ categoryId, definition }) =>
    api.post(`/categories/${categoryId}/attributes`, { definition }).then(unwrap),

  /** @param {{ categoryId: string, key: string, changes: Record<string, unknown> }} params */
  updateAttribute: ({ categoryId, key, changes }) =>
    api.patch(`/categories/${categoryId}/attributes/${key}`, changes).then(unwrap),

  /** @param {{ categoryId: string, key: string }} params */
  removeAttribute: ({ categoryId, key }) =>
    api.delete(`/categories/${categoryId}/attributes/${key}`).then(unwrap),

  // ── Productos ─────────────────────────────────────────────────────────────
  /**
   * Los filtros por atributo viajan con el prefijo `attr_`. El servidor exige
   * `categoryId` cuando se usan: sin saber la categoría no puede saber qué
   * atributos existen ni cuáles están indexados.
   *
   * @param {Record<string, unknown>} filters
   * @returns {Promise<{ items: Product[], meta: Record<string, any> }>}
   */
  searchProducts: (filters = {}) => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;
      if (key === 'attributes') {
        for (const [attribute, attributeValue] of Object.entries(
          /** @type {Record<string, unknown>} */ (value),
        )) {
          if (attributeValue) params.set(`attr_${attribute}`, String(attributeValue));
        }
        continue;
      }
      params.set(key, String(value));
    }

    return api
      .get(`/products?${params.toString()}`)
      .then((response) => ({ items: response.data.data, meta: response.data.meta ?? {} }));
  },

  /** @param {string} id @returns {Promise<Product>} */
  getProduct: (id) => api.get(`/products/${id}`).then(unwrap),

  /** @param {string} barcode @returns {Promise<Product>} */
  findByBarcode: (barcode) => api.get(`/products/barcode/${barcode}`).then(unwrap),

  /** @param {Record<string, unknown>} payload @returns {Promise<Product>} */
  createProduct: (payload) => api.post('/products', payload).then(unwrap),

  /** @param {{ id: string, changes: Record<string, unknown> }} params @returns {Promise<Product>} */
  updateProduct: ({ id, changes }) => api.patch(`/products/${id}`, changes).then(unwrap),

  /** @param {string} id @returns {Promise<Product>} */
  deactivateProduct: (id) => api.delete(`/products/${id}`).then(unwrap),
};
