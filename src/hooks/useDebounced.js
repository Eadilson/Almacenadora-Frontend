import { useEffect, useState } from 'react';

/**
 * Retrasa la propagación de un valor que cambia con cada pulsación.
 *
 * Sin esto, un campo de búsqueda lanza una consulta por letra: la lista parpadea
 * con resultados intermedios y el servidor recibe diez peticiones para una sola
 * intención del usuario.
 *
 * @template T
 * @param {T} value
 * @param {number} [delay]
 * @returns {T}
 */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
