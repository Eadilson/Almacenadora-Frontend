import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Editar un producto, por la interfaz.
 *
 * Un error inesperado al guardar se colocaba sobre el campo de código —que al
 * editar está bloqueado, así que nadie lo mira—: guardar parecía no hacer
 * nada, ni redirigía ni avisaba de qué había pasado. Ahora ese aviso tiene su
 * propio lugar, visible, junto al botón. Esta prueba cubre el camino que
 * nunca se había probado: editar y confirmar que sí guarda y sí redirige.
 */

test.describe.configure({ mode: 'serial' });

const SELLO = Date.now().toString().slice(-6);

const datos = {
  producto: `Cable editar ${SELLO}`,
  productoRenombrado: `Cable editado ${SELLO}`,
  costo: '20.00',
  precio: '35.00',
  precioNuevo: '40.00',
};

test('se edita un producto con atributos del rubro y se ve el resultado', async ({ page }) => {
  const ojo = vigilar(page);

  await entrar(page);
  await page.goto('/productos/nuevo');
  await esperarCarga(page);

  const sku = page.getByLabel(/Código \(SKU\)/);
  await sku.waitFor({ state: 'visible', timeout: 20_000 });
  await page.getByLabel(/^Nombre/).fill(datos.producto);
  await page.getByLabel(/^Categoría/).selectOption({ label: 'Cables eléctricos' });
  await page.getByLabel(/Unidad de medida/).selectOption({ label: 'Unidad (UN)' });
  await page.getByLabel(/^Calibre/).selectOption({ label: '12 AWG' });
  await page.getByLabel(/^Aislamiento/).selectOption({ label: 'THHN' });
  await page.getByLabel(/^Costo/).fill(datos.costo);
  await page.getByLabel(/Precio de venta/).fill(datos.precio);
  await page.getByRole('button', { name: 'Crear producto' }).click();

  await expect(page).toHaveURL(/\/productos\/[a-f0-9]{24}/, { timeout: 20_000 });
  await esperarCarga(page);

  // Recién creado ya cae en la propia pantalla de edición: se cambia algo y
  // se guarda otra vez, con los atributos del rubro ya cargados.
  await page.getByLabel(/^Nombre/).fill(datos.productoRenombrado);
  await page.getByLabel(/Precio de venta/).fill(datos.precioNuevo);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();

  // La señal correcta: redirige al listado y no se queda a medias ni
  // muda sin decir qué pasó.
  await expect(page).toHaveURL(/\/productos$/, { timeout: 20_000 });
  await expect(page.getByText('Cambios guardados')).toBeVisible();

  await page.getByPlaceholder(/Buscar/).first().fill(datos.productoRenombrado);
  await esperarCarga(page);
  await expect(page.getByText(datos.productoRenombrado).first()).toBeVisible();
  await expect(page.getByText(formatoPrecio(datos.precioNuevo))).toBeVisible();

  sinErrores(ojo, 'edición de producto');
});

/** @param {string} value */
function formatoPrecio(value) {
  return `Q ${value}`;
}
