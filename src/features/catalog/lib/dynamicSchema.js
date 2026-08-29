import { z } from 'zod';

/**
 * Formularios generados desde metadata.
 *
 * Esta es la pieza que permite que la misma pantalla sirva a una joyería y a una
 * ferretería. Los campos propios de cada rubro no están escritos en ningún
 * componente: se construyen —y se validan— a partir de las definiciones que la
 * empresa configuró en su categoría y que la API devuelve en
 * `GET /categories/:id/attributes`.
 *
 * La validación se genera de esa **misma** fuente que usa el servidor, así que no
 * pueden divergir. Aun así, la del cliente no es seguridad: sirve para dar
 * respuesta inmediata; la que protege el sistema es la del servidor.
 *
 * @typedef {import('@/api/endpoints/catalog').AttributeDefinition} AttributeDefinition
 */

/** Marcador de "sin selección" en los desplegables opcionales. */
export const EMPTY_OPTION = '';

/**
 * Construye el validador de un atributo según su definición.
 *
 * @param {AttributeDefinition} definition
 * @returns {z.ZodTypeAny}
 */
function schemaForAttribute(definition) {
  const { label, required } = definition;

  switch (definition.type) {
    case 'NUMBER': {
      const base = z
        .string()
        .trim()
        .refine((value) => value === '' || /^-?\d+([.,]\d+)?$/.test(value), {
          message: `«${label}» debe ser un número.`,
        });

      return required
        ? base.refine((value) => value !== '', { message: `«${label}» es obligatorio.` })
        : base;
    }

    case 'DECIMAL': {
      const scale = definition.scale ?? 2;

      const base = z
        .string()
        .trim()
        .refine((value) => value === '' || /^-?\d+([.,]\d+)?$/.test(value), {
          message: `«${label}» debe ser un número.`,
        })
        // Se rechaza el exceso de decimales en lugar de redondear: perder precisión
        // en un peso o una medida debe ser decisión del usuario, no un efecto
        // colateral silencioso. Es la misma regla que aplica el servidor.
        .refine(
          (value) => {
            if (value === '') return true;
            const decimals = value.replace(',', '.').split('.')[1];
            return !decimals || decimals.length <= scale;
          },
          {
            message:
              scale === 0
                ? `«${label}» no admite decimales.`
                : `«${label}» admite ${scale} ${scale === 1 ? 'decimal' : 'decimales'}.`,
          },
        );

      return required
        ? base.refine((value) => value !== '', { message: `«${label}» es obligatorio.` })
        : base;
    }

    case 'BOOLEAN':
      return z.boolean();

    case 'DATE': {
      const base = z.string().trim();
      return required
        ? base.min(1, `«${label}» es obligatorio.`)
        : base;
    }

    case 'ENUM': {
      const base = z.string();
      return required
        ? base.refine((value) => value !== EMPTY_OPTION && definition.options.includes(value), {
            message: `Seleccione «${label}».`,
          })
        : base.refine((value) => value === EMPTY_OPTION || definition.options.includes(value), {
            message: `«${label}» no es una opción válida.`,
          });
    }

    case 'MULTI_ENUM': {
      const base = z.array(z.string());
      return required ? base.min(1, `Seleccione al menos una opción en «${label}».`) : base;
    }

    case 'STRING':
    default: {
      const base = z.string().trim().max(500, `«${label}» admite hasta 500 caracteres.`);
      return required ? base.min(1, `«${label}» es obligatorio.`) : base;
    }
  }
}

/**
 * Esquema del bloque de atributos de una categoría.
 *
 * @param {AttributeDefinition[]} definitions
 * @returns {z.ZodTypeAny}
 */
export function buildAttributesSchema(definitions = []) {
  /** @type {Record<string, z.ZodTypeAny>} */
  const shape = {};
  for (const definition of definitions) {
    shape[definition.key] = schemaForAttribute(definition);
  }
  return z.object(shape);
}

/**
 * Valores iniciales del bloque de atributos.
 *
 * Cada tipo necesita su propio valor vacío: un campo de texto controlado con
 * `undefined` haría que React lo trate como no controlado y avise por consola en
 * cuanto el usuario escriba.
 *
 * @param {AttributeDefinition[]} definitions
 * @param {Record<string, unknown>} [existing] Valores del producto que se edita.
 * @returns {Record<string, unknown>}
 */
export function buildAttributeDefaults(definitions = [], existing = {}) {
  /** @type {Record<string, unknown>} */
  const values = {};

  for (const definition of definitions) {
    const current = existing[definition.key];

    switch (definition.type) {
      case 'BOOLEAN':
        values[definition.key] = current === true;
        break;
      case 'MULTI_ENUM':
        values[definition.key] = Array.isArray(current) ? current.map(String) : [];
        break;
      case 'DATE':
        // El control `date` del navegador exige el formato `aaaa-mm-dd`.
        values[definition.key] = current ? String(current).slice(0, 10) : '';
        break;
      default:
        values[definition.key] = current === null || current === undefined ? '' : String(current);
    }
  }

  return values;
}

/**
 * Convierte los valores del formulario al formato que espera la API.
 *
 * Los omitidos se descartan en lugar de enviarse vacíos: un opcional sin valor no
 * es una cadena vacía, es un atributo que ese producto no tiene.
 *
 * @param {AttributeDefinition[]} definitions
 * @param {Record<string, unknown>} values
 * @returns {Record<string, unknown>}
 */
export function toAttributePayload(definitions = [], values = {}) {
  /** @type {Record<string, unknown>} */
  const payload = {};

  for (const definition of definitions) {
    const value = values[definition.key];

    switch (definition.type) {
      case 'BOOLEAN':
        payload[definition.key] = Boolean(value);
        break;

      case 'MULTI_ENUM':
        if (Array.isArray(value) && value.length > 0) payload[definition.key] = value;
        break;

      case 'NUMBER': {
        const text = String(value ?? '').trim().replace(',', '.');
        if (text !== '') payload[definition.key] = Number(text);
        break;
      }

      case 'DECIMAL': {
        // Se envía como cadena: convertirlo a `number` reintroduciría el error
        // binario que el sistema evita de punta a punta.
        const text = String(value ?? '').trim().replace(',', '.');
        if (text !== '') payload[definition.key] = text;
        break;
      }

      default: {
        const text = String(value ?? '').trim();
        if (text !== '') payload[definition.key] = text;
      }
    }
  }

  return payload;
}

/**
 * Muestra el valor de un atributo en listados y detalles.
 *
 * @param {AttributeDefinition} definition
 * @param {unknown} value
 * @returns {string}
 */
export function formatAttributeValue(definition, value) {
  if (value === null || value === undefined || value === '') return '—';

  switch (definition.type) {
    case 'BOOLEAN':
      return value ? 'Sí' : 'No';
    case 'MULTI_ENUM':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'DATE':
      return new Date(String(value)).toLocaleDateString('es-GT');
    case 'DECIMAL':
    case 'NUMBER':
      return definition.unit ? `${value} ${definition.unit}` : String(value);
    default:
      return String(value);
  }
}
