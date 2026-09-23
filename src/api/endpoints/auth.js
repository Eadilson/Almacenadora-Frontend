import { api, unwrap } from '../client.js';

/**
 * Endpoints de sesión.
 *
 * @typedef {object} SessionUser
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {{ id: string, key: string, name: string }} role
 * @property {string[]} permissions
 * @property {{ id: string, code: string, name: string, isDefault: boolean }[]} branches
 * @property {boolean} mustChangePassword
 * @property {string|null} lastLoginAt
 *
 * @typedef {object} SessionTenant
 * @property {string} id
 * @property {string} slug
 * @property {string} tradeName
 * @property {string} legalName
 * @property {string} currency
 * @property {string} timezone
 * @property {string} locale
 * @property {{ key: string, name: string }} plan
 * @property {string[]} features
 * @property {Record<string, unknown>} branding
 * @property {Record<string, unknown>} settings
 *
 * @typedef {object} Session
 * @property {string} [accessToken]
 * @property {number} [expiresIn]
 * @property {SessionUser} user
 * @property {SessionTenant} tenant
 */

export const authApi = {
  /**
   * @param {{ email: string, password: string, remember?: boolean }} credentials
   * @returns {Promise<Session>}
   */
  login: (credentials) => api.post('/auth/login', credentials).then(unwrap),

  /**
   * Perfil de la sesión actual. Se consulta al arrancar y tras renovar: refleja
   * cambios de rol o de plan sin esperar a que expire el token.
   *
   * @returns {Promise<{ user: SessionUser, tenant: SessionTenant }>}
   */
  profile: () => api.get('/auth/me').then(unwrap),

  /**
   * Cambia el propio nombre. El correo, el rol y las sucursales no se tocan por
   * aquí: el correo es la credencial de entrada, y el rol y las sucursales son
   * decisiones de Administración, no de la propia persona.
   *
   * @param {{ name: string }} payload
   * @returns {Promise<{ user: SessionUser, tenant: SessionTenant }>}
   */
  updateProfile: (payload) => api.patch('/auth/me', payload).then(unwrap),

  /**
   * @returns {Promise<{ revoked: boolean }>}
   */
  logout: () => api.post('/auth/logout').then(unwrap),

  /**
   * @returns {Promise<{ revoked: number }>}
   */
  logoutAll: () => api.post('/auth/logout-all').then(unwrap),
};

export const metaApi = {
  /**
   * Módulos disponibles en la API. Permite que la interfaz descubra qué hay
   * publicado en lugar de asumirlo.
   *
   * @returns {Promise<{ name: string, version: string, modules: Record<string, string> }>}
   */
  info: () => api.get('/').then(unwrap),
};
