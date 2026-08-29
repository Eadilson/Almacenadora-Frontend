/**
 * Único punto de acceso al almacenamiento persistente del navegador.
 *
 * Solo guarda **preferencias de interfaz**. Nunca credenciales: el token de acceso
 * vive en memoria y el de refresco en una cookie `httpOnly`, porque un ataque de
 * XSS puede leer todo el `localStorage` pero no una cookie marcada así (ADR-009).
 *
 * El acceso está centralizado aquí para que la regla de ESLint que prohíbe
 * `localStorage.setItem` en el resto del código pueda aplicarse sin excepciones
 * dispersas.
 */

const PREFIX = 'inventra.';

/** Claves permitidas. Una clave nueva se declara aquí, a la vista. */
export const StorageKeys = /** @type {const} */ ({
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebar',
  ACTIVE_BRANCH: 'branch',
  TABLE_DENSITY: 'density',
});

/**
 * @param {string} key
 * @param {string|null} [fallback]
 * @returns {string|null}
 */
export function readPreference(key, fallback = null) {
  try {
    return localStorage.getItem(`${PREFIX}${key}`) ?? fallback;
  } catch {
    // Modo privado o almacenamiento bloqueado: la aplicación debe seguir
    // funcionando, simplemente sin recordar preferencias.
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {string} value
 * @returns {void}
 */
export function writePreference(key, value) {
  try {
    localStorage.setItem(`${PREFIX}${key}`, value);
  } catch {
    /* sin persistencia disponible */
  }
}

/**
 * @param {string} key
 * @returns {void}
 */
export function removePreference(key) {
  try {
    localStorage.removeItem(`${PREFIX}${key}`);
  } catch {
    /* sin persistencia disponible */
  }
}
