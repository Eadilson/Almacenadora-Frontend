import { describe, expect, it } from 'vitest';
import { decimalsFor, formatMoney, isNegativeMoney, parseMoneyInput, toMajorString } from './money.js';

/**
 * El dinero llega de la API como entero en la unidad mínima. Estas pruebas
 * verifican que la conversión de ida y vuelta sea exacta: un error de un centavo
 * aquí se ve en pantalla y destruye la confianza del usuario en el sistema.
 */

const gtq = (amount) => ({ amount, currency: 'GTQ' });

describe('decimalsFor', () => {
  it('usa dos decimales por omisión', () => {
    expect(decimalsFor('GTQ')).toBe(2);
    expect(decimalsFor('USD')).toBe(2);
    expect(decimalsFor('XYZ')).toBe(2);
  });

  it('reconoce las monedas sin centavos y las de tres decimales', () => {
    expect(decimalsFor('JPY')).toBe(0);
    expect(decimalsFor('CLP')).toBe(0);
    expect(decimalsFor('KWD')).toBe(3);
  });
});

describe('toMajorString', () => {
  it.each([
    [296000, '2960.00'],
    [12540, '125.40'],
    [5, '0.05'],
    [0, '0.00'],
    [-12540, '-125.40'],
    [-5, '-0.05'],
  ])('convierte %s centavos en "%s"', (amount, expected) => {
    expect(toMajorString(gtq(amount))).toBe(expected);
  });

  it('respeta las monedas sin decimales', () => {
    expect(toMajorString({ amount: 1000, currency: 'JPY' })).toBe('1000');
  });

  it('respeta las monedas de tres decimales', () => {
    expect(toMajorString({ amount: 1234, currency: 'KWD' })).toBe('1.234');
  });

  it('devuelve cadena vacía si no hay importe', () => {
    expect(toMajorString(null)).toBe('');
    expect(toMajorString(undefined)).toBe('');
  });
});

describe('parseMoneyInput', () => {
  it('convierte lo que teclea el usuario a la unidad mínima', () => {
    expect(parseMoneyInput('2960.00', 'GTQ')).toEqual({ amount: 296000, currency: 'GTQ' });
    expect(parseMoneyInput('125.4', 'GTQ')).toEqual({ amount: 12540, currency: 'GTQ' });
    expect(parseMoneyInput('125', 'GTQ')).toEqual({ amount: 12500, currency: 'GTQ' });
    expect(parseMoneyInput('0.05', 'GTQ')).toEqual({ amount: 5, currency: 'GTQ' });
  });

  it('acepta la coma como separador decimal', () => {
    // Es lo que teclea la mayoría de los usuarios de la región.
    expect(parseMoneyInput('125,40', 'GTQ')).toEqual({ amount: 12540, currency: 'GTQ' });
  });

  it('acepta valores negativos', () => {
    expect(parseMoneyInput('-125.40', 'GTQ')).toEqual({ amount: -12540, currency: 'GTQ' });
  });

  it('rechaza más decimales de los que admite la moneda, en lugar de redondear', () => {
    // Perder precisión debe ser una decisión explícita del usuario, no un efecto
    // colateral silencioso del formulario.
    expect(parseMoneyInput('125.405', 'GTQ')).toBeNull();
    expect(parseMoneyInput('1000.5', 'JPY')).toBeNull();
    expect(parseMoneyInput('1.2345', 'KWD')).toBeNull();
  });

  it('acepta la precisión propia de cada moneda', () => {
    expect(parseMoneyInput('1.234', 'KWD')).toEqual({ amount: 1234, currency: 'KWD' });
    expect(parseMoneyInput('1000', 'JPY')).toEqual({ amount: 1000, currency: 'JPY' });
  });

  it('rechaza entradas que no son números', () => {
    expect(parseMoneyInput('', 'GTQ')).toBeNull();
    expect(parseMoneyInput('   ', 'GTQ')).toBeNull();
    expect(parseMoneyInput('abc', 'GTQ')).toBeNull();
    expect(parseMoneyInput('12.34.56', 'GTQ')).toBeNull();
    expect(parseMoneyInput('1e5', 'GTQ')).toBeNull();
    expect(parseMoneyInput(null, 'GTQ')).toBeNull();
  });

  it('la conversión de ida y vuelta es exacta', () => {
    for (const text of ['0.00', '0.01', '125.40', '2960.00', '999999.99', '-45.05']) {
      const parsed = parseMoneyInput(text, 'GTQ');
      expect(toMajorString(parsed)).toBe(text);
    }
  });
});

describe('formatMoney', () => {
  it('respeta el valor ya formateado por el servidor', () => {
    // El servidor conoce el locale y las preferencias de la empresa mejor que el
    // navegador de quien mira la pantalla.
    expect(formatMoney({ amount: 296000, currency: 'GTQ', formatted: 'L 2,960.00' })).toBe(
      'L 2,960.00',
    );
  });

  it('formatea con separadores de millar', () => {
    expect(formatMoney(gtq(296000))).toContain('2,960.00');
  });

  it('muestra un guion cuando no hay importe', () => {
    expect(formatMoney(null)).toBe('—');
  });

  it('no falla con una moneda que el navegador no conoce', () => {
    const result = formatMoney({ amount: 100, currency: 'ZZZ' });
    expect(result).toContain('ZZZ');
  });
});

describe('isNegativeMoney', () => {
  it('reconoce los importes negativos', () => {
    expect(isNegativeMoney(gtq(-1))).toBe(true);
    expect(isNegativeMoney(gtq(0))).toBe(false);
    expect(isNegativeMoney(null)).toBe(false);
  });
});
