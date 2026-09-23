/**
 * Un único acento con significado, no una rueda de colores decorativos.
 *
 * La primera versión de esto rotaba primary/success/warning/destructive por
 * cada tarjeta de una fila para "romper la monotonía" — el resultado leía
 * como cualquier plantilla de panel genérica (insignia circular de color +
 * franja arcoíris arriba de la tarjeta es, literalmente, el patrón que se
 * evita al diseñar un artifact por lo reconocible que es). Aquí el color se
 * reserva para cuando la propia cifra lo amerita —vencido, bajo el mínimo—;
 * todo lo demás es tinta neutra y la jerarquía la lleva la tipografía.
 *
 * @typedef {'default'|'warning'|'destructive'} Tone
 */

/** Color del valor cuando amerita atención. @type {Record<Tone, string>} */
export const TONE_TEXT = {
  default: 'text-foreground',
  warning: 'text-warning',
  destructive: 'text-destructive',
};
