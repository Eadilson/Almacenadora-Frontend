import { api, unwrap, unwrapPage } from '../client.js';

/**
 * Endpoints de administración: usuarios, roles, sucursales y configuración.
 *
 * @typedef {object} UserDto
 * @property {string} id
 * @property {string} email
 * @property {string} name
 * @property {string} roleId
 * @property {{ id: string, key: string, name: string }|null} role
 * @property {string[]} branchIds
 * @property {boolean} allBranches
 * @property {string} status
 * @property {string} statusLabel
 * @property {boolean} isActive
 * @property {boolean} mustChangePassword
 * @property {string|null} lastLoginAt
 *
 * @typedef {object} RoleDto
 * @property {string} id
 * @property {string} key
 * @property {string} name
 * @property {string} description
 * @property {string[]} permissions
 * @property {boolean} isSystem
 * @property {number} userCount
 * @property {boolean} editable
 * @property {boolean} deletable
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

export const adminApi = {
  // ── Usuarios ──────────────────────────────────────────────────────────────
  /** @param {Record<string, unknown>} filters */
  listUsers: (filters = {}) => api.get(`/users?${toQuery(filters)}`).then(unwrapPage),

  /** @param {Record<string, unknown>} payload */
  createUser: (payload) => api.post('/users', payload).then(unwrap),

  /** @param {{ id: string, changes: Record<string, unknown> }} params */
  updateUser: ({ id, changes }) => api.patch(`/users/${id}`, changes).then(unwrap),

  /** @param {{ id: string, active: boolean }} params */
  setUserStatus: ({ id, active }) => api.post(`/users/${id}/status`, { active }).then(unwrap),

  /** @param {{ id: string, temporaryPassword: string }} params */
  resetPassword: ({ id, temporaryPassword }) =>
    api.post(`/users/${id}/reset-password`, { temporaryPassword }).then(unwrap),

  // ── Roles ─────────────────────────────────────────────────────────────────
  listRoles: () => api.get('/roles').then(unwrap),

  permissions: () => api.get('/roles/permissions').then(unwrap),

  /** @param {Record<string, unknown>} payload */
  createRole: (payload) => api.post('/roles', payload).then(unwrap),

  /** @param {{ id: string, changes: Record<string, unknown> }} params */
  updateRole: ({ id, changes }) => api.patch(`/roles/${id}`, changes).then(unwrap),

  /** @param {string} id */
  deleteRole: (id) => api.delete(`/roles/${id}`).then(unwrap),

  // ── Sucursales ────────────────────────────────────────────────────────────
  listBranches: () => api.get('/branches').then(unwrap),

  /** @param {Record<string, unknown>} payload */
  createBranch: (payload) => api.post('/branches', payload).then(unwrap),

  /** @param {{ id: string, changes: Record<string, unknown> }} params */
  updateBranch: ({ id, changes }) => api.patch(`/branches/${id}`, changes).then(unwrap),

  // ── Empresa ───────────────────────────────────────────────────────────────
  company: () => api.get('/settings/company').then(unwrap),

  /** @param {Record<string, unknown>} changes */
  updateCompany: (changes) => api.patch('/settings/company', changes).then(unwrap),

  // ── Contraseña propia ─────────────────────────────────────────────────────
  /** @param {{ currentPassword: string, newPassword: string }} payload */
  changePassword: (payload) => api.post('/auth/change-password', payload).then(unwrap),
};
