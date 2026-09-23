import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Código de producto autogenerado, hecho a mano por la interfaz.
 *
 * Antes el campo era obligatorio y forzaba a inventar un código en el momento;
 * ahora, igual que ya pasa con clientes y proveedores, dejarlo en blanco basta.
 */

const SELLO = Date.now().toString().slice(-6);

test.describe('código de producto automático', () => {
  test('se deja en blanco y el servidor sugiere uno', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/productos/nuevo');
    await esperarCarga(page);

    const sku = page.getByLabel(/Código \(SKU\)/);
    await sku.waitFor({ state: 'visible', timeout: 20_000 });

    // No se toca el campo: es justo lo que se está probando.
    await page.getByLabel(/^Nombre/).fill(`Producto sin código ${SELLO}`);
    await page.getByLabel(/^Categoría/).selectOption({ label: 'General' });
    await page.getByLabel(/Unidad de medida/).selectOption({ label: 'Unidad (UN)' });
    await page.getByLabel(/^Costo/).fill('50.00');
    await page.getByLabel(/Precio de venta/).fill('100.00');

    await page.getByRole('button', { name: 'Crear producto' }).click();

    await expect(page).toHaveURL(/\/productos\/[a-f0-9]{24}/, { timeout: 20_000 });
    await esperarCarga(page);

    // El servidor lo generó: el campo no llega vacío ni con lo que se dejó sin
    // escribir, sino con un código real del formato correlativo.
    await expect(page.getByLabel(/Código \(SKU\)/)).toHaveValue(/^PROD-\d{6}$/);

    sinErrores(ojo, 'alta de producto sin código');
  });

  test('dos productos seguidos sin código reciben códigos distintos', async ({ page }) => {
    await entrar(page);

    const codigos = [];

    for (let i = 0; i < 2; i += 1) {
      await page.goto('/productos/nuevo');
      await esperarCarga(page);

      await page.getByLabel(/Código \(SKU\)/).waitFor({ state: 'visible', timeout: 20_000 });
      await page.getByLabel(/^Nombre/).fill(`Producto sin código ${SELLO}-${i}`);
      await page.getByLabel(/^Categoría/).selectOption({ label: 'General' });
      await page.getByLabel(/Unidad de medida/).selectOption({ label: 'Unidad (UN)' });
      await page.getByLabel(/^Costo/).fill('10.00');
      await page.getByLabel(/Precio de venta/).fill('20.00');
      await page.getByRole('button', { name: 'Crear producto' }).click();

      await expect(page).toHaveURL(/\/productos\/[a-f0-9]{24}/, { timeout: 20_000 });
      await esperarCarga(page);

      codigos.push(await page.getByLabel(/Código \(SKU\)/).inputValue());
    }

    expect(codigos[0]).not.toBe(codigos[1]);
  });
});
