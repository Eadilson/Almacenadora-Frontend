/**
 * Error de la API, normalizado desde el formato RFC 7807 que devuelve el servidor.
 *
 * El `code` es el contrato estable: la interfaz decide qué mostrar y cómo
 * reaccionar en función de él, nunca del texto del mensaje, que puede cambiar o
 * traducirse (docs/06-api-rest.md §9).
 *
 * @typedef {{ field: string, code: string, message: string }} FieldError
 */
export class ApiError extends Error {
  /**
   * @param {object} params
   * @param {string} params.code
   * @param {string} params.message
   * @param {number} params.status
   * @param {FieldError[]} [params.fieldErrors]
   * @param {Record<string, unknown>} [params.meta]
   * @param {string|null} [params.requestId]
   */
  constructor({ code, message, status, fieldErrors = [], meta = {}, requestId = null }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.meta = meta;
    // Permite que el usuario reporte una incidencia con un dato con el que soporte
    // puede rastrear la petición completa en los logs del servidor.
    this.requestId = requestId;
  }

  /** @returns {boolean} */
  get isValidation() {
    return this.status === 422;
  }

  /** @returns {boolean} */
  get isBusinessRule() {
    return this.status === 409;
  }

  /** @returns {boolean} */
  get isUnauthorized() {
    return this.status === 401;
  }

  /** @returns {boolean} */
  get isForbidden() {
    return this.status === 403;
  }

  /** @returns {boolean} */
  get isNotFound() {
    return this.status === 404;
  }

  /** @returns {boolean} */
  get isServerFault() {
    return this.status >= 500;
  }

  /**
   * Errores por campo listos para `setError` de React Hook Form.
   *
   * @returns {Record<string, string>}
   */
  toFormErrors() {
    /** @type {Record<string, string>} */
    const errors = {};
    for (const item of this.fieldErrors) {
      // El servidor prefija con el origen (`body.`, `query.`); el formulario no
      // conoce esa distinción.
      errors[item.field.replace(/^(body|query|params)\./, '')] = item.message;
    }
    return errors;
  }

  /**
   * Construye el error a partir de una respuesta de Axios.
   *
   * @param {any} error
   * @returns {ApiError}
   */
  static from(error) {
    // Sin respuesta: la petición no llegó (red caída, servidor apagado, CORS).
    if (!error.response) {
      const cancelled = error.code === 'ERR_CANCELED';
      return new ApiError({
        code: cancelled ? 'REQUEST_CANCELLED' : 'NETWORK_ERROR',
        message: cancelled
          ? 'La operación fue cancelada.'
          : 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.',
        status: 0,
      });
    }

    const { status, data, headers } = error.response;

    // Respuesta que no sigue el contrato: pasarela, proxy o error no controlado.
    if (!data || typeof data !== 'object' || !('code' in data)) {
      return new ApiError({
        code: 'UNEXPECTED_RESPONSE',
        message:
          status >= 500
            ? 'El servidor tuvo un problema. Intente de nuevo en unos momentos.'
            : 'La respuesta del servidor no tuvo el formato esperado.',
        status,
        requestId: headers?.['x-request-id'] ?? null,
      });
    }

    return new ApiError({
      code: String(data.code),
      message: String(data.detail ?? data.title ?? 'Ocurrió un error.'),
      status,
      fieldErrors: Array.isArray(data.errors) ? data.errors : [],
      meta: data.meta ?? {},
      requestId: data.requestId ?? headers?.['x-request-id'] ?? null,
    });
  }
}
