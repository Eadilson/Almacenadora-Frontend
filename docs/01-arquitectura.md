# 01 — Arquitectura

## 1. Vista general

Aplicación web de tres piezas desplegables independientes:

```
┌─────────────────────┐        HTTPS / JSON         ┌──────────────────────────┐
│  SPA React + Vite   │ ──────────────────────────► │  API REST  /api/v1       │
│  (estático en CDN)  │ ◄────────────────────────── │  Node.js + Express       │
└─────────────────────┘   JWT (access + refresh)    └───────────┬──────────────┘
                                                                │
                          ┌─────────────────────────────────────┼───────────────────────┐
                          │                    │                │                       │
                    ┌─────▼──────┐    ┌────────▼───────┐  ┌─────▼──────┐      ┌─────────▼────────┐
                    │  MongoDB   │    │ Almacenamiento │  │   Redis    │      │  Trabajos        │
                    │ replica set│    │  de archivos   │  │ caché/cola │      │  en segundo plano│
                    └────────────┘    │ (S3 / disco)   │  └────────────┘      │ (BullMQ)         │
                                      └────────────────┘                       └──────────────────┘
```

- El frontend es **estático**: no hay renderizado en servidor, no comparte proceso con la API, no conoce la base de datos.
- La API es **sin estado**: cualquier réplica atiende cualquier petición. Sesiones, caché y colas viven fuera del proceso.
- Redis y las colas son **opcionales en el MVP** (fallback: caché en memoria por proceso y ejecución sincrónica), pero la abstracción existe desde el inicio para no rediseñar al escalar. Ver [ADR-008](#adr-008-colas-para-trabajos-largos).

## 2. Clean Architecture aplicada al backend

### 2.1 Capas y regla de dependencia

```
        ┌───────────────────────────────────────────────────────────────┐
        │  interfaces  (HTTP: rutas, controladores, middlewares, DTO)   │
        │  ─ traduce protocolo ↔ casos de uso. Sin reglas de negocio.   │
        └───────────────────────────┬───────────────────────────────────┘
                                    │ depende de
        ┌───────────────────────────▼───────────────────────────────────┐
        │  application  (casos de uso, puertos, políticas, orquestación)│
        │  ─ un caso de uso = una transacción de negocio.               │
        └───────────────────────────┬───────────────────────────────────┘
                                    │ depende de
        ┌───────────────────────────▼───────────────────────────────────┐
        │  domain  (entidades, agregados, value objects, invariantes)   │
        │  ─ CERO imports de express, mongoose, jsonwebtoken, fs, ...   │
        └───────────────────────────────────────────────────────────────┘
                                    ▲ implementa los puertos de application
        ┌───────────────────────────┴───────────────────────────────────┐
        │  infrastructure  (Mongoose, PDFKit, ExcelJS, Multer, SMTP,    │
        │                   Winston, Redis, storage, JWT, Bcrypt)       │
        └───────────────────────────────────────────────────────────────┘
```

**La regla:** las dependencias apuntan siempre hacia el dominio.
`infrastructure` no es una capa "inferior" sino un **detalle intercambiable**
que satisface interfaces declaradas por `application`. Sustituir MongoDB por
PostgreSQL debe requerir tocar únicamente `infrastructure` y el ensamblado.

Esta regla se verifica automáticamente en CI (ver [§9](#9-reglas-verificadas-en-ci)),
porque una regla arquitectónica que solo vive en un documento se rompe en la
tercera semana.

### 2.2 Responsabilidad exacta de cada capa

| Capa | Sí hace | No hace |
|---|---|---|
| `domain` | Reglas invariables del negocio, cálculos, transiciones de estado, validaciones de consistencia interna | Consultas, HTTP, serialización, logging, autorización |
| `application` | Orquesta agregados y repositorios, define transacciones, autoriza, publica eventos, expone puertos | SQL/consultas Mongo, `req`/`res`, formatos de archivo |
| `interfaces` | Valida forma de entrada, mapea a DTO, invoca caso de uso, serializa salida, traduce errores a HTTP | Reglas de negocio, acceso directo a modelos |
| `infrastructure` | Implementa repositorios y adaptadores, mapea documento ↔ entidad, maneja índices y transacciones | Decidir reglas de negocio |

### 2.3 Ejemplo del flujo completo (venta al crédito)

```
POST /api/v1/sales
  │
  ├─ interfaces/http/middlewares: requestContext → auth → tenantContext → rbac('sales:create')
  │                                → featureGuard('CREDIT_SALES') → validate(createSaleSchema)
  │                                → idempotency('Idempotency-Key')
  │
  ├─ interfaces/http/controllers/SaleController.create
  │     └─ construye CreateSaleCommand (DTO plano) y delega. Nada más.
  │
  ├─ application/use-cases/sales/CreateSaleUseCase.execute(command, ctx)
  │     ├─ unitOfWork.run(async (tx) => {
  │     │    1. customer   = customerRepo.findById(...)            // valida existencia y estado
  │     │    2. products   = productRepo.findManyByIds(...)
  │     │    3. sale       = Sale.create({...})                    // ← DOMINIO: totales, impuestos, invariantes
  │     │    4. period     = periodPolicy.assertOpen(sale.issuedAt) // rechaza fecha en período cerrado
  │     │    5. stockService.reserveAndIssue(sale.lines, tx)        // descuento atómico + kardex
  │     │    6. invoice    = invoiceService.issue(sale, tx)         // número correlativo atómico
  │     │    7. si CREDIT → creditService.openDebit(sale, tx)       // asiento en cuenta corriente
  │     │    8. saleRepo.save(sale, tx)
  │     │  })
  │     └─ eventBus.publish(SaleConfirmed) // fuera de la transacción: auditoría, notificaciones, caché
  │
  └─ respuesta 201 + Location + representación del recurso
```

Puntos que este flujo hace explícitos:

- **Los cálculos de totales e impuestos están en el dominio**, no en el controlador ni en el servicio de Mongo. Son las reglas que el negocio no puede ver violadas.
- **La transacción es del caso de uso**, no del repositorio. Un repositorio que abre su propia transacción impide componer operaciones.
- **Los efectos secundarios no críticos salen de la transacción** vía eventos: si falla el envío de un correo, la venta no se revierte.

## 3. Estructura de carpetas — Backend

La estructura solicitada en la especificación original es plana
(`controllers/`, `services/`, `repositories/`, ...). Se adopta una variante que
conserva **todos** esos conceptos pero los organiza por capa y por módulo,
porque con 12 módulos de negocio una carpeta `services/` plana acumula 60
archivos sin relación entre sí y el acoplamiento se vuelve invisible.
Justificación completa en [ADR-002](#adr-002-organización-por-módulo-dentro-de-cada-capa).

```
backend/
├── src/
│   ├── domain/                          # Núcleo. Sin dependencias externas.
│   │   ├── shared/
│   │   │   ├── value-objects/           # Money, Quantity, Email, Phone, TaxId, DateRange, Percentage
│   │   │   ├── entities/                # Entity, AggregateRoot (base con identidad y eventos)
│   │   │   ├── errors/                  # DomainError, BusinessRuleViolation, InvariantViolation
│   │   │   └── events/                  # DomainEvent (base)
│   │   ├── catalog/                     # Product, ProductVariant, Category, AttributeDefinition, Unit, PriceList
│   │   ├── inventory/                   # Stock, StockMovement, MovementType, CostingMethod, Lot, SerialItem
│   │   ├── purchasing/                  # PurchaseOrder, GoodsReceipt, Supplier
│   │   ├── sales/                        # Sale, SaleLine, PaymentMethod, Discount, Customer
│   │   ├── billing/                     # Invoice, CreditNote, DocumentSeries, TaxRule
│   │   ├── credit/                      # CustomerAccount, AccountEntry, Payment, PaymentAllocation, AgingBucket
│   │   ├── accounting/                  # AccountingPeriod, PeriodClosure
│   │   └── identity/                    # User, Role, Permission, Tenant, Branch, Subscription
│   │
│   ├── application/
│   │   ├── ports/                       # Interfaces que infrastructure implementa
│   │   │   ├── repositories/             # ProductRepository, SaleRepository, ...  (contratos)
│   │   │   ├── services/                 # PasswordHasher, TokenService, FileStorage, PdfGenerator,
│   │   │   │                             # SpreadsheetGenerator, Clock, IdGenerator, EventBus,
│   │   │   │                             # Cache, Mailer, UnitOfWork, Logger
│   │   │   └── index.js
│   │   ├── use-cases/
│   │   │   ├── catalog/                  # CreateProduct, UpdateProduct, ImportProducts, ...
│   │   │   ├── inventory/                # AdjustStock, TransferStock, GetKardex, RevalueCost, ...
│   │   │   ├── purchasing/               # CreatePurchase, ReceiveGoods, ReturnToSupplier, ...
│   │   │   ├── sales/                    # CreateSale, VoidSale, ReturnSale, ...
│   │   │   ├── credit/                   # RegisterPayment, GetStatement, RunAgingReport, ...
│   │   │   ├── billing/                  # IssueInvoice, IssueCreditNote, RenderInvoicePdf, ...
│   │   │   ├── reporting/                # 8 reportes + exportadores
│   │   │   ├── accounting/               # ClosePeriod, ReopenPeriod, GetClosure
│   │   │   ├── identity/                 # Login, Refresh, InviteUser, AssignRole, ...
│   │   │   └── platform/                 # CreateTenant, ApplyIndustryTemplate, ChangePlan, ...
│   │   ├── dto/                          # Commands (entrada) y ViewModels/Responses (salida)
│   │   ├── policies/                     # PermissionPolicy, FeaturePolicy, PeriodPolicy, CreditLimitPolicy
│   │   ├── event-handlers/               # Suscriptores a eventos de dominio
│   │   └── errors/                       # ApplicationError, NotFound, Conflict, Forbidden, Validation
│   │
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── mongoose/
│   │   │   │   ├── schemas/              # Definición de esquemas y modelos
│   │   │   │   ├── repositories/         # Implementaciones concretas de los puertos
│   │   │   │   ├── mappers/              # Documento ↔ entidad de dominio
│   │   │   │   ├── plugins/              # tenantScope, softDelete, timestamps, auditTrail
│   │   │   │   └── connection.js
│   │   │   ├── migrations/               # Versionadas y ejecutables hacia adelante
│   │   │   └── seeds/                    # Datos base + plantillas de vertical
│   │   ├── security/                     # BcryptPasswordHasher, JwtTokenService, RateLimiter
│   │   ├── storage/                      # LocalFileStorage, S3FileStorage (Multer como transporte)
│   │   ├── documents/                    # PdfKitInvoiceRenderer, ExcelJsReportExporter, plantillas
│   │   ├── messaging/                    # InMemoryEventBus, BullMqQueue, Mailer
│   │   ├── observability/                # WinstonLogger, requestId, métricas, healthchecks
│   │   ├── cache/                        # MemoryCache, RedisCache
│   │   └── config/                       # Carga y validación de variables de entorno
│   │
│   ├── interfaces/
│   │   └── http/
│   │       ├── routes/
│   │       │   └── v1/                   # Un router por módulo + index que los compone
│   │       ├── controllers/
│   │       ├── middlewares/              # auth, tenantContext, rbac, featureGuard, validate,
│   │       │                             # idempotency, errorHandler, notFound, rateLimit, requestLogger
│   │       ├── validators/               # Esquemas Zod de entrada por endpoint
│   │       ├── presenters/               # Entidad → JSON público (jamás se serializa una entidad cruda)
│   │       └── openapi/                  # Especificación OpenAPI 3.1
│   │
│   ├── shared/
│   │   ├── constants/                    # Enums, códigos de error, claves de permiso
│   │   ├── utils/                        # Puras y sin estado
│   │   ├── helpers/
│   │   └── context/                      # AsyncLocalStorage: RequestContext y TenantContext
│   │
│   ├── container.js                      # Ensamblado: registro de dependencias
│   ├── app.js                            # Construcción de la app Express (sin escuchar puerto)
│   └── server.js                         # Arranque, señales, apagado ordenado
│
├── tests/
│   ├── unit/                             # Dominio y casos de uso con dobles de prueba
│   ├── integration/                      # Repositorios contra MongoDB en memoria/contenedor
│   ├── e2e/                              # Flujos completos por HTTP
│   └── isolation/                        # Suite obligatoria de no-fuga entre tenants
│
├── logs/                                 # Salida de Winston (fuera de control de versiones)
├── .env.example
└── package.json
```

**Trazabilidad con la estructura pedida originalmente:**

| Carpeta pedida | Dónde vive ahora |
|---|---|
| `config/` | `infrastructure/config/` |
| `database/` | `infrastructure/database/` |
| `middlewares/` | `interfaces/http/middlewares/` |
| `routes/` | `interfaces/http/routes/v1/` |
| `controllers/` | `interfaces/http/controllers/` |
| `services/` | dividido según su naturaleza: casos de uso → `application/use-cases/`; servicios de dominio → `domain/<módulo>/services/`; servicios técnicos → `infrastructure/` |
| `repositories/` | contrato en `application/ports/repositories/`, implementación en `infrastructure/database/mongoose/repositories/` |
| `models/` | `domain/<módulo>/` (entidades) + `infrastructure/database/mongoose/schemas/` (persistencia) |
| `validators/` | `interfaces/http/validators/` |
| `dto/` | `application/dto/` |
| `utils/`, `helpers/`, `constants/` | `shared/` |
| `exceptions/` | `domain/shared/errors/` + `application/errors/` |
| `interfaces/` | `application/ports/` (el término "interfaces" se reserva para la capa de entrada) |
| `logs/` | `logs/` (sin cambio) |

La separación **entidad de dominio ≠ esquema de Mongoose** es deliberada y es
la decisión estructural más importante del backend: un modelo de Mongoose usado
como modelo de negocio arrastra la base de datos hasta las reglas del negocio y
hace imposible probar el dominio sin conexión. Ver [ADR-003](#adr-003-entidades-de-dominio-separadas-de-los-esquemas-de-mongoose).

## 4. Estructura de carpetas — Frontend

Arquitectura *feature-first*: cada módulo de negocio es una unidad cohesiva y
autocontenida; lo compartido se promueve solo cuando lo usan dos features.

```
frontend/
├── src/
│   ├── app/
│   │   ├── providers/            # QueryClient, Auth, Tenant, Theme, Toast, ErrorBoundary
│   │   ├── router/               # Rutas, lazy loading, guards por permiso
│   │   └── App.jsx
│   ├── api/
│   │   ├── client.js             # Instancia Axios: baseURL, interceptores, refresh, requestId
│   │   ├── endpoints/            # Un archivo por módulo: funciones tipadas de request
│   │   └── queryKeys.js          # Claves de TanStack Query centralizadas (evita invalidaciones erróneas)
│   ├── features/
│   │   ├── auth/                 # components/ hooks/ schemas/ pages/ (misma forma en todos)
│   │   ├── dashboard/
│   │   ├── catalog/
│   │   ├── inventory/
│   │   ├── purchasing/
│   │   ├── suppliers/
│   │   ├── customers/
│   │   ├── sales/
│   │   ├── credit/
│   │   ├── billing/
│   │   ├── reports/
│   │   ├── audit/
│   │   └── settings/             # Empresa, sucursales, usuarios, roles, atributos, series, impuestos
│   ├── components/
│   │   ├── ui/                   # shadcn/ui (generado)
│   │   ├── data/                 # DataTable, Pagination, FilterBar, EmptyState, ExportButton
│   │   ├── forms/                # FormField, MoneyInput, QuantityInput, ProductPicker,
│   │   │                         # DynamicAttributeField  ← clave multi-vertical
│   │   ├── charts/               # Envoltorios de Recharts con tema y formato unificados
│   │   └── feedback/             # Skeletons, ErrorState, ConfirmDialog
│   ├── layouts/                  # AppLayout, AuthLayout, PrintLayout
│   ├── hooks/                    # usePermission, useFeature, useDebounce, usePagination, useTenant
│   ├── store/                    # Zustand: solo estado de UI (sidebar, sucursal activa, borradores POS)
│   ├── lib/                      # formatMoney, formatDate, cn, buildDynamicSchema (Zod desde metadata)
│   ├── constants/
│   ├── types/                    # JSDoc/TS: contratos de API y modelos de vista
│   ├── styles/
│   └── main.jsx
└── vite.config.js
```

### 4.1 Estado: dos categorías, dos herramientas

- **Estado del servidor** → TanStack Query. Es caché, no estado: reintentos, invalidación, refetch en foco, actualizaciones optimistas. Nunca se copia una respuesta de API a Zustand.
- **Estado de UI** → Zustand (sucursal seleccionada, panel abierto, carrito del POS en borrador). Pequeño y explícito.

Confundir ambos es la causa habitual de datos obsoletos en pantalla y de bugs
de sincronización.

### 4.2 Formularios dirigidos por metadata

Consecuencia directa de los atributos dinámicos: el formulario de producto **no
puede** tener campos escritos a mano por rubro. El flujo es:

```
GET /api/v1/categories/:id/attributes   →  [{ key, label, type, required, options, scale, unit }]
        │
        └─► buildDynamicSchema(defs)  →  esquema Zod construido en tiempo de ejecución
                    │
                    └─► <DynamicAttributeField> por definición → React Hook Form
```

Así, la misma pantalla sirve a una joyería (material, peso, quilates) y a una
ferretería (calibre, longitud) sin una sola línea condicional por rubro. La
validación se genera desde la misma definición que valida el backend, de modo
que ambas no pueden divergir.

## 5. Inyección de dependencias

Contenedor explícito (`container.js`) con registro manual; sin decoradores ni
metaprogramación.

```js
// Esquema conceptual del ensamblado
const container = createContainer();

// Infraestructura (singletons)
container.register('logger',          () => new WinstonLogger(config.log));
container.register('clock',           () => new SystemClock());
container.register('passwordHasher',  () => new BcryptPasswordHasher(config.bcryptRounds));
container.register('tokenService',    () => new JwtTokenService(config.jwt));
container.register('fileStorage',     () => config.storage.driver === 's3'
                                              ? new S3FileStorage(config.storage)
                                              : new LocalFileStorage(config.storage));
container.register('unitOfWork',      c  => new MongooseUnitOfWork(c.resolve('mongoConnection')));

// Repositorios (implementan los puertos de application)
container.register('productRepository', c => new MongooseProductRepository(c.resolve('models')));

// Casos de uso: reciben solo puertos, nunca el contenedor
container.register('createSaleUseCase', c => new CreateSaleUseCase({
  saleRepository:     c.resolve('saleRepository'),
  productRepository:  c.resolve('productRepository'),
  stockService:       c.resolve('stockService'),
  invoiceService:     c.resolve('invoiceService'),
  creditService:      c.resolve('creditService'),
  unitOfWork:         c.resolve('unitOfWork'),
  eventBus:           c.resolve('eventBus'),
  clock:              c.resolve('clock'),
}));
```

Reglas:

1. **Nadie hace `new` de una dependencia externa dentro de un caso de uso.** Todo llega por constructor.
2. **Ningún módulo importa el contenedor** salvo `container.js` y el ensamblado de rutas. Inyectar el contenedor (*service locator*) reintroduce el acoplamiento que se busca evitar.
3. `Clock` e `IdGenerator` son puertos, no `Date.now()` ni `ObjectId()` directos: sin esto, las reglas con fechas y correlativos no son verificables de forma determinista.

## 6. Manejo de errores

### 6.1 Jerarquía

```
Error
└── AppError (code, httpStatus, isOperational, details, meta)
    ├── DomainError            409  reglas de negocio violadas
    │   ├── BusinessRuleViolation      p. ej. INSUFFICIENT_STOCK, CREDIT_LIMIT_EXCEEDED
    │   └── InvariantViolation         estado interno imposible → alerta, indica defecto
    ├── ValidationError       422  entrada mal formada (agrega errores por campo)
    ├── AuthenticationError   401  sin credenciales o token inválido/expirado
    ├── AuthorizationError    403  autenticado sin permiso, o feature no incluida en el plan
    ├── NotFoundError         404  recurso inexistente **dentro del tenant**
    ├── ConflictError         409  duplicado, versión desactualizada, idempotencia divergente
    ├── RateLimitError        429
    └── InfrastructureError   503  base de datos, almacenamiento o servicio externo caído
```

### 6.2 Formato de respuesta — RFC 7807 (Problem Details)

```jsonc
{
  "type":     "https://docs.inventra.app/errors/INSUFFICIENT_STOCK",
  "title":    "Existencias insuficientes",
  "status":   409,
  "code":     "INSUFFICIENT_STOCK",      // estable: la UI decide el mensaje según este código
  "detail":   "El producto ANI-0042 tiene 2 unidades disponibles y se solicitaron 5.",
  "instance": "/api/v1/sales",
  "requestId":"01J8ZK9V2Q7M3XF4",         // correlaciona con los logs del servidor
  "errors": [                              // solo en ValidationError
    { "field": "lines[0].quantity", "code": "MAX", "message": "Máximo disponible: 2" }
  ]
}
```

Decisiones:

- **`code` es el contrato**, no el mensaje. El texto puede cambiar o traducirse sin romper clientes.
- El `detail` de errores **no operacionales** (bug, fallo de infraestructura) se reemplaza por un texto genérico en producción y el detalle real va al log con el mismo `requestId`. Nunca se filtra una traza al cliente.
- Un `NotFoundError` por pertenecer a otro tenant devuelve **404, nunca 403**: un 403 confirmaría que el recurso existe en otra empresa.

### 6.3 Middleware central

Único punto de conversión error → respuesta HTTP. Todo controlador es `async` y
está envuelto por un `asyncHandler`, de modo que no existe `try/catch` repetido
en controladores. Los errores no operacionales se registran con severidad
`error` y, tras responder, se evalúa el apagado ordenado si el proceso quedó en
estado inconsistente.

## 7. Logging y observabilidad

| Componente | Rol |
|---|---|
| **Morgan** | Log de acceso HTTP, canalizado *dentro* de Winston (una sola salida, un solo formato) |
| **Winston** | Logger estructurado JSON; consola en desarrollo, archivo rotado + destino externo en producción |
| **RequestContext** (`AsyncLocalStorage`) | Propaga `requestId`, `tenantId`, `userId` a **todo** log sin pasarlos como parámetro |

Reglas:

1. Formato JSON en producción: `{ ts, level, msg, requestId, tenantId, userId, module, durationMs, ...meta }`.
2. **Nunca** se registran: contraseñas, hashes, tokens, `Authorization`, números completos de documento de identidad ni datos de tarjeta. Lista de redacción aplicada en el formateador, no en cada llamada.
3. Niveles con criterio: `error` = requiere intervención humana; `warn` = anomalía recuperable; `info` = hito de negocio (venta confirmada, período cerrado); `debug` = solo desarrollo.
4. `requestId` se acepta del cliente si viene (`X-Request-Id`) o se genera, y se devuelve siempre en la respuesta: soporte puede rastrear un incidente con un solo dato.
5. Healthchecks separados: `/health/live` (proceso vivo) y `/health/ready` (dependencias listas).

## 8. Transacciones y consistencia

MongoDB en replica set permite transacciones multi-documento; se usan
**solo donde la atomicidad es un requisito del negocio**, porque tienen costo.

**Requieren transacción:** confirmar venta (stock + kardex + factura + asiento
de cuenta corriente), recibir compra, registrar abono con aplicación a
documentos, anular documento, cerrar período.

**No la requieren:** crear un producto, editar un cliente, generar un reporte.

Patrón `UnitOfWork`: el caso de uso abre la transacción y los repositorios
reciben la sesión. Ningún repositorio abre transacciones por su cuenta.

**Concurrencia de existencias.** Dos vendedores pueden vender la última unidad
al mismo tiempo. La defensa no es leer-y-luego-escribir, sino una actualización
condicional atómica:

```js
const result = await StockModel.findOneAndUpdate(
  { tenantId, productId, branchId, available: { $gte: qty } },  // guarda la invariante
  { $inc: { available: -qty, onHand: -qty } },
  { new: true, session }
);
if (!result) throw new BusinessRuleViolation('INSUFFICIENT_STOCK', { productId, requested: qty });
```

Además: bloqueo optimista con `version` en agregados editables, e
**idempotencia** obligatoria (`Idempotency-Key`) en toda mutación con efecto
financiero, para que un reintento por red inestable no genere una venta
duplicada.

## 9. Reglas verificadas en CI

Un documento no impide la erosión arquitectónica; una prueba sí.

1. **Regla de dependencias**: falla el build si `domain/**` importa `express`, `mongoose`, `jsonwebtoken`, `bcrypt`, `fs` o cualquier módulo de `infrastructure/**`.
2. **Aislamiento multi-tenant**: para cada repositorio, una prueba que crea datos en dos tenants y verifica que ninguna operación de lectura, actualización o borrado alcanza al otro.
3. **Sin `tenantId` opcional**: toda consulta de repositorio debe declarar tenant; validado por prueba de contrato del repositorio base.
4. **Cobertura mínima**: 80 % en `domain/` y `application/`.
5. **Contrato de errores**: todo `code` devuelto por la API está registrado en el catálogo de códigos.
6. **OpenAPI ↔ implementación**: la especificación se valida contra las respuestas reales de las pruebas e2e.
7. **Análisis de dependencias** y linting con reglas de import por capa.

---

# Registro de decisiones de arquitectura (ADR)

### ADR-001: Monolito modular, no microservicios
**Contexto.** Producto nuevo, equipo pequeño, dominio aún en descubrimiento.
**Decisión.** Un único despliegue de API con módulos de fronteras explícitas.
**Por qué.** Los microservicios cambian complejidad de dominio por complejidad
operativa (despliegue, trazas distribuidas, consistencia eventual, contratos
entre servicios). Con este tamaño, esa inversión no se recupera. Un monolito
modular con límites reales permite extraer un módulo el día que exista una
razón medible (por ejemplo, reportería que compite por CPU con el POS).
**Costo aceptado.** Escalado en bloque; un defecto grave afecta a todo.
**Mitigación.** Fronteras verificadas en CI, comunicación entre módulos por
casos de uso y eventos —nunca importando modelos ajenos—, y módulos de
reporting listos para separarse.

### ADR-002: Organización por módulo dentro de cada capa
**Decisión.** `application/use-cases/sales/…` en lugar de `services/` plano.
**Por qué.** Con 12 módulos, agrupar por tipo técnico obliga a abrir cinco
carpetas para entender un cambio y hace invisible el acoplamiento entre
módulos. Agrupar por módulo dentro de la capa mantiene la regla de dependencia
y da cohesión: una carpeta = una capacidad de negocio.
**Compatibilidad.** Todos los conceptos de la estructura original se conservan;
ver la tabla de trazabilidad en [§3](#3-estructura-de-carpetas--backend).

### ADR-003: Entidades de dominio separadas de los esquemas de Mongoose
**Decisión.** El dominio define clases propias; `infrastructure` traduce
documento ↔ entidad mediante mappers.
**Por qué.** Un documento de Mongoose trae consigo la conexión, los hooks, la
validación del esquema y el ciclo de vida del ODM. Usarlo como modelo de
negocio significa: (a) no se puede probar una regla sin base de datos, (b) las
reglas terminan repartidas entre hooks del esquema y servicios, (c) cambiar de
persistencia obliga a reescribir el negocio.
**Costo aceptado.** Código de mapeo adicional.
**Compensación.** Dominio probado en milisegundos sin infraestructura, reglas
en un solo lugar, y libertad para modelar value objects (`Money`, `Quantity`)
que Mongo no representa de forma natural.

### ADR-004: Base compartida con discriminador `tenantId`
**Decisión.** Una base de datos, colecciones compartidas, `tenantId` obligatorio
en cada documento y como primer campo de cada índice.
**Alternativas descartadas.** Base por tenant (coste operativo lineal: N
conexiones, N migraciones, N respaldos —insostenible con cientos de clientes);
colección por tenant (explosión de metadatos e índices).
**Por qué.** Coste marginal por tenant casi nulo, una sola migración, un solo
respaldo, reportes agregados de plataforma triviales.
**Riesgo asumido.** Una consulta sin filtro de tenant filtra datos ajenos: es
el riesgo más grave del sistema.
**Mitigación (tres capas independientes).** Detalle en [04](04-multitenant-seguridad-auditoria.md#2-aislamiento-en-tres-capas).
**Puerta de salida.** El acceso a la conexión se hace tras un
`TenantConnectionProvider`, de modo que un cliente Enterprise pueda migrar a
base dedicada sin tocar repositorios ni casos de uso.

### ADR-005: Dinero en enteros de unidad mínima, cantidades en `Decimal128`
**Decisión.** Importes monetarios como entero de centavos (`Int64`) con
`currency` explícita, encapsulados en el value object `Money`. Cantidades y
magnitudes físicas (peso, longitud) en `Decimal128`.
**Por qué.** `0.1 + 0.2 !== 0.3` en punto flotante binario; en cartera y
facturación, un centavo de error compone y destruye la confianza en el sistema.
El entero de unidad mínima elimina el problema en aritmética de sumas,
descuentos e impuestos. Las cantidades sí necesitan decimales reales (3,750 gr
de oro, 2,5 m de cable), y ahí `Decimal128` es exacto y comparable en consultas.
**Regla.** Prohibido `Number` para dinero en cualquier capa. `Money` es
inmutable, valida misma moneda en toda operación y expone redondeo explícito
(`HALF_UP` por defecto, configurable por tenant).

### ADR-006: Atributos dinámicos por categoría (esquema definido por el tenant)
**Decisión.** Los campos propios de cada rubro se definen como
`AttributeDefinition` en la categoría y se guardan en `product.attributes`. El
backend genera el validador desde la definición.
**Alternativas descartadas.** Campos fijos en el esquema de producto (haría el
sistema específico de joyería: el requisito explícito es lo contrario); tabla
EAV clásica (consultas y filtros costosos, sin integridad de tipos).
**Por qué.** Habilita vender a cualquier rubro sin desplegar código, y permite
que el propio cliente agregue un atributo sin intervención de desarrollo.
**Costo aceptado.** Validación en tiempo de ejecución e índices sobre
subdocumentos.
**Mitigación.** Solo los atributos marcados `filterable` se indexan (índices
parciales); los tipos se restringen a un conjunto cerrado (`STRING`, `NUMBER`,
`DECIMAL`, `BOOLEAN`, `DATE`, `ENUM`, `MULTI_ENUM`); cambiar el tipo de un
atributo en uso exige migración explícita del tenant.

### ADR-007: Documentos financieros inmutables; corrección por compensación
**Decisión.** Facturas, movimientos de kardex y asientos de cuenta corriente no
se actualizan ni se eliminan. Un error se corrige con un documento inverso
(nota de crédito, movimiento de corrección, contra-asiento) que referencia al
original.
**Por qué.** Es el único modelo auditable: el historial explica cómo se llegó
al saldo actual. Editar un documento emitido rompe la correlatividad, invalida
cierres ya publicados e impide reconstruir el pasado.
**Consecuencia.** Los saldos (`stock.available`, `customerAccount.balance`) son
**proyecciones** de la secuencia de asientos, reconciliables por un job
periódico que detecta cualquier divergencia como incidente.

### ADR-008: Colas para trabajos largos
**Decisión.** Exportaciones masivas, importación de catálogo, cierre mensual y
envío de correos se ejecutan como trabajos asíncronos tras el puerto
`JobQueue`. En el MVP la implementación es en proceso; en producción, BullMQ
sobre Redis.
**Por qué.** Un Excel de 80.000 movimientos generado dentro del ciclo de la
petición agota el tiempo de espera, bloquea el bucle de eventos y degrada a
todos los tenants. El patrón correcto es `202 Accepted` + recurso de estado del
trabajo + descarga cuando está listo.

### ADR-009: JWT de acceso corto + refresh rotativo persistido
**Decisión.** Access token JWT de 15 minutos (sin estado); refresh token opaco
de 7–30 días, almacenado con hash, rotativo y con detección de reutilización.
**Por qué.** Un JWT largo no se puede revocar: expulsar a un empleado despedido
tardaría horas. Con acceso corto, la revocación es efectiva en minutos sin
consultar la base en cada petición.
**Detalle.** Cookie `httpOnly` + `Secure` + `SameSite=Strict` para el refresh
(inmune a robo por XSS); access token en memoria del cliente, jamás en
`localStorage`. Ver [04](04-multitenant-seguridad-auditoria.md#3-autenticación).

### ADR-010: RBAC con permisos granulares, no roles cableados
**Decisión.** El código pregunta por **permisos** (`sales:create`,
`inventory:adjust`), no por roles. Los roles son agrupaciones de permisos,
editables por tenant.
**Por qué.** `if (user.role === 'ADMIN')` esparcido por el código hace
imposible que un cliente diga "quiero que mi cajero anule ventas pero no toque
costos". Con permisos granulares es configuración; con roles cableados, es un
despliegue.

### ADR-011: Sin `DELETE` físico en datos de negocio
**Decisión.** Borrado lógico (`deletedAt`, `deletedBy`) en entidades maestras;
prohibido en documentos transaccionales (que se anulan). El borrado físico solo
existe para cumplir solicitudes legales de supresión de datos personales, por
un procedimiento auditado.
**Por qué.** Un producto eliminado sigue estando referenciado por ventas
históricas; borrarlo rompe reportes y auditoría.
**Mitigación de fugas.** Un plugin global aplica `deletedAt: null` por defecto
en todas las consultas para que nadie deba recordarlo.

### ADR-012: JavaScript con JSDoc y validación en tiempo de ejecución
**Contexto.** El stack obligatorio indica Node.js sin especificar lenguaje. Se
evaluó TypeScript y se decidió **JavaScript moderno (ESM, Node 20+)**.
**Decisión.** JavaScript puro, sin paso de compilación, complementado por tres
mecanismos que cubren lo que aportaría el tipado estático:

1. **JSDoc con `checkJs`.** Anotaciones `@typedef`, `@param` y `@returns` en
   todo contrato público: puertos, entidades, DTOs y firmas de repositorio.
   `jsconfig.json` con `checkJs: true` y `strict: true` hace que el editor y CI
   señalen errores de tipo **sin compilar nada**. Los tipos se declaran una vez
   en `types/*.js` y se reutilizan por referencia.
2. **Zod en el límite de entrada**, no solo en el frontend. Todo dato que cruza
   la frontera del proceso (cuerpo HTTP, parámetros, variables de entorno,
   respuestas de servicios externos) se parsea con `strict()`. El tipado
   estático no valida entrada externa; esto sí.
3. **Value objects que validan al construirse.** `Money`, `Quantity` y
   `Percentage` hacen imposible que exista un valor inválido en memoria, lo que
   en la práctica evita la clase de errores más costosa del sistema —aritmética
   monetaria— mejor de lo que la haría un tipo estático.

**Por qué.** Sin compilación: `node src/server.js` arranca directo, las trazas
de error apuntan a la línea real sin *source maps*, y el ciclo de iteración es
inmediato. Además, mantiene un único lenguaje sin transpilación en todo el
proyecto, lo que reduce la superficie de herramientas que hay que mantener y
depurar durante años.
**Costo aceptado.** Menos garantías en refactorizaciones amplias: renombrar un
campo de una entidad usada en 40 archivos no lo detecta el compilador.
**Mitigación.** JSDoc + `checkJs` recupera la mayor parte de esa red en el
editor; cobertura ≥ 80 % en dominio y aplicación (pruebas como red de
seguridad); ESLint con `import/no-restricted-paths` para la regla de
dependencias entre capas; y `zod` en cada frontera. El punto de vuelta atrás
está abierto: JSDoc anotado migra a TypeScript de forma incremental archivo por
archivo si algún día se decide.
**Regla operativa.** ESM en todo el backend (`"type": "module"`), sin
`require`. Node 20+ como mínimo.
