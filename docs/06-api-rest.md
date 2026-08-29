# 06 — API REST

## 1. Convenciones

| Aspecto | Regla |
|---|---|
| Base | `https://api.<dominio>/api/v1` |
| Recursos | Sustantivos en plural, kebab-case: `/purchase-orders`, `/stock-movements` |
| Métodos | `GET` leer · `POST` crear o ejecutar acción · `PATCH` modificar parcialmente · `PUT` reemplazar (poco usado) · `DELETE` desactivar (borrado lógico) |
| Acciones no CRUD | Sub-recurso con verbo: `POST /sales/:id/void`, `POST /periods/:id/close`. Una anulación no es un `PATCH status`: es una operación de negocio con reglas, motivo y efectos propios |
| Formato | `application/json; charset=utf-8`. Campos en `camelCase` |
| Fechas | ISO 8601 con zona: `2026-07-30T14:23:00.000Z` |
| Dinero | `{ "amount": 296000, "currency": "GTQ", "formatted": "Q 2,960.00" }` — entero en unidad mínima; `formatted` es de conveniencia para la UI y nunca se usa para calcular |
| Cantidades | Cadena decimal (`"3.750"`), no número, para no perder precisión al serializar |
| Identificadores | Cadena de 24 caracteres hexadecimales |
| Tenant | **Jamás** en la URL ni en el cuerpo: se deriva del token |
| Idempotencia | Encabezado `Idempotency-Key` obligatorio en mutaciones financieras |
| Correlación | `X-Request-Id` aceptado y devuelto siempre |

## 2. Estructura de respuestas

### Recurso individual

```jsonc
{
  "data": { "id": "66a1...", "sku": "ANI-0042", "name": "Anillo solitario", "...": "..." },
  "meta": { "requestId": "01J8ZK9V2Q7M3XF4" }
}
```

### Colección paginada

```jsonc
{
  "data": [ /* ... */ ],
  "meta": {
    "page": 1, "limit": 25, "total": 1247, "totalPages": 50,
    "hasNext": true, "hasPrev": false,
    "requestId": "01J8ZK9V2Q7M3XF4"
  },
  "links": {
    "self":  "/api/v1/products?page=1&limit=25",
    "next":  "/api/v1/products?page=2&limit=25",
    "first": "/api/v1/products?page=1&limit=25",
    "last":  "/api/v1/products?page=50&limit=25"
  }
}
```

**Envoltura `data` deliberada:** permite agregar `meta` y `links` sin romper
clientes, y evita el riesgo de devolver un array desnudo en la raíz.

### Error — RFC 7807

Formato único definido en [01 §6.2](01-arquitectura.md#62-formato-de-respuesta--rfc-7807-problem-details).

## 3. Paginación, filtrado y ordenamiento

```
GET /api/v1/products
  ?page=1&limit=25
  &sort=-createdAt,name              # "-" descendente; múltiples campos
  &q=anillo oro                      # búsqueda de texto
  &categoryId=66a1...
  &isActive=true
  &createdAt[gte]=2026-01-01&createdAt[lte]=2026-07-31
  &price[gte]=100000
  &attributes.material=Oro 18k       # solo atributos marcados filtrables
  &fields=id,sku,name,prices          # proyección
  &include=stock,category             # expansión controlada
```

Reglas:

- `limit` por defecto 25, máximo 100. En exportaciones se usa el flujo asíncrono, no `limit=100000`.
- **Paginación por cursor** (`cursor=<opaco>`) obligatoria en colecciones de alto volumen (`stock-movements`, `account-entries`, `audit-logs`): con `skip` grande, MongoDB recorre y descarta documentos y el rendimiento se degrada linealmente.
- `sort` restringido a una lista blanca de campos indexados por recurso. Ordenar por un campo sin índice es un `COLLSCAN` disfrazado de funcionalidad.
- `include` limitado a relaciones previstas, con profundidad máxima 1: evita que un cliente construya una consulta arbitrariamente costosa.
- Todo filtro se valida con Zod `strict`; un parámetro desconocido produce 422 en lugar de ignorarse.

## 4. Encabezados

**Petición**

| Encabezado | Uso |
|---|---|
| `Authorization: Bearer <access>` | Obligatorio salvo en `/auth/*` públicos |
| `Idempotency-Key: <uuid>` | Obligatorio en `POST` de ventas, abonos, recepciones, notas de crédito |
| `X-Request-Id` | Correlación; se genera si falta |
| `X-Branch-Id` | Sucursal activa; validada contra las asignadas al usuario |
| `If-Match: <etag>` | Control de concurrencia en `PATCH` de entidades maestras |
| `Accept-Language` | `es` por defecto |

**Respuesta**

| Encabezado | Uso |
|---|---|
| `X-Request-Id` | Siempre |
| `ETag` | En recursos individuales versionados |
| `Location` | En `201 Created` |
| `X-RateLimit-Limit` / `-Remaining` / `-Reset` | Límite de tasa |
| `Retry-After` | En 429 y 503 |

## 5. Códigos de estado

| Código | Uso |
|---|---|
| 200 | Lectura o actualización correcta |
| 201 | Recurso creado (con `Location`) |
| 202 | Trabajo asíncrono aceptado (exportación, importación, cierre) |
| 204 | Operación sin contenido de respuesta |
| 400 | Petición mal formada (JSON inválido) |
| 401 | Sin autenticar o token inválido/expirado |
| 403 | Autenticado sin permiso, o capacidad no incluida en el plan |
| 404 | No existe **o no pertenece al tenant** |
| 409 | Conflicto: regla de negocio, duplicado, versión desactualizada, idempotencia divergente |
| 422 | Validación de entrada fallida (con detalle por campo) |
| 429 | Límite de tasa excedido |
| 500 | Error no controlado (sin detalles al cliente) |
| 503 | Dependencia no disponible |

**Decisión explícita:** las violaciones de reglas de negocio son **409**, no
422. 422 significa "la forma de tu petición es incorrecta"; 409 significa "tu
petición es válida pero el estado del sistema no la permite". Distinguirlas
permite que el cliente reaccione correctamente: 422 se corrige en el formulario,
409 requiere una decisión del usuario.

## 6. Catálogo de endpoints

### 6.1 Autenticación — `/auth`

| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| POST | `/auth/login` | Inicia sesión; devuelve access + cookie de refresh | público |
| POST | `/auth/refresh` | Rota el refresh y emite nuevo access | cookie |
| POST | `/auth/logout` | Revoca la sesión actual | autenticado |
| POST | `/auth/logout-all` | Revoca todas las sesiones del usuario | autenticado |
| POST | `/auth/forgot-password` | Envía enlace de restablecimiento | público |
| POST | `/auth/reset-password` | Restablece con token de un solo uso | público |
| POST | `/auth/change-password` | Cambia la contraseña actual | autenticado |
| GET | `/auth/me` | Perfil, permisos efectivos, sucursales, capacidades del plan | autenticado |
| GET | `/auth/sessions` | Sesiones activas | autenticado |
| POST | `/auth/switch-tenant` | Cambia de empresa activa (grupos) | autenticado |

```jsonc
// POST /auth/login
{ "email": "ana@eldiamante.hn", "password": "•••", "rememberMe": true }

// 200 — el refresh viaja en cookie httpOnly, nunca en el cuerpo
{
  "data": {
    "accessToken": "eyJhbGci...",
    "expiresIn": 900,
    "user": { "id": "66a1...", "name": "Ana López", "email": "ana@eldiamante.hn",
              "role": { "id": "66a0...", "name": "MANAGER" },
              "permissions": ["sales:create", "stock:adjust", "..."],
              "branches": [{ "id": "66b1...", "name": "Centro", "isDefault": true }] },
    "tenant": { "id": "66a0...", "tradeName": "El Diamante", "currency": "GTQ",
                "timezone": "America/Guatemala",
                "features": ["CREDIT_SALES", "ADVANCED_REPORTS", "PERIOD_CLOSING"],
                "branding": { "logoUrl": "...", "primaryColor": "#7C3AED" } }
  }
}
```

`/auth/me` devuelve permisos y capacidades juntos: con una sola llamada el
frontend construye su navegación y sus guards, sin cablear roles en el cliente.

### 6.2 Catálogo — `/categories`, `/products`, `/units`, `/price-lists`

| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET | `/categories` | Árbol o lista plana (`?flat=true`) | `products:read` |
| POST | `/categories` | Crear | `products:create` |
| PATCH | `/categories/:id` | Modificar | `products:update` |
| GET | `/categories/:id/attributes` | Definiciones de atributos (**alimenta el formulario dinámico**) | `products:read` |
| POST | `/categories/:id/attributes` | Agregar definición | `products:update` |
| PATCH | `/categories/:id/attributes/:key` | Modificar definición | `products:update` |
| DELETE | `/categories/:id/attributes/:key` | Eliminar (falla si está en uso) | `products:update` |
| GET | `/products` | Listar con filtros y atributos dinámicos | `products:read` |
| POST | `/products` | Crear | `products:create` |
| GET | `/products/:id` | Detalle | `products:read` |
| PATCH | `/products/:id` | Modificar (`If-Match`) | `products:update` |
| DELETE | `/products/:id` | Desactivar | `products:delete` |
| GET | `/products/barcode/:code` | Búsqueda por código de barras (**POS**) | `products:read` |
| POST | `/products/:id/images` | Subir imagen (`multipart`) | `products:update` |
| POST | `/products/:id/variants` | Crear variante | `products:update` |
| POST | `/products/import` | Importar Excel → `202` | `products:create` |
| POST | `/products/bulk-price-update` | Actualización masiva de precios | `products:update` |
| GET | `/products/:id/price` | Precio resuelto para un cliente/lista | `products:read` |
| GET/POST/PATCH | `/units`, `/price-lists` | CRUD | `settings:manage` |

```jsonc
// POST /products
{
  "sku": "ANI-0042",
  "barcodes": ["7501234567890"],
  "name": "Anillo solitario",
  "categoryId": "66c1...",
  "unitId": "66c9...",
  "attributes": { "material": "Oro 18k", "weightGr": "3.750", "stoneType": "Circón", "ringSize": "7" },
  "cost":  { "amount": 1850000, "currency": "GTQ" },
  "prices": [{ "priceListId": "66ca...", "amount": 2960000, "currency": "GTQ" }],
  "taxCode": "ISV15",
  "minStock": "1"
}

// 422 — atributo obligatorio ausente
{
  "type": "https://docs.inventra.app/errors/VALIDATION_ERROR",
  "title": "Datos inválidos", "status": 422, "code": "VALIDATION_ERROR",
  "errors": [
    { "field": "attributes.material", "code": "ATTRIBUTE_REQUIRED",
      "message": "El atributo «Material» es obligatorio para la categoría Anillos" }
  ]
}
```

`GET /categories/:id/attributes` es el endpoint que hace posible el
multi-vertical: el frontend construye el formulario y su validación Zod desde su
respuesta, sin conocer ningún rubro.

### 6.3 Inventario — `/stock`, `/stock-movements`

| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET | `/stock` | Existencias con filtros (sucursal, categoría, bajo mínimo) | `stock:read` |
| GET | `/stock/:productId` | Existencias del producto por sucursal | `stock:read` |
| GET | `/stock/low` | Bajo stock mínimo | `stock:read` |
| GET | `/stock/valuation` | Inventario valorizado | `reports:financial:read` |
| GET | `/stock-movements` | Kardex general (cursor) | `stock:read` |
| GET | `/stock-movements/product/:id` | Kardex de un producto con saldo por movimiento | `stock:read` |
| POST | `/stock-movements/adjustment` | Ajuste con motivo obligatorio | `stock:adjust` |
| POST | `/stock-movements/loss` | Pérdida, robo o daño | `stock:adjust` |
| POST | `/stock-movements/opening` | Saldo inicial | `stock:adjust` |
| POST | `/stock-movements/:id/correction` | Corrección por compensación | `stock:adjust` |
| POST | `/stock-transfers` | Traslado entre sucursales | `stock:transfer` |
| GET/POST | `/stock-counts` | Conteo físico; aplicar diferencias | `stock:count` |
| GET | `/serial-items` | Unidades serializadas y su estado | `stock:read` |
| GET | `/lots` | Lotes y vencimientos | `stock:read` |

```jsonc
// POST /stock-movements/adjustment
{
  "branchId": "66b1...",
  "occurredAt": "2026-07-30T10:00:00.000Z",
  "reason": "Faltante detectado en conteo del 30/07",
  "lines": [ { "productId": "66d1...", "direction": "OUT", "quantity": "2" } ]
}
```

### 6.4 Compras — `/suppliers`, `/purchase-orders`, `/goods-receipts`

| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET/POST/PATCH/DELETE | `/suppliers` | CRUD de proveedores | `purchases:*` |
| GET | `/suppliers/:id/purchases` | Historial de compras | `purchases:read` |
| GET | `/purchase-orders` | Listar | `purchases:read` |
| POST | `/purchase-orders` | Crear (borrador) | `purchases:create` |
| GET | `/purchase-orders/:id` | Detalle | `purchases:read` |
| PATCH | `/purchase-orders/:id` | Modificar (solo en borrador) | `purchases:create` |
| POST | `/purchase-orders/:id/confirm` | Confirmar | `purchases:approve` |
| POST | `/purchase-orders/:id/cancel` | Anular | `purchases:void` |
| GET | `/purchase-orders/:id/pdf` | PDF de la orden | `purchases:read` |
| POST | `/goods-receipts` | Recibir mercancía → actualiza inventario y costo | `purchases:receive` |
| GET | `/goods-receipts/:id` | Detalle con movimientos generados | `purchases:read` |
| POST | `/supplier-returns` | Devolución a proveedor | `purchases:receive` |

```jsonc
// POST /goods-receipts     (Idempotency-Key obligatorio)
{
  "purchaseOrderId": "66e1...",
  "branchId": "66b1...",
  "receivedAt": "2026-07-30T09:00:00.000Z",
  "lines": [
    { "productId": "66d1...", "quantity": "5",
      "unitCost": { "amount": 1850000, "currency": "GTQ" },
      "serials": ["SN-0001","SN-0002","SN-0003","SN-0004","SN-0005"] }
  ],
  "additionalCosts": [
    { "concept": "Flete", "amount": { "amount": 150000, "currency": "GTQ" },
      "distribution": "BY_VALUE" }
  ]
}

// 201
{ "data": { "id": "66f1...", "number": "REC-000012",
            "movementsCreated": 5, "affectedProducts": 1,
            "newAverageCost": { "amount": 1880000, "currency": "GTQ" } } }
```

### 6.5 Ventas — `/customers`, `/sales`

| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET/POST/PATCH | `/customers` | CRUD de clientes | `customers:*` |
| GET | `/customers/:id/sales` | Historial de compras | `sales:read` |
| GET | `/customers/:id/account` | Cuenta corriente | `credit:read` |
| PATCH | `/customers/:id/credit` | Límite y condiciones | `credit:limit:manage` |
| POST | `/customers/:id/block` | Bloquear crédito | `credit:limit:manage` |
| GET | `/sales` | Listar con filtros | `sales:read` |
| POST | `/sales` | Registrar venta (contado, crédito o mixto) | `sales:create` (+ `sales:credit`) |
| GET | `/sales/:id` | Detalle | `sales:read` |
| POST | `/sales/:id/void` | Anular con motivo → nota de crédito + reversión | `sales:void` |
| POST | `/sales/:id/returns` | Devolución parcial | `sales:return` |
| GET | `/sales/:id/invoice/pdf` | Factura en PDF | `invoices:read` |
| POST | `/sales/:id/invoice/email` | Enviar por correo | `invoices:read` |
| GET/POST | `/quotes` | Cotizaciones y conversión a venta | `sales:create` |

```jsonc
// POST /sales     Idempotency-Key: 9f8e7d6c-...
{
  "branchId": "66b1...",
  "customerId": "66g1...",
  "type": "CREDIT",
  "issuedAt": "2026-07-30T15:30:00.000Z",
  "lines": [
    { "productId": "66d1...", "quantity": "1",
      "unitPrice": { "amount": 2960000, "currency": "GTQ" },
      "discount":  { "amount": 0, "currency": "GTQ" },
      "serialId": "66h1..." }
  ],
  "payments": [ { "method": "CASH", "amount": { "amount": 960000, "currency": "GTQ" } } ],
  "creditTermDays": 30,
  "notes": null
}

// 201
{
  "data": {
    "id": "66i1...", "number": "V001-000123", "status": "CONFIRMED", "type": "MIXED",
    "subtotal": {...}, "taxTotal": {...}, "total": { "amount": 2960000, "currency": "GTQ",
                                                     "formatted": "Q 29,600.00" },
    "paidAmount": { "amount": 960000, "currency": "GTQ" },
    "creditAmount": { "amount": 2000000, "currency": "GTQ" },
    "invoice": { "id": "66j1...", "number": "F001-000123",
                 "pdfUrl": "/api/v1/sales/66i1.../invoice/pdf" },
    "customerAccount": { "previousBalance": {...}, "newBalance": {...},
                         "availableCredit": {...}, "dueDate": "2026-08-29T..." },
    "stockUpdates": [ { "productId": "66d1...", "previous": "3", "current": "2" } ]
  }
}

// 409 — existencias insuficientes
{
  "type": "https://docs.inventra.app/errors/INSUFFICIENT_STOCK",
  "title": "Existencias insuficientes", "status": 409, "code": "INSUFFICIENT_STOCK",
  "detail": "El producto ANI-0042 tiene 2 unidades disponibles y se solicitaron 5.",
  "meta": { "productId": "66d1...", "sku": "ANI-0042", "available": "2", "requested": "5" },
  "requestId": "01J8ZK9V2Q7M3XF4"
}
```

La respuesta incluye el efecto completo de la operación (factura, cuenta,
existencias) para que el POS pinte el resultado sin encadenar cuatro peticiones
más.

### 6.6 Crédito — `/customer-accounts`, `/payments`

| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET | `/customer-accounts` | Cartera: saldos, mora, antigüedad | `credit:read` |
| GET | `/customer-accounts/:customerId` | Cuenta con documentos abiertos | `credit:read` |
| GET | `/customer-accounts/:customerId/statement` | Estado de cuenta paginado (cursor) | `credit:read` |
| GET | `/customer-accounts/:customerId/statement/pdf` | Estado de cuenta en PDF | `credit:read` |
| GET | `/customer-accounts/aging` | Antigüedad de saldos | `credit:read` |
| GET | `/customer-accounts/overdue` | Clientes con mora | `credit:read` |
| POST | `/payments` | Registrar abono | `payments:create` |
| GET | `/payments` | Listar abonos | `payments:read` |
| GET | `/payments/:id` | Detalle con asignaciones | `payments:read` |
| GET | `/payments/:id/receipt/pdf` | Recibo en PDF | `payments:read` |
| POST | `/payments/:id/void` | Anular con motivo (contra-asiento) | `payments:void` |
| POST | `/customer-accounts/:id/writeoff` | Castigar incobrable | `credit:writeoff` |

```jsonc
// POST /payments     Idempotency-Key obligatorio
{
  "customerId": "66g1...",
  "branchId": "66b1...",
  "receivedAt": "2026-07-30T16:00:00.000Z",
  "method": "CASH",
  "amount": { "amount": 400000, "currency": "GTQ" },
  "reference": null,
  "allocationStrategy": "FIFO",      // FIFO | MANUAL
  "allocations": null                // requerido solo con MANUAL
}

// 201
{
  "data": {
    "id": "66k1...", "number": "REC-000045", "status": "APPLIED",
    "amount": { "amount": 400000, "currency": "GTQ" },
    "allocations": [
      { "docNumber": "V001-000098", "appliedAmount": { "amount": 300000, "currency": "GTQ" },
        "documentStatus": "PAID" },
      { "docNumber": "V001-000123", "appliedAmount": { "amount": 100000, "currency": "GTQ" },
        "documentStatus": "PARTIAL", "remainingOutstanding": { "amount": 400000, "currency": "GTQ" } }
    ],
    "unappliedAmount": { "amount": 0, "currency": "GTQ" },
    "account": { "previousBalance": { "amount": 1000000, "currency": "GTQ" },
                 "newBalance": { "amount": 600000, "currency": "GTQ" },
                 "status": "CURRENT" },
    "receiptUrl": "/api/v1/payments/66k1.../receipt/pdf"
  }
}
```

### 6.7 Facturación — `/invoices`, `/credit-notes`, `/document-series`

| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET | `/invoices` | Listar | `invoices:read` |
| GET | `/invoices/:id` | Detalle | `invoices:read` |
| GET | `/invoices/:id/pdf` | PDF | `invoices:read` |
| POST | `/invoices/:id/void` | Anular (genera nota de crédito) | `invoices:void` |
| GET/POST | `/credit-notes` | Notas de crédito | `invoices:*` |
| GET/POST/PATCH | `/document-series` | Series por sucursal | `settings:manage` |
| GET/POST/PATCH | `/tax-rules` | Reglas fiscales | `settings:manage` |

**No existe `PATCH /invoices/:id` ni `DELETE`.** Una factura emitida es
inmutable ([ADR-007](01-arquitectura.md#adr-007-documentos-financieros-inmutables-corrección-por-compensación)).

### 6.8 Reportes — `/reports`

| Método | Ruta | Reporte | Permiso |
|---|---|---|---|
| GET | `/reports/dashboard` | Indicadores y series del período | `reports:read` |
| GET | `/reports/inventory` | Inventario valorizado | `reports:read` |
| GET | `/reports/sales` | Ventas por período, sucursal, vendedor, forma de pago | `reports:read` |
| GET | `/reports/purchases` | Compras por período y proveedor | `reports:read` |
| GET | `/reports/profit` | Utilidad y márgenes | `reports:financial:read` |
| GET | `/reports/credit` | Cartera y antigüedad | `reports:read` |
| GET | `/reports/customers` | Análisis de clientes | `reports:read` |
| GET | `/reports/top-products` | Más vendidos | `reports:read` |
| GET | `/reports/slow-moving` | Menor rotación | `reports:read` |
| GET | `/reports/kardex` | Kardex por producto y rango | `stock:read` |
| POST | `/reports/:report/export` | Exportar (`format=pdf\|xlsx`) → `202` | `reports:export` |
| GET | `/jobs/:id` | Estado del trabajo | autenticado |
| GET | `/jobs/:id/download` | Descarga con URL firmada | autenticado |

```jsonc
// POST /reports/sales/export
{ "format": "xlsx", "filters": { "from": "2026-07-01", "to": "2026-07-31",
                                 "branchId": "66b1..." },
  "columns": ["number","date","customer","total","paymentType","seller"] }

// 202
{ "data": { "jobId": "66l1...", "status": "QUEUED",
            "statusUrl": "/api/v1/jobs/66l1...",
            "estimatedSeconds": 25 } }

// GET /jobs/66l1... → 200
{ "data": { "id": "66l1...", "status": "COMPLETED", "progress": 100,
            "downloadUrl": "/api/v1/jobs/66l1.../download",
            "expiresAt": "2026-07-31T16:00:00.000Z",
            "fileSize": 245678, "rowCount": 1247 } }
```

Umbral configurable: por debajo del límite de filas, el `export` responde
directamente el archivo (200 con `Content-Disposition`); por encima, encola.

### 6.9 Períodos y auditoría

| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET | `/periods` | Períodos y su estado | `reports:read` |
| GET | `/periods/:id` | Detalle con totales preliminares | `reports:read` |
| POST | `/periods/:id/close` | Cerrar → snapshot | `periods:close` |
| POST | `/periods/:id/reopen` | Reabrir con motivo | `periods:reopen` |
| GET | `/periods/:id/closure` | Snapshot del cierre | `reports:read` |
| GET | `/periods/:id/closure/pdf` | Cierre en PDF | `reports:export` |
| GET | `/audit-logs` | Bitácora con filtros (cursor) | `audit:read` |
| GET | `/audit-logs/entity/:type/:id` | Historial de un registro | `audit:read` |
| POST | `/audit-logs/export` | Exportar → `202` | `audit:read` |

### 6.10 Configuración y administración

| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET/PATCH | `/settings/company` | Datos y preferencias de la empresa | `settings:manage` |
| GET/PATCH | `/settings/branding` | White-label | `settings:manage` |
| GET/POST/PATCH | `/branches` | Sucursales | `settings:manage` |
| GET/POST/PATCH | `/users` | Usuarios | `users:*` |
| POST | `/users/invite` | Invitar | `users:invite` |
| POST | `/users/:id/deactivate` | Desactivar y revocar sesiones | `users:deactivate` |
| GET/POST/PATCH | `/roles` | Roles y permisos | `roles:manage` |
| GET | `/permissions` | Catálogo de permisos disponibles | `roles:manage` |
| GET | `/subscription` | Plan, límites y consumo | `settings:manage` |

### 6.11 Plataforma — `/platform` (super-admin)

Autenticación separada con 2FA obligatorio.

| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/platform/tenants` | Listar y crear empresas |
| POST | `/platform/tenants/:id/apply-template` | Aplicar plantilla de vertical |
| PATCH | `/platform/tenants/:id/subscription` | Cambiar plan o estado |
| POST | `/platform/tenants/:id/impersonate` | Impersonar (con consentimiento y motivo) |
| GET/POST/PATCH | `/platform/plans` | Planes y límites |
| GET/POST | `/platform/industry-templates` | Plantillas |
| GET | `/platform/metrics` | Métricas agregadas del producto |
| GET | `/platform/audit-logs` | Auditoría de plataforma |

### 6.12 Salud y utilidades

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health/live` | El proceso responde |
| GET | `/health/ready` | Dependencias listas (base, almacenamiento, caché) |
| GET | `/version` | Versión y *commit* desplegado |
| GET | `/docs` | Documentación interactiva (OpenAPI) |
| GET | `/openapi.json` | Especificación OpenAPI 3.1 |

## 7. Idempotencia

Obligatoria en: `POST /sales`, `/payments`, `/goods-receipts`, `/credit-notes`,
`/stock-movements/*`, y en toda anulación.

```
Cliente genera UUID v4 → Idempotency-Key
  ├─ Clave nueva            → se ejecuta, se guarda la respuesta (TTL 24 h) → 201
  ├─ Clave conocida, mismo cuerpo, COMPLETED  → 200 con la respuesta original (no reejecuta)
  ├─ Clave conocida, mismo cuerpo, IN_PROGRESS→ 409 REQUEST_IN_PROGRESS + Retry-After
  └─ Clave conocida, cuerpo distinto          → 409 IDEMPOTENCY_KEY_REUSED
```

Sin esto, un tiempo de espera agotado en una red móvil produce ventas
duplicadas: descuenta inventario dos veces, emite dos facturas y duplica la
deuda del cliente. Es un problema garantizado en un POS real, no hipotético.

## 8. Límite de tasa

| Alcance | Límite |
|---|---|
| Global por IP | 300 req/min |
| `/auth/login` | 5 intentos / 15 min por IP **y** por cuenta |
| `/auth/forgot-password` | 3 / hora por cuenta |
| Por tenant | Según plan (Básico 600/min · Pro 3.000/min · Enterprise negociable) |
| Exportaciones | 10 / hora por usuario |
| Subida de archivos | 50 / hora por usuario |

Respuesta 429 con `Retry-After` y encabezados de cuota.

## 9. Versionado y evolución

- Versión en la ruta (`/api/v1`): explícita, legible en logs y trivial de enrutar.
- **Cambios compatibles** (sin nueva versión): agregar endpoints, campos opcionales de respuesta, parámetros opcionales, nuevos valores de enumeración *documentados como extensibles*.
- **Cambios incompatibles** (exigen `/api/v2`): eliminar o renombrar campos, cambiar tipos, endurecer validaciones, cambiar códigos de estado o el significado de un `code`.
- Política de retiro: anuncio, mínimo 6 meses de convivencia, encabezado `Deprecation` + `Sunset` en respuestas de la versión antigua, y métricas de uso por versión antes de apagarla.
- Los `code` de error son parte del contrato: nunca se reutiliza un código con otro significado.

## 10. Contrato y documentación

- **OpenAPI 3.1** como fuente de verdad del contrato, mantenida junto al código y publicada en `/docs`.
- Las pruebas e2e validan las respuestas reales contra el esquema: si el código y la especificación divergen, el build falla. Una documentación que se desactualiza es peor que no tenerla.
- Colección de ejemplos ejecutables para el frontend y para clientes externos.
- Catálogo de códigos de error versionado, con su significado y la acción sugerida al cliente.
