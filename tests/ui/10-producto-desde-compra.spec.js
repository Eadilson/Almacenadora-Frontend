import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Alta de un producto nuevo desde la propia compra, por la interfaz.
 *
 * Antes, un producto que todavía no existía obligaba a salirse de la compra,
 * crearlo en Productos y volver a buscarlo. El producto casi siempre se conoce
 * hasta que llega la primera compra —no antes—, así que la compra deja darlo de
 * alta ahí mismo y lo agrega a la orden en el mismo paso.
 */

test.describe.configure({ mode: 'serial' });

const SELLO = Date.now().toString().slice(-6);

const datos = {
  proveedor: `Distribuidora alta rápida ${SELLO}`,
  producto: `Candado nuevo ${SELLO}`,
  costo: '35.00',
  precio: '65.00',
  productoConAtributos: `Cable nuevo ${SELLO}`,
};

test.describe('producto nuevo desde una compra', () => {
  test('1 · se prepara un proveedor', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/proveedores');
    await esperarCarga(page);

    await page.getByRole('button', { name: 'Nuevo proveedor' }).first().click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByLabel(/^Nombre/).fill(datos.proveedor);
    await dialogo.getByRole('button', { name: 'Crear proveedor' }).click();
    await expect(dialogo).toBeHidden();

    sinErrores(ojo, 'preparación');
  });

  test('2 · se busca un producto que no existe y se crea sin salir de la compra', async ({ page }) => {
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
    await buscador.fill(datos.producto);
    await esperarCarga(page);

    const aviso = page.getByText('No hay ningún producto que coincida.');
    await expect(aviso).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: `Crear «${datos.producto}» como producto nuevo` }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    // El nombre viene precargado con lo que ya se había escrito.
    await expect(dialogo.getByLabel('Nombre')).toHaveValue(datos.producto);

    await dialogo.getByLabel(/^Categoría/).selectOption({ label: 'General' });
    await dialogo.getByLabel(/Unidad de medida/).selectOption({ label: 'Unidad (UN)' });
    await dialogo.getByLabel(/^Costo/).fill(datos.costo);
    await dialogo.getByLabel(/Precio de venta/).fill(datos.precio);
    await dialogo.getByRole('button', { name: 'Crear y agregar' }).click();

    await expect(dialogo).toBeHidden({ timeout: 20_000 });

    // Entró directo a la línea de la orden, con el costo que se acaba de dar.
    await expect(page.getByText(datos.producto)).toBeVisible();
    await expect(page.getByLabel(`Cantidad de ${datos.producto}`)).toHaveValue('1');
    await expect(page.getByLabel(`Costo de ${datos.producto}`)).toHaveValue(datos.costo);

    // Y ya es un producto real del catálogo: aparece al buscarlo de nuevo.
    await page.goto('/productos');
    await esperarCarga(page);
    await page.getByPlaceholder(/Buscar/).first().fill(datos.producto);
    await esperarCarga(page);
    await expect(page.getByText(datos.producto).first()).toBeVisible();

    sinErrores(ojo, 'alta de producto desde una compra');
  });

  test('3 · una categoría con campos propios los exige, y el error se ve si faltan', async ({ page }) => {
    await entrar(page);
    await page.goto('/compras/nueva');
    await esperarCarga(page);

    const selectorProveedor = page.getByLabel(/^Proveedor/);
    const valorProveedor = await selectorProveedor
      .locator('option', { hasText: datos.proveedor })
      .getAttribute('value');
    await selectorProveedor.selectOption(valorProveedor);

    await page.getByRole('button', { name: 'Nuevo producto' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();

    await dialogo.getByLabel('Nombre').fill(datos.productoConAtributos);
    await dialogo.getByLabel(/^Categoría/).selectOption({ label: 'Cables eléctricos' });
    await dialogo.getByLabel(/Unidad de medida/).selectOption({ label: 'Unidad (UN)' });
    await dialogo.getByLabel(/^Costo/).fill(datos.costo);
    await dialogo.getByLabel(/Precio de venta/).fill(datos.precio);

    // Sin llenar «Calibre» ni «Aislamiento», que esta categoría exige: antes
    // esto fallaba en silencio y el botón parecía no hacer nada.
    await dialogo.getByRole('button', { name: 'Crear y agregar' }).click();
    await expect(dialogo.getByText(/Seleccione «Calibre»/)).toBeVisible();
    // Y el diálogo sigue abierto: no se perdió lo ya escrito.
    await expect(dialogo).toBeVisible();

    await dialogo.getByLabel(/^Calibre/).selectOption({ label: '12 AWG' });
    await dialogo.getByLabel(/^Aislamiento/).selectOption({ label: 'THHN' });
    await dialogo.getByRole('button', { name: 'Crear y agregar' }).click();

    await expect(dialogo).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText(datos.productoConAtributos)).toBeVisible();
  });
});
