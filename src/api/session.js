/**
 * Token de acceso: **solo en memoria**.
 *
 * No se guarda en `localStorage` ni en `sessionStorage`. Un ataque de XSS puede
 * leer todo el almacenamiento del navegador, pero no una variable de módulo ni la
 * cookie `httpOnly` donde viaja el token de refresco. El coste es que al recargar
 * la página hay que renovar la sesión con esa cookie, y ese es exactamente el
 * flujo previsto (ADR-009).
 */

/** @type {string|null} */
let accessToken = null;

/** @type {Set<(authenticated: boolean) => void>} */
const listeners = new Set();

/**
 * @returns {string|null}
 */
export const getAccessToken = () => accessToken;

/**
 * @param {string|null} token
 * @returns {void}
 */
export function setAccessToken(token) {
  const changed = Boolean(accessToken) !== Boolean(token);
  accessToken = token;
  if (changed) {
    for (const listener of listeners) listener(Boolean(token));
  }
}

/**
 * @returns {void}
 */
export const clearAccessToken = () => setAccessToken(null);

/**
 * Permite que la aplicación reaccione cuando la sesión se pierde por una vía que
 * no pasó por la interfaz (por ejemplo, un refresco fallido).
 *
 * @param {(authenticated: boolean) => void} listener
 * @returns {() => void} Función para dejar de escuchar.
 */
export function onSessionChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
