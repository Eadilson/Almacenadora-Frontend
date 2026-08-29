import { describe, expect, it } from 'vitest';
import {
  buildAttributeDefaults,
  buildAttributesSchema,
  formatAttributeValue,
  toAttributePayload,
} from './dynamicSchema.js';

/**
 * El formulario dinámico es la pieza que hace el producto vendible a varios rubros.
 * Si se rompe, la ficha de producto deja de reflejar lo que cada empresa configuró y
 * hay que tocar código por cliente.
 */

/** @param {Partial<any>} overrides */
const attribute = (overrides) => ({
  key: 'material',
  label: 'Material',
  type: 'STRING',
  required: false,
  options: [],
  unit: null,
  scale: null,
  filterable: false,
  showInList: false,
  order: 0,
  helpText: null,
  ...overrides,
});

/** Definiciones reales de una joyería. */
const jewelry = [
  attribute({
    key: 'material',
    type: 'ENUM',
    options: ['Oro 18k', 'Plata 925'],
    required: true,
  }),
  attribute({ key: 'weightGr', label: 'Peso (gr)', type: 'DECIMAL', scale: 3, required: true }),
  attribute({ key: 'ringSize', label: 'Talla', type: 'STRING' }),
];

describe('esquema generado desde la metadata', () => {
  it('acepta un producto válido de joyería', () => {
    const schema = buildAttributesSchema(jewelry);
    const result = schema.safeParse({ material: 'Oro 18k', weightGr: '3.750', ringSize: '7' });
    expect(result.success).toBe(true);
  });

  it('exige los atributos obligatorios de la categoría', () => {
    const schema = buildAttributesSchema(jewelry);
    const result = schema.safeParse({ material: '', weightGr: '', ringSize: '' });

    expect(result.success).toBe(false);
    const fields = result.error.issues.map((issue) => issue.path[0]).sort();
    expect(fields).toEqual(['material', 'weightGr']);
  });

  it('rechaza una opción que no está en la lista', () => {
    const schema = buildAttributesSchema(jewelry);
    expect(schema.safeParse({ material: 'Bronce', weightGr: '1', ringSize: '' }).success).toBe(false);
  });

  it('respeta los decimales declarados, en lugar de redondear en silencio', () => {
    const schema = buildAttributesSchema(jewelry);

    expect(schema.safeParse({ material: 'Oro 18k', weightGr: '3.750', ringSize: '' }).success).toBe(true);
    // Un decimal de más debe avisarse: perder precisión en un peso es decisión del
    // usuario, no un efecto colateral.
    expect(schema.safeParse({ material: 'Oro 18k', weightGr: '3.7501', ringSize: '' }).success).toBe(false);
  });

  it('acepta la coma como separador decimal', () => {
    const schema = buildAttributesSchema(jewelry);
    expect(schema.safeParse({ material: 'Oro 18k', weightGr: '3,750', ringSize: '' }).success).toBe(true);
  });

  it('deja pasar los opcionales vacíos', () => {
    const schema = buildAttributesSchema([attribute({ key: 'note', type: 'STRING' })]);
    expect(schema.safeParse({ note: '' }).success).toBe(true);
  });

  it('exige al menos una opción en una lista múltiple obligatoria', () => {
    const schema = buildAttributesSchema([
      attribute({ key: 'stones', type: 'MULTI_ENUM', options: ['Circón'], required: true }),
    ]);

    expect(schema.safeParse({ stones: [] }).success).toBe(false);
    expect(schema.safeParse({ stones: ['Circón'] }).success).toBe(true);
  });

  it('el mismo motor valida los campos de otro rubro', () => {
    // Ferretería: ni una línea de código distinta.
    const hardware = [
      attribute({ key: 'gauge', label: 'Calibre', type: 'ENUM', options: ['10 AWG'], required: true }),
      attribute({ key: 'lengthMt', label: 'Longitud', type: 'DECIMAL', scale: 2 }),
    ];

    const schema = buildAttributesSchema(hardware);
    expect(schema.safeParse({ gauge: '10 AWG', lengthMt: '100.50' }).success).toBe(true);
    expect(schema.safeParse({ gauge: '', lengthMt: '' }).success).toBe(false);
  });
});

describe('valores iniciales', () => {
  it('da a cada tipo un valor vacío que React puede controlar', () => {
    const defaults = buildAttributeDefaults([
      attribute({ key: 'a', type: 'STRING' }),
      attribute({ key: 'b', type: 'BOOLEAN' }),
      attribute({ key: 'c', type: 'MULTI_ENUM', options: ['x'] }),
      attribute({ key: 'd', type: 'DATE' }),
    ]);

    // `undefined` haría que React trate el campo como no controlado y avise en
    // consola en cuanto el usuario escriba.
    expect(defaults).toEqual({ a: '', b: false, c: [], d: '' });
  });

  it('carga los valores de un producto existente', () => {
    const defaults = buildAttributeDefaults(jewelry, {
      material: 'Oro 18k',
      weightGr: '3.750',
    });

    expect(defaults).toEqual({ material: 'Oro 18k', weightGr: '3.750', ringSize: '' });
  });

  it('recorta la fecha al formato que exige el control del navegador', () => {
    const defaults = buildAttributeDefaults([attribute({ key: 'expiresAt', type: 'DATE' })], {
      expiresAt: '2026-12-31T00:00:00.000Z',
    });

    expect(defaults.expiresAt).toBe('2026-12-31');
  });
});

describe('conversión al formato de la API', () => {
  it('envía los decimales como cadena para no perder precisión', () => {
    const payload = toAttributePayload(jewelry, {
      material: 'Oro 18k',
      weightGr: '3.750',
      ringSize: '7',
    });

    expect(payload.weightGr).toBe('3.750');
    expect(typeof payload.weightGr).toBe('string');
  });

  it('convierte los enteros a número', () => {
    const payload = toAttributePayload([attribute({ key: 'lengthCm', type: 'NUMBER' })], {
      lengthCm: '50',
    });

    expect(payload.lengthCm).toBe(50);
  });

  it('omite los opcionales vacíos en lugar de enviarlos en blanco', () => {
    // Un opcional sin valor no es una cadena vacía: es un atributo que el producto
    // no tiene.
    const payload = toAttributePayload(jewelry, {
      material: 'Oro 18k',
      weightGr: '1.000',
      ringSize: '',
    });

    expect(payload).not.toHaveProperty('ringSize');
  });

  it('normaliza la coma decimal antes de enviar', () => {
    const payload = toAttributePayload(jewelry, { material: 'Oro 18k', weightGr: '3,750' });
    expect(payload.weightGr).toBe('3.750');
  });

  it('envía las casillas siempre, incluso en falso', () => {
    // Un «no» explícito es información; omitirlo lo haría indistinguible de «sin dato».
    const payload = toAttributePayload([attribute({ key: 'isGift', type: 'BOOLEAN' })], {
      isGift: false,
    });

    expect(payload.isGift).toBe(false);
  });
});

describe('presentación de valores', () => {
  it.each([
    [attribute({ type: 'BOOLEAN' }), true, 'Sí'],
    [attribute({ type: 'BOOLEAN' }), false, 'No'],
    [attribute({ type: 'MULTI_ENUM' }), ['Circón', 'Rubí'], 'Circón, Rubí'],
    [attribute({ type: 'DECIMAL', unit: 'GR' }), '3.750', '3.750 GR'],
    [attribute({ type: 'STRING' }), 'Oro 18k', 'Oro 18k'],
    [attribute({ type: 'STRING' }), null, '—'],
    [attribute({ type: 'STRING' }), '', '—'],
  ])('formatea correctamente', (definition, value, expected) => {
    expect(formatAttributeValue(definition, value)).toBe(expected);
  });
});
