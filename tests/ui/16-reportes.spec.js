import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Reportes, por la interfaz.
 *
 * Nunca habían tenido una prueba funcional: solo se comprobaba que la ruta
 * cargara y mostrara el título (01-navegacion.spec.js). Esta entra datos reales
 * —una compra, una venta de contado, una venta a crédito— y verifica que cada
 * pestaña los refleje, que cambiar de pestaña no rompa nada (ya hubo un bug real
 * aquí: mandar fechas al reporte de Inventario, que no las acepta, tumbaba la
 * pantalla — ver el comentario en ReportsPage.jsx), que el rango de fechas a mano
 * funcione, y que exportar a Excel de verdad descargue un archivo.
 *
 * Los totales de cada pestaña sí no se comprueban: son una suma sobre **todo**
 * el inquilino en el período, y este entorno acumula cientos de ventas de otras
 * pruebas — un total exacto sería un número distinto en cada corrida. Lo que sí
 * es estable es la fila de este producto en «Margen por producto» (cantidad y
 * margen no dependen de qué más se vendió), filtrando el período a hoy.
 */

test.describe.configure({ mode: 'serial' });

const SELLO = Date.now().toString().slice(-6);

const datos = {
  producto: `Producto reportes ${SELLO}`,
  sku: '',
  proveedor: `Proveedor reportes ${SELLO}`,
  cliente: `Cliente reportes ${SELLO}`,
  costo: '300.00',
  precio: '900.00',
  cantidadCompra: '20',
  unidadesContado: 8,
  unidadesCredito: 5,
  // (900 − 300) / 900 = 66.66…%, a un decimal.
  margenEsperado: '66.7%',
  unidadesVendidasTotal: '13',
};

test.describe('reportes con datos reales', () => {
  test('1 · se preparan producto, proveedor, compra y ventas', async ({ page }) => {
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
    await esperarCarga(page);
    datos.sku = await sku.inputValue();

    await page.goto('/compras/nueva');
    await esperarCarga(page);
    const selectorProveedor = page.getByLabel(/^Proveedor/);
    const valorProveedor = await selectorProveedor
      .locator('option', { hasText: datos.proveedor })
      .getAttribute('value');
    await selectorProveedor.selectOption(valorProveedor);

    const buscadorCompra = page.getByLabel('Buscar productos');
    await buscadorCompra.fill(datos.sku);
    await page.getByRole('button', { name: new RegExp(datos.sku) }).first().click();
    await page.getByLabel(`Cantidad de ${datos.producto}`).fill(datos.cantidadCompra);
    await page.getByLabel(`Costo de ${datos.producto}`).fill(datos.costo);
    await page.getByRole('button', { name: /Crear y confirmar/ }).click();
    await expect(page).toHaveURL(/\/compras\/[a-f0-9]{24}/, { timeout: 20_000 });
    await page.getByRole('button', { name: /^Recibir/ }).first().click();
    const dialogoRecepcion = page.getByRole('dialog');
    await dialogoRecepcion.getByRole('button', { name: 'Registrar recepción' }).click();
    await expect(dialogoRecepcion).toBeHidden({ timeout: 20_000 });

    await page.goto('/clientes');
    await esperarCarga(page);
    await page.getByRole('button', { name: 'Nuevo cliente' }).first().click();
    const dialogoCliente = page.getByRole('dialog');
    await dialogoCliente.getByLabel(/^Nombre/).fill(datos.cliente);
    await dialogoCliente.getByLabel(/Límite de crédito/).fill('5000.00');
    await dialogoCliente.getByLabel(/^Plazo/).fill('30');
    await dialogoCliente.getByRole('button', { name: 'Crear cliente' }).click();
    await expect(dialogoCliente).toBeHidden();

    // Venta de contado.
    await page.goto('/ventas/nueva');
    await esperarCarga(page);
    const buscadorVenta = page.getByLabel('Buscar productos para vender');
    await buscadorVenta.fill(datos.sku);
    await page.getByRole('button', { name: new RegExp(datos.sku) }).first().waitFor({
      state: 'visible',
      timeout: 20_000,
    });
    await buscadorVenta.press('Enter');
    await expect(page.getByRole('button', { name: `Quitar ${datos.producto}` })).toBeVisible();
    for (let i = 1; i < datos.unidadesContado; i += 1) {
      await page.getByRole('button', { name: 'Agregar una unidad' }).first().click();
    }
    await page.getByRole('button', { name: 'Cobrar' }).click();
    const dialogoContado = page.getByRole('dialog');
    await expect(dialogoContado).toBeVisible();
    await dialogoContado.getByLabel(/Efectivo recibido/).fill(
      String(datos.unidadesContado * Number(datos.precio)),
    );
    await dialogoContado.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(dialogoContado.getByText(/V\d+-\d{6}/).first()).toBeVisible({ timeout: 20_000 });
    await dialogoContado.getByRole('button', { name: 'Nueva venta' }).click();

    // Venta a crédito, para que el cliente también aparezca con actividad.
    await esperarCarga(page);
    const buscadorVenta2 = page.getByLabel('Buscar productos para vender');
    await buscadorVenta2.fill(datos.sku);
    await page.getByRole('button', { name: new RegExp(datos.sku) }).first().waitFor({
      state: 'visible',
      timeout: 20_000,
    });
    await buscadorVenta2.press('Enter');
    await expect(page.getByRole('button', { name: `Quitar ${datos.producto}` })).toBeVisible();
    for (let i = 1; i < datos.unidadesCredito; i += 1) {
      await page.getByRole('button', { name: 'Agregar una unidad' }).first().click();
    }
    const selectorCliente = page.locator('#pos-cliente');
    const valorCliente = await selectorCliente
      .locator('option', { hasText: datos.cliente })
      .getAttribute('value');
    await selectorCliente.selectOption(valorCliente);
    await page.getByRole('button', { name: 'Cobrar' }).click();
    const dialogoCredito = page.getByRole('dialog');
    await expect(dialogoCredito).toBeVisible();
    await dialogoCredito.getByText('Dejar a crédito').click();
    await dialogoCredito.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(dialogoCredito.getByText(/V\d+-\d{6}/).first()).toBeVisible({ timeout: 20_000 });

    sinErrores(ojo, 'preparación de reportes');
  });

  test('2 · la pestaña de Ventas carga con cifras con forma correcta', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/reportes');
    await esperarCarga(page);

    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();

    // Las cuatro tarjetas de resumen: no se comprueba el valor —depende de todo
    // el inquilino— pero sí que tengan forma de dinero o de número, nunca
    // "Q undefined" ni "NaN" por un campo que llegó vacío.
    const vendido = page.getByText('Vendido').locator('..').getByText(/^Q\s?[\d.,]+\.\d{2}$/);
    await expect(vendido).toBeVisible();

    sinErrores(ojo, 'reportes: pestaña de ventas');
  });

  test('3 · el rango de hoy aísla la venta de este producto en Utilidad', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/reportes');
    await esperarCarga(page);

    // La fecha local, no la UTC: con Guatemala en UTC-6, toISOString() ya cae
    // en el día siguiente durante buena parte de la noche, y filtrar por ese
    // día dejaría fuera la venta que se acaba de registrar hoy.
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    await page.getByLabel('Desde').fill(hoy);
    await page.getByLabel('Hasta').fill(hoy);
    await esperarCarga(page);

    await page.getByRole('button', { name: 'Utilidad' }).click();
    await esperarCarga(page);

    const fila = page.getByRole('row', { name: new RegExp(datos.producto) });
    await expect(fila).toBeVisible({ timeout: 20_000 });
    await expect(fila).toContainText(datos.unidadesVendidasTotal);
    await expect(fila).toContainText(datos.margenEsperado);

    sinErrores(ojo, 'reportes: margen por producto');
  });

  test('4 · cambiar de pestaña no rompe nada, incluida la de Inventario', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/reportes');
    await esperarCarga(page);

    // Inventario no acepta fechas (es una foto de ahora): antes, mandarlas
    // igual tumbaba la pestaña con «Los datos enviados no son válidos». Se
    // visita después de haber estado en una pestaña con fechas, que es
    // justamente cuando ese error aparecía.
    for (const etiqueta of ['Utilidad', 'Inventario', 'Rotación', 'Clientes', 'Compras', 'Ventas']) {
      await page.getByRole('button', { name: etiqueta }).click();
      await esperarCarga(page);
      await expect(page.getByText(/no son válidos|Ocurrió un error/i)).toBeHidden();
    }

    sinErrores(ojo, 'reportes: recorrido de pestañas');
  });

  test('5 · exportar a Excel descarga un archivo', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/reportes');
    await esperarCarga(page);

    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar a Excel' }).click(),
    ]);

    expect(descarga.suggestedFilename()).toMatch(/\.xlsx$/);
    await expect(page.getByText('Archivo descargado')).toBeVisible({ timeout: 10_000 });

    sinErrores(ojo, 'reportes: exportación');
  });
});
