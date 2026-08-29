import { expect } from '@playwright/test';

export const CREDENCIALES = {
  email: 'admin@ferreteria.local',
  password: 'Inventra2026!',
};

/**
 * Entra al sistema por el formulario, como lo haría una persona.
 *
 * No se inyecta el token en `localStorage` a propósito: el objetivo es ejercitar
 * la pantalla real, incluido el envío del formulario y la redirección posterior.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ email?: string, password?: string }} [credenciales]
 */
export async function entrar(page, credenciales = {}) {
  const { email, password } = { ...CREDENCIALES, ...credenciales };

  await page.goto('/login');

  // Los campos obligatorios llevan « (obligatorio)» en su nombre accesible: el
  // asterisco visual está oculto a los lectores de pantalla y sustituido por
  // texto. Por eso se busca por expresión regular y no por igualdad exacta.
  await page.getByLabel(/Correo electrónico/).fill(email);
  await page.getByLabel(/^Contraseña/).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  // La confirmación es que dejamos la pantalla de inicio de sesión.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

/**
 * Vigila la consola del navegador y los fallos de red.
 *
 * Un error de React o una petición que revienta no siempre rompen la pantalla:
 * a veces solo dejan un hueco. Sin esta vigilancia, la prueba pasaría en verde
 * sobre una interfaz que en realidad falló.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {{ errores: string[], red: string[] }}
 */
export function vigilar(page) {
  const errores = [];
  const red = [];

  page.on('console', (mensaje) => {
    if (mensaje.type() !== 'error') return;
    const texto = mensaje.text();

    // Las peticiones fallidas ya se registran aparte; aquí interesan los errores
    // de la propia aplicación.
    if (texto.includes('Failed to load resource')) return;
    errores.push(texto);
  });

  page.on('pageerror', (error) => errores.push(`excepción sin capturar: ${error.message}`));

  page.on('response', (respuesta) => {
    if (respuesta.status() >= 500) {
      red.push(`${respuesta.status()} ${respuesta.request().method()} ${respuesta.url()}`);
    }
  });

  return { errores, red };
}

/**
 * Comprueba que una pantalla cargó sin errores.
 *
 * @param {{ errores: string[], red: string[] }} vigilancia
 * @param {string} pantalla
 */
export function sinErrores(vigilancia, pantalla) {
  expect(vigilancia.red, `${pantalla}: el servidor devolvió 5xx`).toEqual([]);
  expect(vigilancia.errores, `${pantalla}: errores en la consola`).toEqual([]);
}

/**
 * Navega por la barra lateral.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} etiqueta
 */
export async function irA(page, etiqueta) {
  await page.getByRole('link', { name: etiqueta, exact: true }).first().click();
}

/**
 * Espera a que desaparezcan los indicadores de carga.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function esperarCarga(page) {
  await page
    .getByText(/Cargando|Calculando|Restaurando/)
    .first()
    .waitFor({ state: 'hidden', timeout: 20_000 })
    .catch(() => undefined);
}
