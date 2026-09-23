import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Perfil de la sesión, hecho a mano por la interfaz.
 *
 * Cubre lo que antes era un elemento de menú deshabilitado con la etiqueta
 * «pronto»: que de verdad se pueda entrar, cambiar el propio nombre, verlo
 * persistir, y que el correo —la credencial de entrada— no se pueda tocar desde
 * aquí.
 */

test.describe.configure({ mode: 'serial' });

const SELLO = Date.now().toString().slice(-6);
const nombreNuevo = `Edwin Adilson UI ${SELLO}`;

test.describe('perfil', () => {
  test('1 · se entra desde el menú de la cuenta', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.getByRole('button', { name: /Edwin Adilson/ }).click();
    await page.getByRole('menuitem', { name: 'Mi perfil' }).click();

    await expect(page).toHaveURL(/\/perfil/);
    await esperarCarga(page);

    // El correo se ve pero no se puede editar: es la credencial de entrada.
    const correo = page.getByLabel(/^Correo/);
    await expect(correo).toBeDisabled();

    sinErrores(ojo, 'entrada al perfil');
  });

  test('2 · se cambia el nombre y persiste tras recargar', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/perfil');
    await esperarCarga(page);

    const campoNombre = page.getByLabel(/^Nombre/);
    await campoNombre.fill(nombreNuevo);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(page.getByText('Perfil actualizado')).toBeVisible();
    // El encabezado con el nombre se actualiza sin recargar.
    await expect(page.getByRole('heading', { name: nombreNuevo })).toBeVisible();

    await page.reload();
    await esperarCarga(page);
    await expect(page.getByLabel(/^Nombre/)).toHaveValue(nombreNuevo);

    // Y el menú de la cuenta, en cualquier otra pantalla, también lo refleja.
    await page.goto('/');
    await esperarCarga(page);
    await expect(page.getByRole('button', { name: new RegExp(nombreNuevo) })).toBeVisible();

    sinErrores(ojo, 'cambio de nombre');
  });

  test('3 · el botón de guardar no se activa sin un cambio real', async ({ page }) => {
    await entrar(page);
    await page.goto('/perfil');
    await esperarCarga(page);

    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  });

  test('4 · desde aquí se llega al cambio de contraseña', async ({ page }) => {
    await entrar(page);
    await page.goto('/perfil');
    await esperarCarga(page);

    await page.getByRole('link', { name: 'Cambiar' }).click();
    await expect(page).toHaveURL(/\/cambiar-clave/);
  });

  test('5 · se deja el nombre como estaba', async ({ page }) => {
    // La cuenta del propietario de la demo no debe quedar con un nombre de
    // prueba: las siguientes sesiones vuelven a verla como «Edwin Adilson».
    await entrar(page);
    await page.goto('/perfil');
    await esperarCarga(page);

    await page.getByLabel(/^Nombre/).fill('Edwin Adilson');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Perfil actualizado')).toBeVisible();
  });
});
