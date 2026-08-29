import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Devolución de una venta de contado, hecha a mano por la interfaz.
 *
 * A diferencia de anular, la factura sigue viva por lo que sí se quedó el
 * cliente: lo que se comprueba aquí es que el diálogo de devolución cierra
 * correctamente el ciclo —línea disponible, se devuelve una parte, se devuelve el
 * resto, no queda nada más que devolver— y que la nota de crédito y el estado se
 * ven en la pantalla, no solo en la respuesta del servidor.
 */

test.describe.configure({ mode: 'serial' });

const SELLO = Date.now().toString().slice(-6);

const datos = {
  proveedor: `Distribuidora UI devolución ${SELLO}`,
  producto: `Producto UI devolución ${SELLO}`,
  sku: `UI-DEV-${SELLO}`,
  costo: '50.00',
  precio: '100.00',
};

test.describe('devolución de una venta', () => {
  test('1 · se prepara un proveedor y un producto', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/proveedores');
    await esperarCarga(page);

    await page.getByRole('button', { name: 'Nuevo proveedor' }).first().click();
    const dialogoProveedor = page.getByRole('dialog');
    await expect(dialogoProveedor).toBeVisible();
    await dialogoProveedor.getByLabel(/^Nombre/).fill(datos.proveedor);
    await dialogoProveedor.getByRole('button', { name: 'Crear proveedor' }).click();
    await expect(dialogoProveedor).toBeHidden();

    await page.goto('/productos/nuevo');
    await esperarCarga(page);

    const sku = page.getByLabel(/Código \(SKU\)/);
    await sku.waitFor({ state: 'visible', timeout: 20_000 });

    await sku.fill(datos.sku);
    await page.getByLabel(/^Nombre/).fill(datos.producto);
    // «General» no exige atributos propios: no es lo que se está probando aquí.
    await page.getByLabel(/^Categoría/).selectOption({ label: 'General' });
    await page.getByLabel(/Unidad de medida/).selectOption({ label: 'Unidad (UN)' });
    await page.getByLabel(/^Costo/).fill(datos.costo);
    await page.getByLabel(/Precio de venta/).fill(datos.precio);
    await page.getByLabel(/Stock mínimo/).fill('1');

    await page.getByRole('button', { name: 'Crear producto' }).click();
    await expect(page).toHaveURL(/\/productos\/[a-f0-9]{24}/, { timeout: 20_000 });

    sinErrores(ojo, 'alta de proveedor y producto');
  });

  test('2 · se compra y se recibe la mercancía', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
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
    await page.getByText(datos.producto).first().click();

    await page.getByLabel(`Cantidad de ${datos.producto}`).fill('10');
    await page.getByLabel(`Costo de ${datos.producto}`).fill(datos.costo);
    await page.getByRole('button', { name: /Crear y confirmar/ }).click();

    await expect(page).toHaveURL(/\/compras\/[a-f0-9]{24}/, { timeout: 20_000 });
    await esperarCarga(page);

    await page.getByRole('button', { name: /^Recibir/ }).first().click();
    const dialogoRecepcion = page.getByRole('dialog');
    await expect(dialogoRecepcion).toBeVisible();
    await dialogoRecepcion.getByRole('button', { name: 'Registrar recepción' }).click();
    await expect(dialogoRecepcion).toBeHidden({ timeout: 20_000 });

    sinErrores(ojo, 'compra y recepción para devolución');
  });

  test('3 · se vende de contado en el punto de venta', async ({ page }) => {
    await entrar(page);
    await page.goto('/ventas/nueva');
    await esperarCarga(page);

    const buscador = page.getByLabel('Buscar productos para vender');
    await buscador.fill(datos.sku);

    const resultado = page.getByRole('button', { name: new RegExp(datos.sku) });
    await resultado.first().waitFor({ state: 'visible', timeout: 20_000 });
    await buscador.press('Enter');

    await expect(page.getByRole('button', { name: `Quitar ${datos.producto}` })).toBeVisible({
      timeout: 10_000,
    });
    // Tres unidades: una se devolverá primero, y las otras dos después.
    await page.getByRole('button', { name: 'Agregar una unidad' }).first().click();
    await page.getByRole('button', { name: 'Agregar una unidad' }).first().click();

    await page.getByRole('button', { name: 'Cobrar' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Confirmar venta' }).click();

    const numero = await dialogo.getByText(/V\d+-\d{6}/).first().textContent({ timeout: 20_000 });
    datos.numero = numero.trim();
  });

  test('4 · se devuelve una unidad y la venta queda parcialmente devuelta', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/ventas');
    await esperarCarga(page);

    await page.getByPlaceholder(/Buscar/).first().fill(datos.numero);
    await esperarCarga(page);
    await page.getByRole('row').filter({ hasText: datos.numero }).first().click();
    await expect(page).toHaveURL(/\/ventas\/[a-f0-9]{24}/, { timeout: 20_000 });

    await page.getByRole('button', { name: 'Devolver' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();

    await dialogo.locator('input[type="number"]').first().fill('1');
    await dialogo
      .getByLabel(/Motivo/)
      .fill('El cliente trajo una unidad con un defecto de fábrica.');
    await dialogo.getByRole('button', { name: 'Registrar devolución' }).click();

    await expect(dialogo).toBeHidden({ timeout: 20_000 });

    // El estado y la nota de crédito se ven en la propia pantalla.
    await expect(page.getByText('Devuelta en parte')).toBeVisible();
    await expect(page.getByText(/Parte de esta venta se devolvió/)).toBeVisible();
    await expect(page.getByText(/^NC01-/)).toBeVisible();

    sinErrores(ojo, 'devolución parcial');
  });

  test('5 · se devuelve el resto y la venta queda devuelta por completo', async ({ page }) => {
    await entrar(page);
    await page.goto('/ventas');
    await esperarCarga(page);

    await page.getByPlaceholder(/Buscar/).first().fill(datos.numero);
    await esperarCarga(page);
    await page.getByRole('row').filter({ hasText: datos.numero }).first().click();
    await expect(page).toHaveURL(/\/ventas\/[a-f0-9]{24}/, { timeout: 20_000 });

    await page.getByRole('button', { name: 'Devolver' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();

    // Ya no quedan dos por devolver del catálogo anterior: solo aparece la línea
    // con lo que de verdad sigue disponible.
    await dialogo.locator('input[type="number"]').first().fill('2');
    await dialogo.getByLabel(/Motivo/).fill('Devuelve también el resto de la compra.');
    await dialogo.getByRole('button', { name: 'Registrar devolución' }).click();

    await expect(dialogo).toBeHidden({ timeout: 20_000 });

    await expect(page.getByText('Devuelta', { exact: true })).toBeVisible();
    await expect(page.getByText(/Se devolvió todo lo vendido/)).toBeVisible();

    // Y ya no hay nada más que devolver.
    await expect(page.getByRole('button', { name: 'Devolver' })).toHaveCount(0);
  });
});
