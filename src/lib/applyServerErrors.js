/**
 * Aplica los errores de una respuesta del servidor a un formulario de React
 * Hook Form.
 *
 * Un error de validación por campo se coloca sobre ese campo. Uno que no
 * corresponde a ningún campo real del formulario —una violación del cuerpo
 * completo (`body`/`(raíz)`), o cualquier fallo que no sea de validación
 * (regla de negocio, red, servidor)— no tiene dónde ponerse sobre el
 * formulario: se entrega a `onUnmatched` en su lugar, para mostrarse en una
 * alerta a nivel de página.
 *
 * Antes de existir esto, un rechazo sin campo propio se fijaba sobre un
 * campo cualquiera —a veces uno deshabilitado, a veces uno que no tenía
 * relación con el error real— y guardar parecía no hacer nada. Ver
 * ProductFormPage.jsx, donde apareció por primera vez con `unitId`.
 *
 * @param {import('react-hook-form').UseFormReturn<any>} form
 * @param {import('../api/ApiError').ApiError} apiError
 * @param {(message: string) => void} onUnmatched
 * @param {{ fallbackMessage?: string }} [options]
 */
export function applyServerErrors(form, apiError, onUnmatched, options = {}) {
  const fallbackMessage = options.fallbackMessage ?? 'No se pudo guardar. Inténtelo de nuevo.';

  if (apiError?.isValidation) {
    const fieldErrors = apiError.toFormErrors();
    let placed = false;
    for (const [field, message] of Object.entries(fieldErrors)) {
      if (field === 'body' || field === '(raíz)') continue;
      form.setError(/** @type {any} */ (field), { message: /** @type {string} */ (message) });
      placed = true;
    }
    if (!placed) {
      onUnmatched(Object.values(fieldErrors)[0] ?? fallbackMessage);
    }
  } else {
    onUnmatched(apiError?.message ?? fallbackMessage);
  }
}
