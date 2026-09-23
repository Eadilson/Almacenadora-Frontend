import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Agregar un campo repetido a una categoría, por la interfaz.
 *
 * El formulario llamaba a la mutación sin capturar el rechazo: si el servidor
 * decía que no —una clave que ya existía en esa categoría—, la promesa se
 * perdía sin manejar. No había ninguna prueba que hubiera hecho fallar esto.
 * Esta cubre que el segundo intento con la misma clave se rechaza de forma
 * visible, sin romper la pantalla.
 */

test.describe.configure({ mode: 'serial' });

const SELLO = Date.now().toString().slice(-6);

const datos = {
  categoria: `Categoría atributos ${SELLO}`,
  clave: 'campoRepetido',
};

test.describe('atributo de categoría duplicado', () => {
  test('1 · se crea una categoría y un campo', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/categorias');
    await esperarCarga(page);

    await page.getByRole('button', { name: 'Nueva categoría' }).click();
    await page.getByLabel('Nombre').fill(datos.categoria);
    await page.getByRole('button', { name: 'Crear' }).click();

    await page.getByRole('button', { name: new RegExp(datos.categoria) }).click();
    await expect(page.getByRole('heading', { name: datos.categoria })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('button', { name: 'Agregar campo' }).click();
    await page.getByLabel('Nombre del campo').fill('Campo repetido');
    await page.getByLabel('Identificador').fill(datos.clave);
    await page.getByRole('button', { name: 'Agregar campo' }).click();

    await expect(page.getByText(datos.clave)).toBeVisible({ timeout: 10_000 });

    sinErrores(ojo, 'alta de campo de categoría');
  });

  test('2 · repetir la clave se rechaza sin romper la pantalla', async ({ page }) => {
    await entrar(page);
    await page.goto('/categorias');
    await esperarCarga(page);
    await page.getByRole('button', { name: new RegExp(datos.categoria) }).click();
    await expect(page.getByRole('heading', { name: datos.categoria })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('button', { name: 'Agregar campo' }).click();
    await page.getByLabel('Nombre del campo').fill('Otro nombre, misma clave');
    await page.getByLabel('Identificador').fill(datos.clave);
    await page.getByRole('button', { name: 'Agregar campo' }).click();

    // El rechazo se ve en un aviso, no se pierde: y la pantalla sigue
    // respondiendo, no queda a medias ni se rompe. El formulario de alta
    // sigue ahí —no se cerró como si hubiera guardado—.
    await expect(page.getByText(/ya tiene un atributo/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Nombre del campo')).toBeVisible();
  });
});
