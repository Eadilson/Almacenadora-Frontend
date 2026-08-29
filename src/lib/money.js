/**
 * Dinero en el cliente.
 *
 * La API transporta los importes como **entero en la unidad mínima** de la moneda
 * (`{ amount: 296000, currency: 'GTQ' }` = 2.960,00). Aquí solo se convierte para
 * mostrar y para enviar: **nunca se hace aritmética de negocio en el navegador**.
 * Los totales, impuestos y descuentos los calcula el servidor, que es la única
 * fuente de verdad; duplicar esos cálculos aquí garantiza que algún día difieran.
 *
 * @typedef {{ amount: number, currency: string, formatted?: string }} MoneyDto
 */

/** Monedas que no usan dos decimales. El resto toma el valor por omisión. */
const CURRENCY_DECIMALS = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0,
  PYG: 0, RWF: 0, UGX: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
};

const DEFAULT_DECIMALS = 2;

/**
 * @param {string} currency
 * @returns {number}
 */
export function decimalsFor(currency) {
  return CURRENCY_DECIMALS[currency] ?? DEFAULT_DECIMALS;
}

/**
 * Convierte el entero de la API a la unidad mayor, de forma exacta.
 *
 * Se divide con corrimiento de la cadena en lugar de `amount / 100` para no
 * introducir el error binario que el backend evita con tanto cuidado.
 *
 * @param {MoneyDto|null|undefined} money
 * @returns {string} `'2960.00'`
 */
export function toMajorString(money) {
  if (!money) return '';
  const decimals = decimalsFor(money.currency);
  const negative = money.amount < 0;
  const digits = String(Math.abs(money.amount)).padStart(decimals + 1, '0');

  if (decimals === 0) return `${negative ? '-' : ''}${digits}`;

  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals);
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/**
 * Formatea un importe para mostrar.
 *
 * Si la API ya envió `formatted`, se respeta: el servidor conoce el locale y las
 * preferencias de la empresa mejor que el cliente.
 *
 * @param {MoneyDto|null|undefined} money
 * @param {object} [options]
 * @param {string} [options.locale]
 * @param {boolean} [options.withSymbol]
 * @returns {string}
 */
export function formatMoney(money, { locale = 'es-GT', withSymbol = true } = {}) {
  if (!money) return '—';
  if (money.formatted) return money.formatted;

  const decimals = decimalsFor(money.currency);

  try {
    return new Intl.NumberFormat(locale, {
      style: withSymbol ? 'currency' : 'decimal',
      currency: money.currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(toMajorString(money)));
  } catch {
    // Moneda desconocida para el navegador: se muestra el código, que sigue
    // siendo información correcta.
    return `${toMajorString(money)} ${money.currency}`;
  }
}

/**
 * Convierte lo que el usuario escribió a la representación que espera la API.
 *
 * Devuelve `null` si el valor no es un decimal válido o si tiene más decimales de
 * los que admite la moneda. No redondea en silencio: perder precisión en un
 * importe debe ser una decisión explícita del usuario, no un efecto colateral.
 *
 * @param {string|number} input
 * @param {string} currency
 * @returns {MoneyDto|null}
 */
export function parseMoneyInput(input, currency) {
  const text = String(input ?? '').trim().replace(/\s/g, '');
  if (text === '') return null;

  // Se acepta la coma como separador decimal: es lo que teclea la mayoría de los
  // usuarios de la región.
  const normalized = text.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;

  const decimals = decimalsFor(currency);
  const [whole, fraction = ''] = normalized.replace('-', '').split('.');
  if (fraction.length > decimals) return null;

  const minor = Number(`${whole}${fraction.padEnd(decimals, '0')}`);
  if (!Number.isSafeInteger(minor)) return null;

  return { amount: normalized.startsWith('-') ? -minor : minor, currency };
}

/**
 * @param {MoneyDto|null|undefined} money
 * @returns {boolean}
 */
export const isZeroMoney = (money) => !money || money.amount === 0;

/**
 * @param {MoneyDto|null|undefined} money
 * @returns {boolean}
 */
export const isNegativeMoney = (money) => Boolean(money && money.amount < 0);
