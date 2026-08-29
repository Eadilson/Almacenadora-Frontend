import { useCallback, useState } from 'react';

/**
 * Envío de un formulario dentro de un diálogo.
 *
 * Existe por un fallo que apareció seis veces en pantallas distintas: el botón
 * llamaba a `mutateAsync` **sin capturar el rechazo**. Cuando el servidor decía
 * que no —un código repetido, el límite del plan alcanzado, una regla de
 * negocio—, el diálogo se quedaba abierto sin ningún mensaje. La persona veía un
 * botón que aparentemente no hacía nada, y volvía a pulsarlo.
 *
 * Aquí el error se guarda para pintarlo dentro del propio diálogo, junto al
 * botón, que es donde se está mirando. Además la promesa siempre queda manejada,
 * así que no deja un rechazo suelto en la consola.
 *
 * Los errores de validación por campo **no** se tratan aquí: los coloca el
 * formulario sobre cada control, que es más útil que un mensaje general.
 *
 * @param {{ onSuccess?: () => void }} [options]
 * @returns {{
 *   error: string,
 *   clearError: () => void,
 *   submitting: boolean,
 *   run: (work: () => Promise<unknown>) => Promise<boolean>,
 * }}
 */
export function useDialogSubmit({ onSuccess } = {}) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const clearError = useCallback(() => setError(''), []);

  /**
   * Ejecuta el envío y devuelve si salió bien.
   *
   * Se devuelve un booleano en lugar de relanzar para que quien llama pueda
   * decidir sin envolver todo en otro `try`.
   */
  const run = useCallback(
    async (/** @type {() => Promise<unknown>} */ work) => {
      setError('');
      setSubmitting(true);

      try {
        await work();
        onSuccess?.();
        return true;
      } catch (caught) {
        const apiError = /** @type {any} */ (caught);

        setError(
          apiError?.fieldErrors?.[0]?.message ??
            apiError?.message ??
            'No se pudo completar la operación. Inténtelo de nuevo.',
        );

        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  return { error, clearError, submitting, run };
}
