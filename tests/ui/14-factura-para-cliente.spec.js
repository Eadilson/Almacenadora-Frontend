import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Lo que se imprime para el cliente no lleva costo ni utilidad, por la
 * interfaz.
 *
 * En pantalla, quien tiene permiso de ver costos los sigue viendo —es
 * información suya para decidir precios—. Pero lo que sale por «Imprimir» es
 * la factura que se entrega al cliente, y esa nunca debe llevar el margen con
 * el que se trabaja, sin importar el permiso de quien esté imprimiendo.
 */

const SELLO = Date.now().toString().slice(-6);

const datos = {
  producto: `Producto factura ${SELLO}`,
  proveedor: `Proveedor factura ${SELLO}`,
  costo: '30.00',
  precio: '60.00',
};

test('el costo y la utilidad se ven en pantalla pero no salen impresos', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Crear producto' }).click();
  await expect(page).toHaveURL(/\/productos\/[a-f0-9]{24}/, { timeout: 20_000 });
  const codigo = await sku.inputValue();

  await page.goto('/compras/nueva');
  await esperarCarga(page);
  const selectorProveedor = page.getByLabel(/^Proveedor/);
  const valorProveedor = await selectorProveedor
    .locator('option', { hasText: datos.proveedor })
    .getAttribute('value');
  await selectorProveedor.selectOption(valorProveedor);

  const buscadorCompra = page.getByLabel('Buscar productos');
  await buscadorCompra.fill(codigo);
  await esperarCarga(page);
  await page.getByRole('button', { name: new RegExp(codigo) }).first().click();
  await page.getByLabel(`Cantidad de ${datos.producto}`).fill('5');
  await page.getByLabel(`Costo de ${datos.producto}`).fill(datos.costo);
  await page.getByRole('button', { name: /Crear y confirmar/ }).click();
  await expect(page).toHaveURL(/\/compras\/[a-f0-9]{24}/, { timeout: 20_000 });
  await page.getByRole('button', { name: /^Recibir/ }).first().click();
  const dialogoRecepcion = page.getByRole('dialog');
  await dialogoRecepcion.getByRole('button', { name: 'Registrar recepción' }).click();
  await expect(dialogoRecepcion).toBeHidden({ timeout: 20_000 });

  await page.goto('/ventas/nueva');
  await esperarCarga(page);
  const buscador = page.getByLabel('Buscar productos para vender');
  await buscador.fill(codigo);
  await page.getByRole('button', { name: new RegExp(codigo) }).first().waitFor({
    state: 'visible',
    timeout: 20_000,
  });
  await buscador.press('Enter');

  await page.getByRole('button', { name: 'Cobrar' }).click();
  const dialogoCobro = page.getByRole('dialog');
  await expect(dialogoCobro).toBeVisible();
  await dialogoCobro.getByLabel(/Efectivo recibido/).fill(datos.precio);
  await dialogoCobro.getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(dialogoCobro.getByText(/V\d+-\d{6}/).first()).toBeVisible({ timeout: 20_000 });
  await dialogoCobro.getByRole('link', { name: 'Ver detalle' }).click();
  await expect(page).toHaveURL(/\/ventas\/[a-f0-9]{24}/, { timeout: 20_000 });
  await esperarCarga(page);

  const filaUtilidad = page.getByText('Utilidad', { exact: true });

  // En pantalla, con el permiso de costos, ambos se ven.
  await expect(page.getByRole('columnheader', { name: 'Costo' })).toBeVisible();
  await expect(filaUtilidad).toBeVisible();

  // Al imprimir, no: es el documento que se le entrega al cliente.
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('columnheader', { name: 'Costo' })).toBeHidden();
  await expect(filaUtilidad).toBeHidden();

  // Lo demás de la factura sigue ahí: no se escondió de más.
  await expect(page.getByText(datos.producto)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Total' })).toBeVisible();

  sinErrores(ojo, 'factura sin costo ni utilidad al imprimir');
});
