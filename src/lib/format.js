/**
 * Formato de fechas, cantidades y números.
 *
 * Todo se formatea en la **zona horaria de la empresa**, no en la del navegador:
 * un usuario que consulta desde otro país debe ver las mismas fechas que sus
 * compañeros, y agrupar por día con la zona equivocada produce cifras erróneas.
 */

/** @type {string} Zona horaria activa; la establece el proveedor de sesión. */
let activeTimezone = 'UTC';
/** @type {string} */
let activeLocale = 'es-GT';

/**
 * @param {{ timezone?: string, locale?: string }} settings
 * @returns {void}
 */
export function configureFormatting({ timezone, locale }) {
  if (timezone) activeTimezone = timezone;
  if (locale) activeLocale = locale;
}

/**
 * @param {string|Date|null|undefined} value
 * @returns {Date|null}
 */
function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @param {string|Date|null|undefined} value
 * @returns {string} `30/07/2026`
 */
export function formatDate(value) {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(activeLocale, {
    dateStyle: 'short',
    timeZone: activeTimezone,
  }).format(date);
}

/**
 * @param {string|Date|null|undefined} value
 * @returns {string} `30/07/2026, 15:30`
 */
export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(activeLocale, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: activeTimezone,
  }).format(date);
}

/**
 * @param {string|Date|null|undefined} value
 * @returns {string} `30 de julio de 2026`
 */
export function formatDateLong(value) {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(activeLocale, {
    dateStyle: 'long',
    timeZone: activeTimezone,
  }).format(date);
}

/**
 * Tiempo relativo, para bitácoras y listados de actividad.
 *
 * @param {string|Date|null|undefined} value
 * @returns {string} `hace 5 minutos`
 */
export function formatRelative(value) {
  const date = toDate(value);
  if (!date) return '—';

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(activeLocale, { numeric: 'auto' });

  /** @type {[Intl.RelativeTimeFormatUnit, number][]} */
  const thresholds = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];

  for (const [unit, secondsPerUnit] of thresholds) {
    if (Math.abs(seconds) >= secondsPerUnit || unit === 'second') {
      return formatter.format(Math.round(seconds / secondsPerUnit), unit);
    }
  }
  return '—';
}

/**
 * Formatea una cantidad recibida como cadena decimal.
 *
 * La API envía las cantidades como texto (`'3.750'`) para no perder precisión al
 * serializar; aquí solo se separan los millares y se conservan los decimales
 * significativos que trae el valor.
 *
 * @param {string|number|null|undefined} value
 * @param {{ unit?: string|null }} [options]
 * @returns {string}
 */
export function formatQuantity(value, { unit = null } = {}) {
  if (value === null || value === undefined || value === '') return '—';

  const text = String(value);
  const decimals = text.includes('.') ? text.split('.')[1].length : 0;
  const formatted = new Intl.NumberFormat(activeLocale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(text));

  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * @param {number|null|undefined} value
 * @param {number} [decimals]
 * @returns {string}
 */
export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat(activeLocale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * @param {number|null|undefined} basisPoints Porcentaje en puntos base (1650 = 16,50 %).
 * @returns {string}
 */
export function formatPercentage(basisPoints) {
  if (basisPoints === null || basisPoints === undefined) return '—';
  return new Intl.NumberFormat(activeLocale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(basisPoints / 10_000);
}

/**
 * @returns {{ timezone: string, locale: string }}
 */
export function currentFormatting() {
  return { timezone: activeTimezone, locale: activeLocale };
}
