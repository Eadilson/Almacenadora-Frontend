import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases de Tailwind resolviendo los conflictos.
 *
 * `clsx` aplica los condicionales y `twMerge` deja ganar a la última clase de la
 * misma familia: sin él, `cn('p-2', 'p-4')` dejaría ambas en el atributo y el
 * resultado dependería del orden en la hoja de estilos.
 *
 * @param {...unknown} inputs
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * @param {string} value
 * @returns {string} Iniciales para el avatar, máximo dos letras.
 */
export function initialsOf(value) {
  return String(value ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/**
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} keyOf
 * @returns {Record<string, T[]>}
 */
export function groupBy(items, keyOf) {
  /** @type {Record<string, T[]>} */
  const groups = {};
  for (const item of items) {
    const key = keyOf(item);
    (groups[key] ??= []).push(item);
  }
  return groups;
}
