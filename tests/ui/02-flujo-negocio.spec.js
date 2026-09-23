import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * El flujo completo de un comercio, hecho a mano por la interfaz.
 *
 * No se llama a la API: se rellenan los formularios y se pulsan los botones, que
 * es donde aparecen los fallos que las pruebas de servidor no ven —un diálogo que
 * no se cierra, un aviso que no sale, un total que se calcula distinto en
 * pantalla—.
 *
 * Las pruebas van en orden y comparten lo que van creando: es un recorrido, no
 * casos sueltos. Por eso el archivo se ejecuta en serie.
 *
 * Sobre los selectores: los campos obligatorios llevan « (obligatorio)» en su
 * nombre accesible porque el asterisco visual está oculto a los lectores de
 * pantalla y sustituido por texto. Por eso se buscan con expresión regular.
 */

test.describe.configure({ mode: 'serial' });

/** Marca única, para no chocar con lo que ya existe en la demostración. */
const SELLO = Date.now().toString().slice(-6);

const datos = {
  proveedor: `Distribuidora UI ${SELLO}`,
  producto: `Cable UI ${SELLO}`,
  sku: `UI-${SELLO}`,
  cliente: `Constructora UI ${SELLO}`,
  costo: '45.00',
  precio: '90.00',
  compradas: '40',
  vendidas: 3,
};

test.describe('flujo de un comercio, de principio a fin', () => {
  test('1 · se da de alta un proveedor', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/proveedores');
    await esperarCarga(page);

    await page.getByRole('button', { name: 'Nuevo proveedor' }).first().click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();

    await dialogo.getByLabel(/^Nombre/).fill(datos.proveedor);
    await dialogo.getByLabel(/Identificación fiscal/).fill('08019' + SELLO);
    await dialogo.getByLabel(/Persona de contacto/).fill('Marta Fúnez');
    await dialogo.getByLabel(/Teléfono/).fill('2233-4455');
    await dialogo.getByRole('button', { name: 'Crear proveedor' }).click();

    // El diálogo se cierra solo: es la señal de que la operación salió bien.
    await expect(dialogo).toBeHidden();
    await expect(page.getByText(datos.proveedor).first()).toBeVisible();

    sinErrores(ojo, 'alta de proveedor');
  });

  test('2 · se crea un producto con los atributos de su categoría', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/productos/nuevo');
    await esperarCarga(page);

    const sku = page.getByLabel(/Código \(SKU\)/);
    await sku.waitFor({ state: 'visible', timeout: 20_000 });

    // El campo lo asigna el servidor: está bloqueado, no se escribe.
    await page.getByLabel(/^Nombre/).fill(datos.producto);

    // La categoría decide qué campos propios del negocio pide el formulario: es
    // el mecanismo que hace al producto multi-rubro, así que se ejercita de veras.
    await page.getByLabel(/^Categoría/).selectOption({ label: 'Cables eléctricos' });
    await page.getByLabel(/Unidad de medida/).selectOption({ label: 'Unidad (UN)' });

    // Atributo obligatorio definido por la empresa para esta categoría.
    await page.getByLabel(/^Calibre/).selectOption({ label: '12 AWG' });
    await page.getByLabel(/^Aislamiento/).selectOption({ label: 'THHN' });

    await page.getByLabel(/^Costo/).fill(datos.costo);
    await page.getByLabel(/Precio de venta/).fill(datos.precio);
    await page.getByLabel(/Stock mínimo/).fill('5');

    await page.getByRole('button', { name: 'Crear producto' }).click();

    // Al crear se va a la ficha del producto recién guardado, no al listado: así
    // se puede seguir completándolo sin volver a buscarlo.
    await expect(page).toHaveURL(/\/productos\/[a-f0-9]{24}/, { timeout: 20_000 });
    await esperarCarga(page);

    // El servidor generó el código: se toma el real y se reutiliza en el resto
    // de la prueba en vez del que se hubiera escrito a mano.
    datos.sku = await page.getByLabel(/Código \(SKU\)/).inputValue();
    expect(datos.sku).toMatch(/^PROD-\d{6}$/);

    // Y aparece en el catálogo.
    await page.goto('/productos');
    await esperarCarga(page);
    await page.getByPlaceholder(/Buscar/).first().fill(datos.sku);
    await esperarCarga(page);
    await expect(page.getByText(datos.sku).first()).toBeVisible();

    sinErrores(ojo, 'alta de producto');
  });

  test('3 · el formulario exige los atributos obligatorios de la categoría', async ({ page }) => {
    await entrar(page);
    await page.goto('/productos/nuevo');
    await esperarCarga(page);

    const sku = page.getByLabel(/Código \(SKU\)/);
    await sku.waitFor({ state: 'visible', timeout: 20_000 });

    await page.getByLabel(/^Nombre/).fill('Producto sin calibre');
    await page.getByLabel(/^Categoría/).selectOption({ label: 'Cables eléctricos' });
    await page.getByLabel(/Unidad de medida/).selectOption({ label: 'Unidad (UN)' });
    await page.getByLabel(/^Costo/).fill('10.00');
    await page.getByLabel(/Precio de venta/).fill('20.00');

    // Falta «Calibre», que la empresa marcó obligatorio para esta categoría.
    await page.getByRole('button', { name: 'Crear producto' }).click();

    await expect(page.getByText(/Seleccione «Calibre»/)).toBeVisible();
    await expect(page).toHaveURL(/\/productos\/nuevo/);
  });

  test('4 · se registra una compra y se recibe la mercancía', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/compras/nueva');
    await esperarCarga(page);

    /**
     * La opción del proveedor muestra también su plazo —«Distribuidora X ·
     * contado»—, así que no coincide con el nombre a secas. `selectOption`
     * tampoco admite expresión regular: se busca el valor de la opción cuyo
     * texto contiene el nombre y se selecciona por valor.
     */
    const selectorProveedor = page.getByLabel(/^Proveedor/);
    const valorProveedor = await selectorProveedor
      .locator('option', { hasText: datos.proveedor })
      .getAttribute('value');

    await selectorProveedor.selectOption(valorProveedor);

    const buscador = page.getByLabel('Buscar productos');
    await buscador.fill(datos.sku);
    await esperarCarga(page);
    await page.getByText(datos.producto).first().click();

    await page.getByLabel(`Cantidad de ${datos.producto}`).fill(datos.compradas);
    await page.getByLabel(`Costo de ${datos.producto}`).fill(datos.costo);

    await page.getByRole('button', { name: /Crear y confirmar/ }).click();

    await expect(page).toHaveURL(/\/compras\/[a-f0-9]{24}/, { timeout: 20_000 });
    await esperarCarga(page);

    // Recepción
    await page.getByRole('button', { name: /^Recibir/ }).first().click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Registrar recepción' }).click();

    await expect(dialogo).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText(/Recibida/i).first()).toBeVisible({ timeout: 20_000 });

    sinErrores(ojo, 'compra y recepción');
  });

  test('5 · la mercancía recibida aparece en existencias', async ({ page }) => {
    await entrar(page);
    await page.goto('/existencias');
    await esperarCarga(page);

    await page.getByPlaceholder(/Buscar/).first().fill(datos.sku);
    await esperarCarga(page);

    const fila = page.getByRole('row').filter({ hasText: datos.sku });
    await expect(fila.first()).toBeVisible();
    await expect(fila.first()).toContainText(datos.compradas);
  });

  test('6 · se registra un cliente con crédito', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/clientes');
    await esperarCarga(page);

    await page.getByRole('button', { name: 'Nuevo cliente' }).first().click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();

    await dialogo.getByLabel(/^Nombre/).fill(datos.cliente);
    await dialogo.getByLabel(/Teléfono/).fill('5544-3322');

    // Sin interruptor aparte: un límite mayor que cero ya es un cliente con
    // crédito.
    await dialogo.getByLabel(/Límite de crédito/).fill('20000.00');
    await dialogo.getByLabel(/^Plazo/).fill('30');

    await dialogo.getByRole('button', { name: 'Crear cliente' }).click();

    await expect(dialogo).toBeHidden();
    await expect(page.getByText(datos.cliente).first()).toBeVisible();

    sinErrores(ojo, 'alta de cliente');
  });

  test('7 · se vende de contado en el punto de venta', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/ventas/nueva');
    await esperarCarga(page);

    const buscador = page.getByLabel('Buscar productos para vender');
    await buscador.fill(datos.sku);

    /**
     * Se espera al resultado antes de pulsar Enter.
     *
     * La búsqueda va con retardo para no consultar en cada tecla, así que un
     * Enter inmediato llega cuando la lista aún está vacía y no agrega nada. Una
     * persona tampoco pulsa antes de ver el resultado.
     */
    const resultado = page.getByRole('button', { name: new RegExp(datos.sku) });
    await resultado.first().waitFor({ state: 'visible', timeout: 20_000 });

    // Enter agrega el primer resultado: es el flujo del lector de código de barras.
    await buscador.press('Enter');

    // Ya en el carrito: aparece el control para quitarlo.
    await expect(page.getByRole('button', { name: `Quitar ${datos.producto}` })).toBeVisible({
      timeout: 10_000,
    });

    // Sumar hasta tres unidades
    for (let i = 1; i < datos.vendidas; i += 1) {
      await page.getByRole('button', { name: 'Agregar una unidad' }).first().click();
    }

    await page.getByRole('button', { name: 'Cobrar' }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Confirmar venta' }).click();

    // El recibo trae el número de la venta.
    await expect(dialogo.getByText(/V\d+-\d{6}/).first()).toBeVisible({ timeout: 20_000 });

    sinErrores(ojo, 'venta de contado');
  });

  test('8 · la venta descontó el inventario', async ({ page }) => {
    await entrar(page);
    await page.goto('/existencias');
    await esperarCarga(page);

    await page.getByPlaceholder(/Buscar/).first().fill(datos.sku);
    await esperarCarga(page);

    const restante = String(Number(datos.compradas) - datos.vendidas);
    const fila = page.getByRole('row').filter({ hasText: datos.sku });
    await expect(fila.first()).toContainText(restante);
  });

  test('9 · la venta aparece en el listado con su importe', async ({ page }) => {
    await entrar(page);
    await page.goto('/ventas');
    await esperarCarga(page);

    const primera = page.getByRole('row').nth(1);
    await expect(primera).toContainText(/V\d+-\d{6}/);
    await expect(primera).toContainText(/Q\s?[\d,]+\.\d{2}/);
  });

  test('10 · el kardex explica el movimiento de ese producto', async ({ page }) => {
    await entrar(page);
    await page.goto('/movimientos');
    await esperarCarga(page);

    await expect(page.getByText(/Compra|PURCHASE|Entrada/i).first()).toBeVisible();
    await expect(page.getByText(/Venta|SALE/i).first()).toBeVisible();
  });

  test('11 · el panel refleja lo que se acaba de vender', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);

    // Se espera a que el panel esté pintado antes de leerlo: `esperarCarga` solo
    // vigila el indicador de carga, y leer el texto justo después puede pillar la
    // página todavía en blanco.
    await expect(page.getByRole('heading', { name: /Buen día/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Lo que más se vende')).toBeVisible({ timeout: 20_000 });

    const cuerpo = await page.locator('body').innerText();
    expect(cuerpo).toMatch(/Q\s?[\d,]+\.\d{2}/);

    sinErrores(ojo, 'panel tras la venta');
  });

  test('12 · los reportes abren todas sus pestañas sin romperse', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/reportes');
    await esperarCarga(page);

    for (const pestana of ['Ventas', 'Utilidad', 'Inventario', 'Rotación', 'Clientes', 'Compras']) {
      await page.getByRole('button', { name: pestana, exact: true }).click();
      await esperarCarga(page);
      // El texto real del error es «No se pudieron cargar los datos» (states.jsx):
      // buscar «No se pudo cargar» no hacía match con nada y dejaba pasar la
      // pestaña de Inventario rota sin que la prueba se diera cuenta.
      await expect(page.getByText('No se pudieron cargar los datos')).toHaveCount(0);
    }

    sinErrores(ojo, 'reportes');
  });

  test('13 · la tabla de datos de un gráfico está disponible', async ({ page }) => {
    await entrar(page);
    await page.goto('/reportes');
    await esperarCarga(page);

    // «Ver datos» es la alternativa accesible al gráfico.
    await page.getByRole('button', { name: 'Ver datos' }).first().click();

    await expect(page.getByRole('button', { name: 'Ver gráfico' }).first()).toBeVisible();
    await expect(page.getByRole('table').first()).toBeVisible();
  });
});
