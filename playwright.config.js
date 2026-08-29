import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de interfaz sobre la aplicación real.
 *
 * Se usa el Chrome instalado en el sistema (`channel: 'chrome'`) en lugar de
 * descargar los navegadores de Playwright: son cientos de megabytes y aquí ya hay
 * un Chrome que sirve.
 *
 * No se levantan los servidores desde aquí (`webServer`): el backend y el frontend
 * ya están corriendo para el desarrollo diario, y arrancarlos otra vez chocaría
 * por el puerto. Si no lo estuvieran, la primera prueba fallaría con un mensaje
 * claro de conexión rechazada, que es más fácil de diagnosticar que un arranque a
 * medias.
 */
export default defineConfig({
  testDir: './tests/ui',
  // Una sola persona a la vez: estas pruebas escriben datos reales en la
  // demostración, y en paralelo se pisarían el inventario entre ellas.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:5173',
    // El seguimiento y las capturas solo al fallar: en verde no aportan y ocupan.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    locale: 'es-GT',
    timezoneId: 'America/Guatemala',
  },

  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
