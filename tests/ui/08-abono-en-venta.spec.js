import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Abono al momento de la venta a crédito, por la interfaz.
 *
 * Antes, marcar «Dejar a crédito» dejaba el total entero a deber: todo o nada.
 * Muchas ventas a crédito llevan un pago inicial, así que el diálogo de cobro
 * deja escribir cuánto se abona ahora mismo y calcula el resto como crédito.
 */

test.describe.configure({ mode: 'serial' });

const SELLO = Date.now().toString().slice(-6);

const datos = {
  producto: `Bisagra UI ${SELLO}`,
  sku: '',
  cliente: `Ferretería Abono ${SELLO}`,
  precio: '100.00',
  costo: '60.00',
  unidades: 3,
  /** 3 × 100 = 300,00 */
  totalEsperado: 'Q 300.00',
  abono: '120.00',
  abonoEsperado: 'Q 120.00',
  /** 300 − 120 = 180,00 */
  saldoEsperado: 'Q 180.00',
};

test.describe('abono al confirmar una venta a crédito', () => {
  test('1 · se prepara producto con existencia y cliente con crédito', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);

    await page.goto('/productos/nuevo');
    const sku = page.getByLabel(/Código \(SKU\)/);
    await sku.waitFor({ state: 'visible', timeout: 20_000 });

    await page.getByLabel(/^Nombre/).fill(datos.producto);
    await page.getByLabel(/^Categoría/).selectOption({ label: 'General' });
    await page.getByLabel(/Unidad de medida/).selectOption({ label: 'Unidad (UN)' });
    await page.getByLabel(/^Costo/).fill(datos.costo);
    await page.getByLabel(/Precio de venta/).fill(datos.precio);
    await page.getByRole('button', { name: 'Crear producto' }).click();
    await expect(page).toHaveURL(/\/productos\/[a-f0-9]{24}/, { timeout: 20_000 });
    await esperarCarga(page);

    datos.sku = await sku.inputValue();

    await page.goto('/compras/nueva');
    await esperarCarga(page);

    const selectorProveedor = page.getByLabel(/^Proveedor/);
    await selectorProveedor.selectOption({ index: 1 });

    const buscador = page.getByLabel('Buscar productos');
    await buscador.fill(datos.sku);
    await page.getByRole('button', { name: new RegExp(datos.sku) }).first().click();

    await page.getByLabel(`Cantidad de ${datos.producto}`).fill('10');
    await page.getByLabel(`Costo de ${datos.producto}`).fill(datos.costo);
    await page.getByRole('button', { name: /Crear y confirmar/ }).click();

    await expect(page).toHaveURL(/\/compras\/[a-f0-9]{24}/, { timeout: 20_000 });
    await page.getByRole('button', { name: /^Recibir/ }).first().click();
    const dialogoRecepcion = page.getByRole('dialog');
    await dialogoRecepcion.getByRole('button', { name: 'Registrar recepción' }).click();
    await expect(dialogoRecepcion).toBeHidden({ timeout: 20_000 });

    await page.goto('/clientes');
    await esperarCarga(page);
    await page.getByRole('button', { name: 'Nuevo cliente' }).first().click();

    const dialogoCliente = page.getByRole('dialog');
    await dialogoCliente.getByLabel(/^Nombre/).fill(datos.cliente);
    await dialogoCliente.getByLabel(/Límite de crédito/).fill('1000.00');
    await dialogoCliente.getByLabel(/^Plazo/).fill('30');
    await dialogoCliente.getByRole('button', { name: 'Crear cliente' }).click();
    await expect(dialogoCliente).toBeHidden();

    sinErrores(ojo, 'preparación');
  });

  test('2 · se abona una parte al confirmar y el resto queda a crédito', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/ventas/nueva');
    await esperarCarga(page);

    const buscador = page.getByLabel('Buscar productos para vender');
    await buscador.fill(datos.sku);
    await page.getByRole('button', { name: new RegExp(datos.sku) }).first().waitFor({
      state: 'visible',
      timeout: 20_000,
    });
    await buscador.press('Enter');

    await expect(page.getByRole('button', { name: `Quitar ${datos.producto}` })).toBeVisible();

    for (let i = 1; i < datos.unidades; i += 1) {
      await page.getByRole('button', { name: 'Agregar una unidad' }).first().click();
    }

    const selectorCliente = page.locator('#pos-cliente');
    const valor = await selectorCliente
      .locator('option', { hasText: datos.cliente })
      .getAttribute('value');
    await selectorCliente.selectOption(valor);

    await page.getByRole('button', { name: 'Cobrar' }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText(datos.totalEsperado);

    await dialogo.getByText('Dejar a crédito').click();

    // Sin abono, todo queda a crédito: es el comportamiento de siempre.
    const filaRestante = dialogo.getByText('Queda a crédito').locator('..');
    await expect(filaRestante).toContainText(datos.totalEsperado);

    // Se abona una parte: el resto se recalcula solo.
    await dialogo.getByLabel(/Abono ahora/).fill(datos.abono);
    await expect(filaRestante).toContainText(datos.saldoEsperado);

    // Al escribir un abono aparece cómo se cobró.
    await expect(dialogo.getByText('Forma de pago del abono')).toBeVisible();

    await dialogo.getByRole('button', { name: 'Confirmar venta' }).click();

    await expect(dialogo.getByText(/V\d+-\d{6}/).first()).toBeVisible({ timeout: 20_000 });
    await expect(dialogo.getByText('Abonado ahora')).toBeVisible();
    await expect(dialogo.getByText(datos.abonoEsperado)).toBeVisible();
    await expect(dialogo.getByText('Queda a deber')).toBeVisible();
    await expect(dialogo).toContainText(datos.saldoEsperado);

    sinErrores(ojo, 'venta a crédito con abono');
  });
});

/*
 * No se comprueba aquí que la Cartera liste el saldo correcto: esa pantalla
 * pagina a 25 por página con búsqueda solo del lado del cliente (ver
 * PortfolioPage), y con los cientos de clientes de demostración acumulados en
 * este entorno, un cliente recién creado puede caer fuera de la primera
 * página según el orden alfabético. Es el mismo problema ya conocido en
 * 03-credito.spec.js, no algo que dependa de este abono. Lo que sí prueba el
 * recibo de la venta —«Abonado ahora» y «Queda a deber» con los importes
 * exactos que calculó el servidor— basta para confirmar que el reparto entre
 * pago y crédito quedó bien hecho.
 */
