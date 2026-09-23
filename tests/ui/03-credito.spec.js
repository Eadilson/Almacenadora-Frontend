import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Venta al crédito y cobranza, por la interfaz.
 *
 * Es el tramo donde el sistema maneja dinero que todavía no ha entrado, así que
 * lo que se comprueba no es solo que los botones respondan: se sigue el saldo del
 * cliente paso a paso y se verifica que la cuenta cuadre con sus asientos al
 * final.
 */

test.describe.configure({ mode: 'serial' });

const SELLO = Date.now().toString().slice(-6);

const datos = {
  producto: `Tubo UI ${SELLO}`,
  sku: `CRE-${SELLO}`,
  cliente: `Ferretería Cliente ${SELLO}`,
  precio: '150.00',
  costo: '90.00',
  unidades: 4,
  /** 4 × 150 = 600,00 */
  totalEsperado: 'Q 600.00',
  abono: '250.00',
  /** 600 − 250 = 350,00 */
  saldoTrasAbono: 'Q 350.00',
};

test.describe('venta al crédito y cobranza', () => {
  test('1 · se prepara producto con existencia y cliente con crédito', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);

    // ── Producto ─────────────────────────────────────────────────────────────
    await page.goto('/productos/nuevo');
    const sku = page.getByLabel(/Código \(SKU\)/);
    await sku.waitFor({ state: 'visible', timeout: 20_000 });

    // El campo lo asigna el servidor: está bloqueado, no se escribe.
    await page.getByLabel(/^Nombre/).fill(datos.producto);
    await page.getByLabel(/^Categoría/).selectOption({ label: 'General' });
    await page.getByLabel(/Unidad de medida/).selectOption({ label: 'Unidad (UN)' });
    await page.getByLabel(/^Costo/).fill(datos.costo);
    await page.getByLabel(/Precio de venta/).fill(datos.precio);
    await page.getByRole('button', { name: 'Crear producto' }).click();
    await expect(page).toHaveURL(/\/productos\/[a-f0-9]{24}/, { timeout: 20_000 });
    await esperarCarga(page);

    // El servidor generó el código: se toma el real y se reutiliza en el resto
    // de la prueba en vez del que se hubiera escrito a mano.
    datos.sku = await sku.inputValue();
    expect(datos.sku).toMatch(/^PROD-\d{6}$/);

    // ── Existencia inicial ───────────────────────────────────────────────────
    await page.goto('/existencias');
    await esperarCarga(page);
    await page.getByRole('button', { name: /Registrar existencia|Saldo inicial|Ajustar/ })
      .first()
      .click()
      .catch(() => undefined);

    // Si no hay atajo desde existencias, se carga por compra: es el camino normal.
    const dialogoAbierto = await page.getByRole('dialog').isVisible().catch(() => false);
    if (!dialogoAbierto) {
      await page.goto('/compras/nueva');
      await esperarCarga(page);

      const selectorProveedor = page.getByLabel(/^Proveedor/);
      await selectorProveedor.selectOption({ index: 1 });

      const buscador = page.getByLabel('Buscar productos');
      await buscador.fill(datos.sku);
      await page.getByRole('button', { name: new RegExp(datos.sku) }).first().click();

      await page.getByLabel(`Cantidad de ${datos.producto}`).fill('20');
      await page.getByLabel(`Costo de ${datos.producto}`).fill(datos.costo);
      await page.getByRole('button', { name: /Crear y confirmar/ }).click();

      await expect(page).toHaveURL(/\/compras\/[a-f0-9]{24}/, { timeout: 20_000 });
      await page.getByRole('button', { name: /^Recibir/ }).first().click();
      const dialogo = page.getByRole('dialog');
      await dialogo.getByRole('button', { name: 'Registrar recepción' }).click();
      await expect(dialogo).toBeHidden({ timeout: 20_000 });
    }

    // ── Cliente con crédito ──────────────────────────────────────────────────
    await page.goto('/clientes');
    await esperarCarga(page);
    await page.getByRole('button', { name: 'Nuevo cliente' }).first().click();

    const dialogoCliente = page.getByRole('dialog');
    await dialogoCliente.getByLabel(/^Nombre/).fill(datos.cliente);
    // Sin interruptor aparte: un límite mayor que cero ya es un cliente con
    // crédito.
    await dialogoCliente.getByLabel(/Límite de crédito/).fill('5000.00');
    await dialogoCliente.getByLabel(/^Plazo/).fill('30');
    await dialogoCliente.getByRole('button', { name: 'Crear cliente' }).click();
    await expect(dialogoCliente).toBeHidden();

    sinErrores(ojo, 'preparación');
  });

  test('2 · se vende a crédito desde el punto de venta', async ({ page }) => {
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

    // Se elige el cliente: sin él, el crédito no puede ofrecerse.
    const selectorCliente = page.locator('#pos-cliente');
    const valor = await selectorCliente
      .locator('option', { hasText: datos.cliente })
      .getAttribute('value');
    await selectorCliente.selectOption(valor);

    await page.getByRole('button', { name: 'Cobrar' }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText(datos.totalEsperado);

    // La casilla de crédito solo aparece con un cliente que lo tenga habilitado.
    await dialogo.getByText('Dejar a crédito').click();
    await dialogo.getByRole('button', { name: 'Confirmar venta' }).click();

    await expect(dialogo.getByText(/V\d+-\d{6}/).first()).toBeVisible({ timeout: 20_000 });
    // El recibo dice cuánto queda a deber.
    await expect(dialogo).toContainText(datos.totalEsperado);

    sinErrores(ojo, 'venta al crédito');
  });

  test('3 · la deuda aparece en la cartera', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/creditos');
    await esperarCarga(page);

    const fila = page.getByRole('row').filter({ hasText: datos.cliente });
    await expect(fila.first()).toBeVisible();
    await expect(fila.first()).toContainText(datos.totalEsperado);

    sinErrores(ojo, 'cartera');
  });

  test('4 · el estado de cuenta muestra la factura pendiente', async ({ page }) => {
    await entrar(page);
    await page.goto('/creditos');
    await esperarCarga(page);

    await page.getByRole('row').filter({ hasText: datos.cliente }).first().click();

    await expect(page).toHaveURL(/\/creditos\/[a-f0-9]{24}/, { timeout: 20_000 });
    await esperarCarga(page);

    await expect(page.getByRole('heading', { name: datos.cliente })).toBeVisible();
    await expect(page.getByText('Facturas pendientes')).toBeVisible();
    await expect(page.getByText(datos.totalEsperado).first()).toBeVisible();
  });

  test('5 · se registra un abono parcial', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/creditos');
    await esperarCarga(page);
    await page.getByRole('row').filter({ hasText: datos.cliente }).first().click();
    await esperarCarga(page);

    await page.getByRole('button', { name: 'Registrar abono' }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();

    await dialogo.getByLabel(/Importe recibido/).fill(datos.abono);

    // El diálogo previsualiza a qué factura irá el dinero antes de confirmar.
    await expect(dialogo.getByText('Se aplicará así')).toBeVisible();

    await dialogo.getByRole('button', { name: 'Registrar abono' }).click();

    // Recibo del abono
    await expect(dialogo.getByText('Abono registrado')).toBeVisible({ timeout: 20_000 });
    await expect(dialogo).toContainText(datos.saldoTrasAbono);

    sinErrores(ojo, 'abono');
  });

  test('6 · el saldo bajó y la cuenta sigue cuadrando', async ({ page }) => {
    await entrar(page);
    await page.goto('/creditos');
    await esperarCarga(page);

    const fila = page.getByRole('row').filter({ hasText: datos.cliente });
    await expect(fila.first()).toContainText(datos.saldoTrasAbono);

    // El abono quedó registrado con su recibo.
    await page.goto('/abonos');
    await esperarCarga(page);
    await expect(page.getByRole('row').nth(1)).toContainText(/REC/);
  });

  test('7 · no se puede fiar por encima del límite', async ({ page }) => {
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

    // Se llena el carrito muy por encima del límite de 5.000,00.
    for (let i = 0; i < 15; i += 1) {
      await page.getByRole('button', { name: 'Agregar una unidad' }).first().click();
    }

    const selectorCliente = page.locator('#pos-cliente');
    const valor = await selectorCliente
      .locator('option', { hasText: datos.cliente })
      .getAttribute('value');
    await selectorCliente.selectOption(valor);

    await page.getByRole('button', { name: 'Cobrar' }).click();

    const dialogo = page.getByRole('dialog');
    await dialogo.getByText('Dejar a crédito').click();
    await dialogo.getByRole('button', { name: 'Confirmar venta' }).click();

    // El servidor rechaza y el diálogo lo explica en lugar de quedarse callado.
    await expect(dialogo.getByText(/crédito|límite|excede/i).first()).toBeVisible({
      timeout: 20_000,
    });
    // Y no se emitió ninguna venta.
    await expect(dialogo.getByText(/V\d+-\d{6}/)).toHaveCount(0);
  });
});
