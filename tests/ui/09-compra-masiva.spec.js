import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Alta masiva de una orden de compra, por la interfaz.
 *
 * Antes cada producto de la compra se buscaba y se agregaba uno por uno; ahora
 * se puede pegar la lista entera —código, cantidad y costo opcional— y que el
 * formulario la resuelva de un golpe. La factura del proveedor también se
 * registra en la orden, para poder conciliarla después.
 */

test.describe.configure({ mode: 'serial' });

const SELLO = Date.now().toString().slice(-6);

const datos = {
  proveedor: `Distribuidora masiva ${SELLO}`,
  productoA: `Tornillo masivo ${SELLO}`,
  productoB: `Tuerca masiva ${SELLO}`,
  skuA: '',
  skuB: '',
  factura: `FAC-${SELLO}`,
};

test.describe('alta masiva de una compra', () => {
  test('1 · se preparan un proveedor y dos productos', async ({ page }) => {
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

    for (const [nombre, guardarEn] of [
      [datos.productoA, 'skuA'],
      [datos.productoB, 'skuB'],
    ]) {
      await page.goto('/productos/nuevo');
      await esperarCarga(page);

      const sku = page.getByLabel(/Código \(SKU\)/);
      await sku.waitFor({ state: 'visible', timeout: 20_000 });

      await page.getByLabel(/^Nombre/).fill(nombre);
      await page.getByLabel(/^Categoría/).selectOption({ label: 'General' });
      await page.getByLabel(/Unidad de medida/).selectOption({ label: 'Unidad (UN)' });
      await page.getByLabel(/^Costo/).fill('5.00');
      await page.getByLabel(/Precio de venta/).fill('10.00');
      await page.getByRole('button', { name: 'Crear producto' }).click();

      await expect(page).toHaveURL(/\/productos\/[a-f0-9]{24}/, { timeout: 20_000 });
      await esperarCarga(page);

      datos[guardarEn] = await sku.inputValue();
      expect(datos[guardarEn]).toMatch(/^PROD-\d{6}$/);
    }

    sinErrores(ojo, 'preparación de compra masiva');
  });

  test('2 · se pega la lista completa y se resuelve de un golpe', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/compras/nueva');
    await esperarCarga(page);

    const selectorProveedor = page.getByLabel(/^Proveedor/);
    const valorProveedor = await selectorProveedor
      .locator('option', { hasText: datos.proveedor })
      .getAttribute('value');
    await selectorProveedor.selectOption(valorProveedor);

    await page.getByLabel(/Número de factura del proveedor/).fill(datos.factura);

    await page.getByRole('button', { name: 'Pegar lista' }).click();

    const textarea = page.getByLabel('Una línea por producto');
    await expect(textarea).toBeVisible();
    await textarea.fill(`${datos.skuA} 20 8.00\n${datos.skuB} 15`);

    await page.getByRole('button', { name: 'Agregar todo' }).click();

    // Las dos líneas entraron sin buscarlas ni hacer clic una por una.
    await expect(page.getByText('2 productos agregados')).toBeVisible();
    await expect(page.getByText(datos.productoA)).toBeVisible();
    await expect(page.getByText(datos.productoB)).toBeVisible();
    await expect(page.getByLabel(`Cantidad de ${datos.productoA}`)).toHaveValue('20');
    await expect(page.getByLabel(`Costo de ${datos.productoA}`)).toHaveValue('8.00');
    // Sin costo en la línea pegada, se propuso el que ya tenía el producto.
    await expect(page.getByLabel(`Cantidad de ${datos.productoB}`)).toHaveValue('15');
    await expect(page.getByLabel(`Costo de ${datos.productoB}`)).toHaveValue('5.00');

    await page.getByRole('button', { name: /Crear y confirmar/ }).click();
    await expect(page).toHaveURL(/\/compras\/[a-f0-9]{24}/, { timeout: 20_000 });
    await esperarCarga(page);

    // La factura del proveedor queda visible en la orden ya creada.
    await expect(page.getByText(datos.factura)).toBeVisible();

    sinErrores(ojo, 'compra masiva');
  });

  test('3 · un código que no existe se reporta sin bloquear lo demás', async ({ page }) => {
    await entrar(page);
    await page.goto('/compras/nueva');
    await esperarCarga(page);

    const selectorProveedor = page.getByLabel(/^Proveedor/);
    await selectorProveedor.selectOption({ index: 1 });

    await page.getByRole('button', { name: 'Pegar lista' }).click();
    const textarea = page.getByLabel('Una línea por producto');
    await textarea.fill(`${datos.skuA} 5\nPROD-000000 3`);

    await page.getByRole('button', { name: 'Agregar todo' }).click();

    await expect(page.getByText('1 producto agregado')).toBeVisible();
    await expect(page.getByText(/No se encontró: PROD-000000/)).toBeVisible();
    await expect(page.getByText(datos.productoA)).toBeVisible();
  });

  test('4 · escanear y Enter agrega lo recién escrito, no lo de la búsqueda anterior', async ({ page }) => {
    await entrar(page);
    await page.goto('/compras/nueva');
    await esperarCarga(page);

    const selectorProveedor = page.getByLabel(/^Proveedor/);
    await selectorProveedor.selectOption({ index: 1 });

    const buscador = page.getByLabel('Buscar productos');

    // Primero se deja cargar una búsqueda para que quede algo «viejo» en el
    // estado con el que se arma la lista de resultados con espera.
    await buscador.fill(datos.skuA);
    await esperarCarga(page);

    // Un lector de código de barras escribe y manda Enter mucho más rápido que
    // los 300 ms de espera de la búsqueda: se limpia el campo y se escanea el
    // segundo producto sin darle tiempo a esa espera. Si el Enter usara la
    // lista vieja, agregaría el producto A otra vez o no agregaría nada.
    await buscador.fill('');
    await buscador.fill(datos.skuB);
    await buscador.press('Enter');

    await expect(page.getByText(datos.productoB)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(`Cantidad de ${datos.productoB}`)).toHaveValue('1');
  });
});
