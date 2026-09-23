import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Anulaciones, correcciones y cancelaciones, por la interfaz.
 *
 * Estos cuatro diálogos —anular venta, anular abono, corregir un movimiento,
 * cancelar una orden de compra— llamaban a `mutateAsync` sin capturar el
 * rechazo: si el servidor decía que no, el diálogo se quedaba abierto sin
 * ningún mensaje. Ninguno tenía prueba de interfaz que lo ejerciera. Esta
 * cubre el camino feliz de los cuatro, para que una regresión futura sí se
 * note aquí.
 */

test.describe.configure({ mode: 'serial' });

const SELLO = Date.now().toString().slice(-6);

const datos = {
  producto: `Producto anulaciones ${SELLO}`,
  sku: '',
  cliente: `Cliente anulaciones ${SELLO}`,
  proveedor: `Proveedor anulaciones ${SELLO}`,
  precio: '80.00',
  costo: '40.00',
};

test.describe('anulaciones y correcciones', () => {
  test('1 · se prepara producto, cliente y proveedor', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);

    await page.goto('/proveedores');
    await esperarCarga(page);
    await page.getByRole('button', { name: 'Nuevo proveedor' }).first().click();
    const dialogoProveedor = page.getByRole('dialog');
    await dialogoProveedor.getByLabel(/^Nombre/).fill(datos.proveedor);
    await dialogoProveedor.getByRole('button', { name: 'Crear proveedor' }).click();
    await expect(dialogoProveedor).toBeHidden();

    await page.goto('/productos/nuevo');
    await esperarCarga(page);
    const sku = page.getByLabel(/Código \(SKU\)/);
    await sku.waitFor({ state: 'visible', timeout: 20_000 });
    await page.getByLabel(/^Nombre/).fill(datos.producto);
    await page.getByLabel(/^Categoría/).selectOption({ label: 'General' });
    await page.getByLabel(/Unidad de medida/).selectOption({ label: 'Unidad (UN)' });
    await page.getByLabel(/^Costo/).fill(datos.costo);
    await page.getByLabel(/Precio de venta/).fill(datos.precio);
    await page.getByLabel(/Stock mínimo/).fill('1');
    await page.getByRole('button', { name: 'Crear producto' }).click();
    await expect(page).toHaveURL(/\/productos\/[a-f0-9]{24}/, { timeout: 20_000 });
    await esperarCarga(page);
    datos.sku = await sku.inputValue();

    // Existencia por compra confirmada y recibida: es el camino normal, y deja
    // al producto con historial para que test 4 pueda ofrecer un ajuste (sin
    // historial, el diálogo solo ofrece «Saldo inicial»).
    await page.goto('/compras/nueva');
    await esperarCarga(page);
    const selectorProveedor = page.getByLabel(/^Proveedor/);
    const valorProveedor = await selectorProveedor
      .locator('option', { hasText: datos.proveedor })
      .getAttribute('value');
    await selectorProveedor.selectOption(valorProveedor);

    const buscadorCompra = page.getByLabel('Buscar productos');
    await buscadorCompra.fill(datos.sku);
    await esperarCarga(page);
    await page.getByRole('button', { name: new RegExp(datos.sku) }).first().click();
    await page.getByLabel(`Cantidad de ${datos.producto}`).fill('20');
    await page.getByLabel(`Costo de ${datos.producto}`).fill(datos.costo);
    await page.getByRole('button', { name: /Crear y confirmar/ }).click();

    await expect(page).toHaveURL(/\/compras\/[a-f0-9]{24}/, { timeout: 20_000 });
    await page.getByRole('button', { name: /^Recibir/ }).first().click();
    const dialogoRecepcion = page.getByRole('dialog');
    await expect(dialogoRecepcion).toBeVisible();
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

  test('2 · se vende de contado y se anula la venta', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/ventas/nueva');
    await esperarCarga(page);

    const buscador = page.getByLabel('Buscar productos para vender');
    await buscador.fill(datos.sku);
    await page
      .getByRole('button', { name: new RegExp(datos.sku) })
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    await buscador.press('Enter');

    await page.getByRole('button', { name: 'Cobrar' }).click();
    const dialogoCobro = page.getByRole('dialog');
    await expect(dialogoCobro).toBeVisible();
    await dialogoCobro.getByLabel(/Efectivo recibido/).fill(datos.precio);
    await dialogoCobro.getByRole('button', { name: 'Confirmar venta' }).click();

    const numero = await dialogoCobro.getByText(/V\d+-\d{6}/).first().textContent({ timeout: 20_000 });
    await dialogoCobro.getByRole('link', { name: 'Ver detalle' }).click();

    await expect(page).toHaveURL(/\/ventas\/[a-f0-9]{24}/, { timeout: 20_000 });
    await esperarCarga(page);

    await page.getByRole('button', { name: /Anular/ }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByLabel(/Motivo/).fill('Anulación de prueba: el cliente se arrepintió.');
    await dialogo.getByRole('button', { name: 'Anular venta' }).click();

    // Si el rechazo no se capturara, el diálogo se quedaría abierto sin decir
    // nada: la señal correcta es que se cierra y el estado cambia.
    await expect(dialogo).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText('Anulada', { exact: true })).toBeVisible();

    sinErrores(ojo, 'anulación de venta');
  });

  test('3 · se cancela una orden de compra en borrador', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/compras/nueva');
    await esperarCarga(page);

    const selectorProveedor = page.getByLabel(/^Proveedor/);
    const valorProveedor = await selectorProveedor
      .locator('option', { hasText: datos.proveedor })
      .getAttribute('value');
    await selectorProveedor.selectOption(valorProveedor);

    const buscador = page.getByLabel('Buscar productos');
    await buscador.fill(datos.sku);
    await esperarCarga(page);
    await page.getByRole('button', { name: new RegExp(datos.sku) }).first().click();
    await page.getByLabel(`Cantidad de ${datos.producto}`).fill('5');
    await page.getByLabel(`Costo de ${datos.producto}`).fill(datos.costo);

    // Se guarda como borrador, no confirmada: solo un borrador se cancela.
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page).toHaveURL(/\/compras\/[a-f0-9]{24}/, { timeout: 20_000 });
    await esperarCarga(page);

    await page.getByRole('button', { name: 'Cancelar' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByLabel(/Motivo/).fill('Cancelación de prueba: ya no se necesita.');
    await dialogo.getByRole('button', { name: 'Cancelar orden' }).click();

    await expect(dialogo).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText('Cancelada', { exact: true })).toBeVisible();

    sinErrores(ojo, 'cancelación de orden de compra');
  });

  test('4 · un ajuste se registra y se corrige desde el kardex', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/productos');
    await esperarCarga(page);
    await page.getByPlaceholder(/Buscar/).first().fill(datos.producto);
    await esperarCarga(page);
    await page.getByText(datos.producto).first().click();
    await esperarCarga(page);
    const productId = page.url().match(/\/productos\/([a-f0-9]{24})/)?.[1];
    expect(productId).toBeTruthy();

    // Se registra un ajuste de salida: es algo que corregir después.
    await page.goto('/existencias');
    await esperarCarga(page);
    await page.getByLabel('Buscar productos').fill(datos.producto);
    await esperarCarga(page);
    await page.getByLabel(`Mover existencias de ${datos.producto}`).click();

    const dialogoAjuste = page.getByRole('dialog');
    await expect(dialogoAjuste).toBeVisible();
    await dialogoAjuste.getByLabel(/Tipo de movimiento/).selectOption({ label: 'Ajuste de salida' });
    await dialogoAjuste.getByLabel(/Cantidad/).fill('1');
    await dialogoAjuste
      .getByLabel(/Motivo/)
      .fill('Ajuste de prueba: faltante detectado en conteo.');
    await dialogoAjuste.getByRole('button', { name: 'Registrar movimiento' }).click();
    await expect(dialogoAjuste).toBeHidden({ timeout: 20_000 });

    await page.goto(`/productos/${productId}/kardex`);
    await esperarCarga(page);

    // El más reciente es el que se acaba de registrar: el kardex lista del
    // último movimiento al primero.
    const filaAjuste = page.getByRole('row', { name: /Ajuste de salida/ }).first();
    await expect(filaAjuste).toBeVisible();
    await filaAjuste.getByRole('button', { name: /Corregir/ }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo
      .getByLabel(/Motivo/)
      .fill('Corrección de prueba: el ajuste se registró por error.');
    await dialogo.getByRole('button', { name: 'Registrar corrección' }).click();

    // Si el rechazo no se capturara, el diálogo se quedaría abierto sin decir
    // nada.
    await expect(dialogo).toBeHidden({ timeout: 20_000 });

    sinErrores(ojo, 'corrección de movimiento');
  });

  test('5 · se registra un abono y se anula', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/ventas/nueva');
    await esperarCarga(page);

    const buscador = page.getByLabel('Buscar productos para vender');
    await buscador.fill(datos.sku);
    await page
      .getByRole('button', { name: new RegExp(datos.sku) })
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    await buscador.press('Enter');

    const selectorCliente = page.locator('#pos-cliente');
    const valorCliente = await selectorCliente
      .locator('option', { hasText: datos.cliente })
      .getAttribute('value');
    await selectorCliente.selectOption(valorCliente);

    await page.getByRole('button', { name: 'Cobrar' }).click();
    const dialogoCobro = page.getByRole('dialog');
    await expect(dialogoCobro).toBeVisible();
    await dialogoCobro.getByText('Dejar a crédito').click();
    await dialogoCobro.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(dialogoCobro.getByText(/V\d+-\d{6}/).first()).toBeVisible({ timeout: 20_000 });

    // Cobranza: un abono para el mismo cliente.
    await page.goto('/creditos');
    await esperarCarga(page);
    await page.getByRole('row').filter({ hasText: datos.cliente }).first().click();
    await esperarCarga(page);
    await page.getByRole('button', { name: 'Registrar abono' }).click();

    const dialogoAbono = page.getByRole('dialog');
    await expect(dialogoAbono).toBeVisible();
    await dialogoAbono.getByLabel(/Importe recibido/).fill('20.00');
    await dialogoAbono.getByRole('button', { name: 'Registrar abono' }).click();
    await expect(dialogoAbono.getByText('Abono registrado')).toBeVisible({ timeout: 20_000 });

    // Se anula desde el listado de abonos.
    await page.goto('/abonos');
    await esperarCarga(page);
    await page
      .getByRole('row')
      .filter({ hasText: /REC/ })
      .first()
      .getByRole('button', { name: 'Anular' })
      .click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByLabel(/Motivo/).fill('Anulación de prueba: el abono se registró por error.');
    await dialogo.getByRole('button', { name: 'Anular abono' }).click();

    await expect(dialogo).toBeHidden({ timeout: 20_000 });

    sinErrores(ojo, 'anulación de abono');
  });
});
