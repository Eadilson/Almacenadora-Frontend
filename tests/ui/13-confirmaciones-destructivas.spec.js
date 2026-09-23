import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Confirmación antes de una acción sin vuelta atrás, por la interfaz.
 *
 * Eliminar un rol y desactivar un usuario eran un solo clic: la persona rozaba
 * el botón y ya estaba hecho, sin poder arrepentirse. Ahora ambos piden
 * confirmar en un diálogo aparte.
 */

test.describe.configure({ mode: 'serial' });

const SELLO = Date.now().toString().slice(-6);

const datos = {
  rol: `Rol desechable ${SELLO}`,
  clave: `QA_DESECHABLE_${SELLO}`,
};

test.describe('confirmación antes de eliminar o desactivar', () => {
  test('1 · eliminar un rol pide confirmar, y cancelar no elimina nada', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/roles');
    await esperarCarga(page);

    await page.getByRole('button', { name: 'Crear rol' }).click();
    const dialogoAlta = page.getByRole('dialog');
    await dialogoAlta.getByLabel(/^Nombre/).fill(datos.rol);
    await dialogoAlta.getByLabel(/^Clave/).fill(datos.clave);
    await dialogoAlta.getByText('Ver productos', { exact: true }).click();
    await dialogoAlta.getByRole('button', { name: 'Crear rol' }).click();
    await expect(dialogoAlta).toBeHidden({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: datos.rol })).toBeVisible();

    // El título y la fila de botones son hermanos bajo el mismo contenedor de
    // la tarjeta: subir dos niveles desde el título llega a ese contenedor.
    const fila = page.getByRole('heading', { name: datos.rol }).locator('..').locator('..');
    await fila.getByRole('button', { name: 'Eliminar' }).click();

    const dialogoConfirmar = page.getByRole('dialog');
    await expect(dialogoConfirmar).toBeVisible();
    await expect(dialogoConfirmar).toContainText(datos.rol);

    // Cancelar no borra nada: el rol sigue en la lista.
    await dialogoConfirmar.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogoConfirmar).toBeHidden();
    await expect(page.getByRole('heading', { name: datos.rol })).toBeVisible();

    // Confirmar sí lo elimina.
    await fila.getByRole('button', { name: 'Eliminar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: datos.rol })).not.toBeVisible();

    sinErrores(ojo, 'eliminación de rol con confirmación');
  });
});
