import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Recorrido por todas las pantallas.
 *
 * Lo que se comprueba no es solo que carguen: se vigila la consola del navegador
 * y las respuestas del servidor. Una pantalla puede pintarse entera y aun así
 * haber reventado una petición o lanzado un error de React que deja un hueco.
 * Sin esa vigilancia, la prueba pasaría en verde sobre una interfaz rota.
 */

test.describe('recorrido general', () => {
  test('inicia sesión y llega al panel', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);

    await expect(page.getByRole('heading', { name: /Buen día/ })).toBeVisible();
    sinErrores(ojo, 'panel');
  });

  test('el panel muestra indicadores reales, no maquetas', async ({ page }) => {
    await entrar(page);
    await esperarCarga(page);

    // Las tarjetas del período: si el panel funciona, traen importes en quetzales.
    await expect(page.getByText('Vendido').first()).toBeVisible();
    await expect(page.getByText('Ventas', { exact: true }).first()).toBeVisible();

    const cuerpo = await page.locator('body').innerText();
    expect(cuerpo, 'el panel debería mostrar importes en quetzales').toMatch(/Q\s?[\d,]+\.\d{2}/);
  });

  test.describe('cada sección carga sin errores', () => {
    const secciones = [
      { ruta: '/productos', titulo: 'Productos' },
      { ruta: '/categorias', titulo: 'Categorías' },
      { ruta: '/existencias', titulo: /Existencias/ },
      { ruta: '/movimientos', titulo: /Movimientos/ },
      { ruta: '/compras', titulo: /Compras/ },
      { ruta: '/proveedores', titulo: /Proveedores/ },
      { ruta: '/ventas', titulo: 'Ventas' },
      { ruta: '/ventas/nueva', titulo: /venta|Punto/i },
      { ruta: '/clientes', titulo: /Clientes/ },
      { ruta: '/creditos', titulo: /Cartera/ },
      { ruta: '/abonos', titulo: /Abonos/ },
      { ruta: '/reportes', titulo: /Reportes/ },
      { ruta: '/usuarios', titulo: /Usuarios/ },
      { ruta: '/roles', titulo: /Roles/ },
      { ruta: '/configuracion', titulo: /Configuración/ },
    ];

    for (const seccion of secciones) {
      test(`${seccion.ruta}`, async ({ page }) => {
        const ojo = vigilar(page);

        await entrar(page);
        await page.goto(seccion.ruta);
        await esperarCarga(page);

        await expect(page.getByRole('heading', { name: seccion.titulo }).first()).toBeVisible();

        // Ninguna pantalla debe acabar en el estado de error genérico.
        await expect(page.getByText('No se pudo cargar')).toHaveCount(0);

        sinErrores(ojo, seccion.ruta);
      });
    }
  });

  test('la barra lateral lleva a donde dice', async ({ page }) => {
    await entrar(page);

    const enlaces = [
      ['Productos', '/productos'],
      ['Existencias', '/existencias'],
      ['Ventas', '/ventas'],
      ['Créditos', '/creditos'],
      ['Reportes', '/reportes'],
    ];

    for (const [etiqueta, ruta] of enlaces) {
      await page.getByRole('link', { name: etiqueta, exact: true }).first().click();
      await expect(page).toHaveURL(new RegExp(ruta.replace('/', '\\/')));
      await esperarCarga(page);
    }
  });

  test('una ruta inexistente muestra la pantalla de no encontrado, no un error', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/esta-ruta-no-existe');

    await expect(page.getByText(/no encontrad|no existe/i).first()).toBeVisible();
    sinErrores(ojo, 'ruta inexistente');
  });

  test('sin sesión, cualquier ruta lleva al inicio de sesión', async ({ page }) => {
    await page.goto('/reportes');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/Correo electrónico/)).toBeVisible();
  });

  test('credenciales incorrectas muestran el error sin dejar entrar', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/Correo electrónico/).fill('admin@ferreteria.local');
    await page.getByLabel(/^Contraseña/).fill('estaNoEsLaClave');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText(/incorrect|inválid/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
