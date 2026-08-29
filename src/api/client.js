import axios from 'axios';
import { ApiError } from './ApiError.js';
import { clearAccessToken, getAccessToken, setAccessToken } from './session.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/**
 * Cliente HTTP de la aplicación.
 *
 * `withCredentials` es obligatorio: sin él el navegador no envía la cookie
 * `httpOnly` del token de refresco y la sesión no se puede renovar.
 */
export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

/** Rutas que no deben provocar un intento de renovación. */
const AUTH_ROUTES = ['/auth/login', '/auth/refresh', '/auth/logout'];

/** @type {Promise<string|null>|null} */
let refreshInFlight = null;

/**
 * Renueva la sesión, garantizando **una sola** petición simultánea.
 *
 * Sin este candado, si cinco consultas fallan a la vez por token expirado —lo
 * habitual al volver a una pestaña olvidada— se dispararían cinco renovaciones
 * en paralelo. Como el refresco es rotativo y detecta reutilización, cuatro de
 * ellas presentarían un token ya rotado y el servidor cerraría todas las sesiones
 * del usuario por sospecha de robo. El candado convierte ese fallo garantizado en
 * una única renovación compartida.
 *
 * @returns {Promise<string|null>}
 */
function refreshSession() {
  refreshInFlight ??= axios
    .post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
    .then((response) => {
      const token = response.data?.data?.accessToken ?? null;
      setAccessToken(token);
      return token;
    })
    .catch(() => {
      clearAccessToken();
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Identificador de correlación generado en el cliente: permite rastrear en los
  // registros del servidor exactamente la petición que el usuario reportó.
  config.headers['X-Request-Id'] ??= crypto.randomUUID();
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config ?? {};
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const isAuthRoute = AUTH_ROUTES.some((route) => String(config.url ?? '').includes(route));

    // Se renueva solo cuando el token expiró, no ante cualquier 401: un 401 por
    // credenciales incorrectas no debe desencadenar una renovación.
    const shouldRefresh =
      status === 401 &&
      (code === 'TOKEN_EXPIRED' || code === 'UNAUTHENTICATED') &&
      !isAuthRoute &&
      !config.__retried;

    if (shouldRefresh) {
      const token = await refreshSession();
      if (token) {
        config.__retried = true;
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
        return api.request(config);
      }
      // La renovación falló: la sesión terminó de verdad. `session.js` ya notificó
      // a la aplicación, que redirige al inicio de sesión.
    }

    return Promise.reject(ApiError.from(error));
  },
);

/**
 * Devuelve el `data` de la respuesta, que es donde el contrato coloca el recurso.
 *
 * @template T
 * @param {import('axios').AxiosResponse<{ data: T }>} response
 * @returns {T}
 */
export const unwrap = (response) => response.data.data;

/**
 * Devuelve el recurso junto con la paginación.
 *
 * @template T
 * @param {import('axios').AxiosResponse<{ data: T, meta?: Record<string, unknown> }>} response
 * @returns {{ items: T, meta: Record<string, unknown> }}
 */
export const unwrapPage = (response) => ({
  items: response.data.data,
  meta: response.data.meta ?? {},
});

export { refreshSession };
