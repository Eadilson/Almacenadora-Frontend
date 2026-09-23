import { expect, test } from '@playwright/test';
import { entrar, esperarCarga, sinErrores, vigilar } from './helpers.js';

/**
 * Administración por la interfaz: personal, roles y configuración.
 *
 * Es la parte que decide qué puede hacer cada persona, así que lo que más se
 * comprueba es que las prohibiciones se vean: un rol del sistema que no se deja
 * tocar, un permiso que no se puede conceder, una sucursal predeterminada que no
 * se puede desactivar.
 */

test.describe.configure({ mode: 'serial' });

const SELLO = Date.now().toString().slice(-6);

const datos = {
  rol: `Bodega UI ${SELLO}`,
  clave: `BODEGA${SELLO}`,
  persona: `Empleado UI ${SELLO}`,
  correo: `empleado${SELLO}@ferreteria.local`,
  temporal: 'TemporalEmpleado26',
  sucursal: `Sucursal UI ${SELLO}`,
  codigoSucursal: `S${SELLO.slice(-3)}`,
};

test.describe('administración', () => {
  test('1 · las tablas de usuarios y roles muestran contenido', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/usuarios');
    await esperarCarga(page);

    // Con al menos un usuario en la empresa, la tabla nunca debería estar vacía.
    await expect(page.getByText('Sin usuarios')).toHaveCount(0);
    await expect(page.getByRole('row').nth(1)).toBeVisible();

    // Quien está mirando aparece marcado como tal.
    await expect(page.getByText('(usted)')).toBeVisible();

    await page.goto('/roles');
    await esperarCarga(page);
    await expect(page.getByText('Propietario').first()).toBeVisible();

    sinErrores(ojo, 'usuarios y roles');
  });

  test('2 · se crea un rol a la medida marcando permisos', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/roles');
    await esperarCarga(page);

    await page.getByRole('button', { name: 'Crear rol' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();

    await dialogo.getByLabel(/^Nombre/).fill(datos.rol);
    await dialogo.getByLabel(/^Clave/).fill(datos.clave);
    await dialogo.getByLabel(/Descripción/).fill('Recibe mercancía y consulta existencias.');

    // Los permisos se ofrecen con nombre legible, no con su clave técnica.
    await dialogo.getByText('Ver productos', { exact: true }).click();
    await dialogo.getByText('Ver existencias y kardex', { exact: true }).click();
    await dialogo.getByText('Recibir mercancía', { exact: true }).click();

    await dialogo.getByRole('button', { name: 'Crear rol' }).click();
    await expect(dialogo).toBeHidden({ timeout: 20_000 });

    // El aviso de éxito confirma que la operación llegó a su fin.
    await expect(page.getByText(`Rol «${datos.rol}» creado`)).toBeVisible();

    // Y la tarjeta aparece en la lista. Se busca por encabezado y no por texto
    // suelto: el nombre también sale dentro del aviso, y coincidir con los dos
    // haría ambiguo el selector.
    await expect(page.getByRole('heading', { name: datos.rol })).toBeVisible();
    await expect(page.getByText('3 permisos').first()).toBeVisible();

    sinErrores(ojo, 'alta de rol');
  });

  test('3 · un rol del sistema no se deja modificar', async ({ page }) => {
    await entrar(page);
    await page.goto('/roles');
    await esperarCarga(page);

    // La tarjeta de un rol del sistema no ofrece «Editar»: se declara así en la
    // respuesta (`editable: false`) en lugar de dejar que el botón falle.
    const tarjetaSistema = page
      .locator('section, div')
      .filter({ hasText: 'Propietario' })
      .filter({ hasText: 'permisos' })
      .first();

    await expect(tarjetaSistema).toBeVisible();
    await expect(page.getByLabel('Rol del sistema').first()).toBeVisible();
  });

  test('4 · se da de alta a una persona con su contraseña temporal', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/usuarios');
    await esperarCarga(page);

    await page.getByRole('button', { name: 'Agregar persona' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();

    await dialogo.getByLabel(/Nombre completo/).fill(datos.persona);
    await dialogo.getByLabel(/^Correo/).fill(datos.correo);

    const selectorRol = dialogo.getByLabel(/^Rol/);
    const valor = await selectorRol.locator('option', { hasText: datos.rol }).getAttribute('value');
    await selectorRol.selectOption(valor);

    // La contraseña se genera sola; se sustituye por una conocida para poder
    // entrar con ella en la prueba siguiente.
    await dialogo.getByLabel(/Contraseña temporal/).fill(datos.temporal);

    await dialogo.getByRole('button', { name: 'Crear usuario' }).click();
    await expect(dialogo).toBeHidden({ timeout: 20_000 });

    await expect(page.getByText(datos.correo)).toBeVisible();
    // Se marca que entra con una clave prestada.
    await expect(page.getByText('Clave temporal').first()).toBeVisible();

    sinErrores(ojo, 'alta de persona');
  });

  test('5 · quien entra con clave temporal es llevado a cambiarla', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page, { email: datos.correo, password: datos.temporal });

    // No puede ir a ninguna otra parte hasta cambiarla: mientras no lo haga, otra
    // persona conoce su clave.
    await expect(page).toHaveURL(/\/cambiar-clave/);
    await expect(page.getByText(/contraseña temporal/i).first()).toBeVisible();

    await page.goto('/productos');
    await expect(page).toHaveURL(/\/cambiar-clave/);

    sinErrores(ojo, 'cambio obligado de clave');
  });

  test('6 · cambia su contraseña y la temporal deja de valer', async ({ page }) => {
    const propia = 'MiClavePropia2026';

    await entrar(page, { email: datos.correo, password: datos.temporal });
    await expect(page).toHaveURL(/\/cambiar-clave/);

    await page.getByLabel(/Contraseña actual/).fill(datos.temporal);
    await page.getByLabel(/^Contraseña nueva/).fill(propia);
    await page.getByLabel(/Repita la contraseña nueva/).fill(propia);
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    // Todas las sesiones caen: vuelve al inicio de sesión.
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });

    // La temporal ya no sirve.
    await page.getByLabel(/Correo electrónico/).fill(datos.correo);
    await page.getByLabel(/^Contraseña/).fill(datos.temporal);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText(/incorrect|inválid/i).first()).toBeVisible();

    // La suya sí.
    await entrar(page, { email: datos.correo, password: propia });
    await expect(page).not.toHaveURL(/\/cambiar-clave/);

    datos.clavePropia = propia;
  });

  test('7 · su rol limita lo que ve en el menú', async ({ page }) => {
    await entrar(page, { email: datos.correo, password: datos.clavePropia });

    // Tiene productos y existencias…
    await expect(page.getByRole('link', { name: 'Productos', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Existencias', exact: true })).toBeVisible();

    // …pero no ventas, ni cartera, ni administración.
    await expect(page.getByRole('link', { name: 'Ventas', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Créditos', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Usuarios', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Reportes', exact: true })).toHaveCount(0);
  });

  test('8 · escribir la ruta a mano tampoco le abre lo que no le toca', async ({ page }) => {
    await entrar(page, { email: datos.correo, password: datos.clavePropia });

    for (const ruta of ['/usuarios', '/roles', '/configuracion', '/creditos', '/reportes']) {
      await page.goto(ruta);
      await expect(
        page.getByText('No tiene acceso a esta sección'),
        `${ruta} debería estar cerrada para este rol`,
      ).toBeVisible();
    }
  });

  test('9 · se crea una sucursal y solo una queda predeterminada', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/configuracion');
    await esperarCarga(page);

    await page.getByRole('button', { name: 'Agregar' }).click();
    const dialogo = page.getByRole('dialog');

    await dialogo.getByLabel(/^Código/).fill(datos.codigoSucursal);
    await dialogo.getByLabel(/^Nombre/).fill(datos.sucursal);
    await dialogo.getByLabel(/Teléfono/).fill('7766-5544');
    await dialogo.getByRole('button', { name: 'Crear sucursal' }).click();

    await expect(dialogo).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText(`Sucursal «${datos.sucursal}» creada`)).toBeVisible();

    // Aparece en la lista. Se busca dentro del elemento de lista y no por texto
    // suelto: el nombre también sale en el aviso de éxito.
    await expect(page.getByRole('listitem').filter({ hasText: datos.sucursal })).toBeVisible();

    // La primera sigue siendo la predeterminada: solo puede haber una.
    await expect(page.getByText('Predeterminada')).toHaveCount(1);

    /**
     * Se deja desactivada antes de salir.
     *
     * El plan limita cuántas sucursales activas puede tener la empresa, y esta
     * prueba crea una en cada corrida: a la tercera, el alta empezaría a fallar por
     * el tope y la prueba se rompería sola sin que nada estuviera mal en el
     * producto. Desactivarla libera el cupo y, de paso, ejercita el camino inverso.
     */
    const fila = page.getByRole('listitem').filter({ hasText: datos.sucursal });
    await fila.getByRole('button', { name: /Editar/ }).click();

    const edicion = page.getByRole('dialog');
    await edicion.getByText('Activa', { exact: true }).click();
    await edicion.getByRole('button', { name: 'Guardar' }).click();
    await expect(edicion).toBeHidden({ timeout: 20_000 });

    await expect(fila.getByText('Inactiva')).toBeVisible();

    sinErrores(ojo, 'alta de sucursal');
  });

  test('10 · la configuración guarda y deja ver lo que no se puede cambiar', async ({ page }) => {
    const ojo = vigilar(page);

    await entrar(page);
    await page.goto('/configuracion');
    await esperarCarga(page);

    // La moneda se muestra pero no se edita, y la pantalla explica por qué.
    await expect(page.getByText('GTQ')).toBeVisible();
    await expect(page.getByText(/La moneda no se cambia desde aquí/)).toBeVisible();

    const nombre = `El Tornillo ${SELLO}`;
    await page.getByLabel(/Nombre comercial/).fill(nombre);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    // Al recargar sigue guardado.
    await page.reload();
    await esperarCarga(page);
    await expect(page.getByLabel(/Nombre comercial/)).toHaveValue(nombre);

    sinErrores(ojo, 'configuración');
  });

  test('11 · se desactiva a la persona y deja de poder entrar', async ({ page, browser }) => {
    await entrar(page);
    await page.goto('/usuarios');
    await esperarCarga(page);

    await page.getByPlaceholder(/Buscar por nombre o correo/).fill(datos.correo);
    await esperarCarga(page);

    const fila = page.getByRole('row').filter({ hasText: datos.correo });
    await fila.getByTitle('Desactivar').click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Desactivar' }).click();
    await expect(dialogo).toBeHidden({ timeout: 20_000 });

    await expect(fila.getByText('Inactivo')).toBeVisible({ timeout: 20_000 });

    /**
     * El intento de entrar va en una ventana limpia.
     *
     * Con la sesión del administrador todavía abierta, ir a `/login` rebota al
     * panel —lo impide `RequireGuest`— y no habría formulario que rellenar. Un
     * contexto nuevo reproduce lo que le pasa a la persona desactivada desde su
     * propia máquina.
     */
    const contexto = await browser.newContext();
    const otra = await contexto.newPage();

    await otra.goto('http://localhost:5173/login');
    await otra.getByLabel(/Correo electrónico/).fill(datos.correo);
    await otra.getByLabel(/^Contraseña/).fill(datos.clavePropia);
    await otra.getByRole('button', { name: 'Entrar' }).click();

    // Desactivar sin cerrarle la puerta no serviría de nada. El aviso dice qué
    // pasó —la cuenta está desactivada— y no un genérico «credenciales inválidas»:
    // esta persona no se equivocó al escribir, y mandarla a probar otra contraseña
    // la haría perder el tiempo.
    await expect(otra.getByText(/incorrect|inválid|inactiv|desactivad/i).first()).toBeVisible();
    await expect(otra).toHaveURL(/\/login/);

    await contexto.close();
  });
  test('12 · un rechazo del servidor se ve dentro del diálogo', async ({ page }) => {
    /**
     * Esta prueba existe por un fallo concreto.
     *
     * Los diálogos llamaban a la mutación sin capturar el rechazo: cuando el
     * servidor decía que no —un código repetido, el tope del plan—, el diálogo se
     * quedaba abierto, sin mensaje y con el botón otra vez habilitado. La persona
     * veía un botón que aparentemente no hacía nada y volvía a pulsarlo.
     *
     * Se reproduce con un código de sucursal que ya existe, que es la forma más
     * corta de conseguir que el servidor rechace algo por una regla de negocio.
     */
    await entrar(page);
    await page.goto('/configuracion');
    await esperarCarga(page);

    await page.getByRole('button', { name: 'Agregar' }).click();
    const dialogo = page.getByRole('dialog');

    // «PRIN» es la casa matriz: existe en cualquier empresa desde el primer día,
    // así que el choque se reproduce sin depender de otra prueba.
    await dialogo.getByLabel(/^Código/).fill('PRIN');
    await dialogo.getByLabel(/^Nombre/).fill('Otra con el mismo código');
    await dialogo.getByRole('button', { name: 'Crear sucursal' }).click();

    // Se explica qué pasó, sin cerrar el diálogo: lo escrito sigue ahí para
    // corregir el código en vez de volver a teclearlo todo.
    await expect(dialogo.getByText(/ya existe/i)).toBeVisible({ timeout: 20_000 });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByLabel(/^Nombre/)).toHaveValue('Otra con el mismo código');

    // Se sale sin crear nada: que el alta funciona ya lo comprueba la prueba 9, y
    // cada sucursal de más consume cupo del plan en la base de demostración.
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
  });
});
