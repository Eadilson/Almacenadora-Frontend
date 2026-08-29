# Inventra — Aplicación web

Interfaz del sistema de gestión comercial multiempresa. Consume la API del
proyecto `Inventario-backend`; no comparten código ni dependencias, solo el
contrato HTTP de [`docs/06-api-rest.md`](docs/06-api-rest.md).

**Estado: andamiaje completo.** Sesión funcionando de extremo a extremo (inicio de
sesión, renovación automática, cierre), navegación filtrada por permisos y panel
que consulta la API real. Los módulos de negocio son F1 —
ver [`docs/07-roadmap.md`](docs/07-roadmap.md).

## Requisitos

- **Node.js ≥ 20**
- La API corriendo en `http://localhost:4000` (proyecto `Inventario-backend`)

## Puesta en marcha

```bash
npm install
cp .env.example .env
npm run dev            # http://localhost:5173
```

Con la API levantada y una empresa creada (`npm run seed` en el backend), ya se
puede entrar con las credenciales que ese comando imprime.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Compilación para producción en `dist/` |
| `npm run preview` | Sirve `dist/` para comprobar el resultado real |
| `npm test` | Pruebas |
| `npm run lint` | ESLint |
| `npm run verify` | lint + pruebas + build. **Lo que debe pasar antes de un commit** |

### Por qué hay un proxy en desarrollo

`vite.config.js` redirige `/api` a `http://localhost:4000`. No es comodidad: el
token de refresco viaja en una cookie `httpOnly` y, si el navegador viera dos
orígenes distintos, la trataría como cookie de tercera parte y la descartaría.
Con el proxy, aplicación y API comparten origen y la sesión se renueva sola.

## Estructura

```
src/
├── api/            Cliente Axios, normalización de errores, claves de consulta
├── app/            Proveedores, rutas, guardias, contextos
├── components/
│   ├── ui/         Componentes base (patrón shadcn: código propio, no dependencia)
│   ├── data/       DataTable y componentes de listado
│   └── feedback/   Estados de carga, vacío y error; captura de fallos
├── features/       Un módulo de negocio por carpeta (auth, dashboard, …)
├── hooks/          useSession, usePermission, useFeature, useTheme, useToast
├── layouts/        AppLayout (con sesión) y AuthLayout (sin sesión)
├── lib/            cn, dinero, fechas, acceso controlado a localStorage
├── constants/      Navegación declarada con sus permisos
└── styles/         Variables de tema, claro y oscuro
```

Arquitectura *feature-first*: cada módulo es autocontenido y lo compartido se
promueve solo cuando lo usan dos features. Detalle en
[`docs/01-arquitectura.md §4`](docs/01-arquitectura.md#4-estructura-de-carpetas--frontend).

## Decisiones que conviene conocer antes de tocar el código

1. **El token de acceso vive en memoria** (`src/api/session.js`), nunca en `localStorage`. Un XSS puede leer todo el almacenamiento, pero no una variable de módulo ni una cookie `httpOnly`. ESLint prohíbe `localStorage.setItem` fuera de `src/lib/storage.js`, que solo guarda preferencias de interfaz.
2. **Una sola renovación simultánea.** El interceptor de `src/api/client.js` comparte una única promesa de refresco. Sin ese candado, cinco consultas expiradas a la vez dispararían cinco renovaciones; como el refresco es rotativo con detección de reutilización, el servidor cerraría **todas** las sesiones del usuario por sospecha de robo.
3. **La interfaz no autoriza.** `usePermission` y los guardias del router solo evitan mostrar lo que el usuario no puede usar. El servidor decide en cada petición. Se pregunta siempre por permisos (`sales:void`), nunca por el nombre del rol: los roles los edita cada empresa.
4. **Nunca aritmética de dinero en el cliente.** La API envía enteros en la unidad mínima; `src/lib/money.js` solo convierte para mostrar y para enviar. Los totales, impuestos y descuentos los calcula el servidor. `parseMoneyInput` **rechaza** más decimales de los que admite la moneda en lugar de redondear en silencio.
5. **TanStack Query es caché, no estado.** Nunca se copia una respuesta a un almacén propio: eso crea dos verdades. Zustand queda para estado de interfaz (panel abierto, borrador del punto de venta).
6. **Las mutaciones no se reintentan solas.** Repetir una venta o un abono por decisión del cliente es exactamente lo que no debe pasar; reintentar es una decisión del usuario, protegida en el servidor con `Idempotency-Key`.
7. **Nada específico de un rubro.** El nombre comercial, el logo y los colores vienen de la configuración que devuelve la API (*white-label*). Los formularios de producto se generarán desde los atributos que defina cada categoría, no campo por campo.
8. **Los errores se tratan por `code`**, no por el texto del mensaje: `src/api/ApiError.js` normaliza el formato RFC 7807 del servidor y expone `toFormErrors()` para marcar campos concretos.

## Accesibilidad y uso real

El sistema se opera muchas horas al día, a veces en pantalla táctil y con las manos
ocupadas. De ahí varias decisiones que parecen detalles:

- El foco visible **nunca** se elimina: el punto de venta se maneja con teclado.
- El color siempre acompaña al texto, nunca lo sustituye.
- Las cifras usan dígitos de ancho fijo para que las columnas de importes se comparen de un vistazo.
- Los avisos usan `aria-live` para no robar el foco a quien está escribiendo.
- El tema oscuro se aplica antes del primer pintado, sin destello blanco al recargar.

## Siguiente paso

F1 — catálogo: categorías con atributos definidos por cada empresa, productos y el
**formulario dirigido por metadata**, que es la pieza que permite que la misma
pantalla sirva a una joyería y a una ferretería sin una línea condicional por rubro.
Ver [`docs/01-arquitectura.md §4.2`](docs/01-arquitectura.md#42-formularios-dirigidos-por-metadata).
