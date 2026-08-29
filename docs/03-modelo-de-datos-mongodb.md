# 03 — Modelo de datos MongoDB

## 1. Principios de modelado

MongoDB no es una base relacional con JSON: modelar como si lo fuera produce
consultas con cinco `$lookup` y un rendimiento peor que el de SQL. Las reglas
que gobiernan este esquema:

1. **Se modela según los patrones de acceso, no según la teoría de normalización.** Cada decisión de embeber o referenciar responde a "¿cómo se lee esto en la pantalla real?".
2. **Se embebe cuando** el dato pertenece al ciclo de vida del padre, se lee siempre con él y su cardinalidad es acotada (líneas de una venta, variantes de un producto, definiciones de atributo de una categoría).
3. **Se referencia cuando** el dato tiene ciclo de vida propio, se consulta por sí mismo o crece sin límite (clientes, productos, movimientos de kardex, asientos de cuenta).
4. **Se duplica a propósito** (snapshot) cuando el documento debe conservar el valor histórico. Ver [02 §8](02-modelo-de-dominio.md#8-snapshots-por-qué-se-duplican-datos-a-propósito).
5. **Ninguna colección de negocio existe sin `tenantId`**, y `tenantId` es el **primer campo de todo índice**.
6. **Límite de 16 MB por documento**: nada que crezca indefinidamente se embebe. Una venta con 500 líneas es plausible; una cuenta corriente con 40.000 asientos, no.
7. **Cada consulta del sistema debe estar respaldada por un índice.** Un `COLLSCAN` en producción con datos de 500 tenants es un incidente, no una lentitud.

## 2. Tipos de datos

| Concepto | Tipo BSON | Justificación |
|---|---|---|
| Dinero | `{ amount: Long, currency: String }` — entero en unidad mínima | Ver [ADR-005](01-arquitectura.md#adr-005-dinero-en-enteros-de-unidad-mínima-cantidades-en-decimal128). `12540` = 125,40 |
| Cantidad, peso, longitud | `Decimal128` | Decimal exacto, comparable y agregable en la base |
| Porcentaje / tasa | `Int32` en puntos base | 1650 = 16,50 %. Sin flotantes |
| Fechas | `Date` (UTC) | Se almacena en UTC; la zona horaria del tenant se aplica al presentar y al agrupar por día |
| Identificadores | `ObjectId` | Nativo, ordenable por tiempo de creación |
| Atributos dinámicos | subdocumento `attributes` | Tipos restringidos y validados contra la definición |
| Enumeraciones | `String` con `enum` | Legible en consultas y exportaciones |

> Nota sobre fechas y reportes: agrupar por día usando UTC produce cifras
> incorrectas para tenants en husos negativos (una venta de las 20:00 local cae
> en el día siguiente UTC). Todas las agregaciones por período usan
> `$dateTrunc` con la `timezone` del tenant.

## 3. Convenciones comunes

Todo documento de negocio incluye:

```jsonc
{
  "tenantId":  ObjectId,     // OBLIGATORIO. Inyectado por plugin, nunca por el llamador
  "createdAt": Date,
  "updatedAt": Date,
  "createdBy": ObjectId,
  "updatedBy": ObjectId,
  "deletedAt": Date|null,    // borrado lógico (solo entidades maestras)
  "deletedBy": ObjectId|null,
  "version":   Int32         // bloqueo optimista
}
```

Aplicado por plugins globales de Mongoose (`tenantScope`, `softDelete`,
`auditFields`, `optimisticLock`) para que ningún esquema deba recordarlo.

## 4. Catálogo de colecciones

### Plataforma (sin `tenantId`; viven fuera del aislamiento)

| Colección | Contenido |
|---|---|
| `tenants` | Empresas: identidad, plan, estado, configuración, branding, perfil fiscal |
| `plans` | Ediciones comercializables y sus límites |
| `subscriptions` | Suscripción por tenant: plan, vigencia, estado de pago, límites efectivos |
| `industry_templates` | Plantillas de vertical versionadas |
| `platform_users` | Super-administradores del producto |
| `platform_audit_logs` | Auditoría de acciones de plataforma |

### Identidad y acceso

| Colección | Contenido |
|---|---|
| `users` | Usuarios del tenant: credenciales, roles, sucursales asignadas |
| `roles` | Roles por tenant con su conjunto de permisos |
| `branches` | Sucursales |
| `refresh_tokens` | Sesiones activas (hash del token, dispositivo, IP, expiración) |
| `invitations` | Invitaciones pendientes |

### Catálogo

`categories` · `units` · `products` · `price_lists` · `brands`

### Inventario

`stocks` · `stock_movements` · `lots` · `serial_items` · `stock_counts` (inventarios físicos)

### Compras

`suppliers` · `purchase_orders` · `goods_receipts` · `supplier_returns`

### Ventas y facturación

`customers` · `customer_segments` · `sales` · `sale_returns` · `invoices` · `credit_notes` · `document_series` · `tax_rules`

### Crédito

`customer_accounts` · `account_entries` · `payments`

### Contabilidad y auditoría

`accounting_periods` · `period_closures` · `audit_logs` · `jobs` (trabajos asíncronos) · `idempotency_keys` · `attachments`

## 5. Esquemas de las colecciones críticas

### 5.1 `tenants`

```jsonc
{
  "_id": ObjectId,
  "slug": "joyeria-el-diamante",          // único global; subdominio
  "legalName": "Joyería El Diamante S.A.",
  "tradeName": "El Diamante",
  "taxId": "0801199012345",
  "country": "GT", "currency": "GTQ", "timezone": "America/Guatemala",
  "locale": "es-GT",
  "industryTemplate": { "key": "jewelry", "version": "1.0.0", "appliedAt": Date },
  "branding": {                            // white-label
    "logoUrl": "...", "primaryColor": "#7C3AED", "documentFooter": "...", "customDomain": null
  },
  "settings": {
    "costingMethod": "AVERAGE",            // AVERAGE | FIFO | SPECIFIC
    "allowNegativeStock": false,
    "priceIncludesTax": true,
    "roundingMode": "HALF_UP",
    "paymentAllocationStrategy": "FIFO",   // FIFO | MANUAL | SPECIFIC
    "agingBuckets": [30, 60, 90],
    "defaultCreditTermDays": 30,
    "blockSalesOnOverdue": true,
    "lowStockAlerts": true,
    "fiscalYearStartMonth": 1,
    "customValues": {}                     // p. ej. goldGramPrice, usado por fórmulas de precio
  },
  "status": "ACTIVE",                       // TRIAL | ACTIVE | SUSPENDED | CANCELLED
  "subscriptionId": ObjectId,
  "createdAt": Date
}
```

`settings.customValues` es lo que permite que una fórmula de precio dependa de
la cotización del oro sin que el modelo conozca el concepto "oro".

### 5.2 `products`

```jsonc
{
  "_id": ObjectId, "tenantId": ObjectId,
  "sku": "ANI-0042",
  "barcodes": ["7501234567890"],
  "name": "Anillo solitario",
  "description": "...",
  "categoryId": ObjectId,
  "categoryPath": [ObjectId, ObjectId],     // desnormalizado: filtrar por rama sin recursión
  "brandId": ObjectId|null,
  "unitId": ObjectId,
  "trackingMode": "SERIAL",
  "attributes": {                           // ← validado contra la categoría
    "material": "Oro 18k",
    "weightGr": Decimal128("3.750"),
    "stoneType": "Circón",
    "ringSize": "7"
  },
  "cost":  { "amount": Long(1850000), "currency": "GTQ" },
  "prices": [
    { "priceListId": ObjectId, "amount": Long(2960000), "currency": "GTQ" }
  ],
  "taxCode": "ISV15",
  "minStock": Decimal128("1"), "maxStock": Decimal128("5"), "reorderPoint": Decimal128("2"),
  "images": [{ "url": "...", "isPrimary": true, "width": 1200, "height": 1200 }],
  "variants": [
    { "_id": ObjectId, "sku": "ANI-0042-7", "barcode": "...",
      "axisValues": { "ringSize": "7" },
      "cost": {...}, "prices": [...], "isActive": true }
  ],
  "supplierRefs": [{ "supplierId": ObjectId, "supplierSku": "SOL-18K-3.7", "lastCost": {...} }],
  "isActive": true,
  "searchText": "anillo solitario oro 18k circon ani-0042"   // mantenido en pre-save
}
```

**Índices**

```js
{ tenantId: 1, sku: 1 }                                    // unique
{ tenantId: 1, barcodes: 1 }                               // unique sparse
{ tenantId: 1, "variants.sku": 1 }                         // unique sparse
{ tenantId: 1, categoryId: 1, isActive: 1, name: 1 }       // listado con filtro
{ tenantId: 1, categoryPath: 1, isActive: 1 }              // filtro por rama
{ tenantId: 1, searchText: "text" }                         // búsqueda
{ tenantId: 1, isActive: 1, updatedAt: -1 }                 // sincronización incremental
// Atributos filterable: índices parciales creados dinámicamente al marcarlos
{ tenantId: 1, "attributes.material": 1 }  // partialFilterExpression: { "attributes.material": { $exists: true } }
```

**Nota sobre índices de atributos dinámicos:** se crean **solo** para atributos
marcados `filterable`, mediante una operación administrativa asíncrona
(`createIndex` en segundo plano) al activar la marca. Sin este control, un
tenant con 40 atributos generaría 40 índices y degradaría toda la escritura de
la colección compartida —afectando a los demás tenants.

### 5.3 `stocks`

```jsonc
{
  "_id": ObjectId, "tenantId": ObjectId,
  "productId": ObjectId, "variantId": ObjectId|null, "branchId": ObjectId,
  "onHand": Decimal128("3"), "reserved": Decimal128("1"), "available": Decimal128("2"),
  "averageCost": { "amount": Long(1850000), "currency": "GTQ" },
  "lastMovementAt": Date, "lastCountedAt": Date, "version": 12
}
```

```js
{ tenantId: 1, productId: 1, variantId: 1, branchId: 1 }   // unique — clave natural
{ tenantId: 1, branchId: 1, available: 1 }                  // existencias por sucursal
{ tenantId: 1, available: 1 }                              // reporte de faltantes
```

La consulta de "productos bajo stock mínimo" compara dos campos de documentos
distintos (`stocks.available` vs `products.minStock`). Se resuelve con una
agregación con `$lookup` **más** un campo desnormalizado `minStock` copiado en
`stocks`, actualizado por evento al cambiar el producto: permite un índice
directo y convierte un reporte costoso en una consulta indexada.

### 5.4 `stock_movements` (kardex)

```jsonc
{
  "_id": ObjectId, "tenantId": ObjectId,
  "seq": Long(1042),
  "occurredAt": Date, "registeredAt": Date, "registeredBy": ObjectId,
  "productId": ObjectId, "variantId": null, "branchId": ObjectId,
  "lotId": null, "serialId": ObjectId,
  "type": "SALE", "direction": "OUT",
  "quantity": Decimal128("1"),
  "unitCost": { "amount": Long(1850000), "currency": "GTQ" },
  "totalCost": { "amount": Long(1850000), "currency": "GTQ" },
  "balanceAfter": Decimal128("2"),
  "avgCostAfter": { "amount": Long(1850000), "currency": "GTQ" },
  "reference": { "docType": "SALE", "docId": ObjectId, "docNumber": "F001-000123" },
  "reason": null, "notes": null,
  "periodId": ObjectId,
  "transferId": null
}
```

```js
{ tenantId: 1, productId: 1, branchId: 1, occurredAt: -1 }   // kardex de un producto
{ tenantId: 1, occurredAt: -1 }                              // libro general
{ tenantId: 1, "reference.docId": 1 }                        // trazabilidad desde el documento
{ tenantId: 1, type: 1, occurredAt: -1 }                     // reportes por tipo
{ tenantId: 1, periodId: 1 }                                 // cierre mensual
{ tenantId: 1, productId: 1, branchId: 1, seq: -1 }          // último movimiento (saldo)
```

**Colección de mayor crecimiento del sistema.** Estrategia a escala:

- Sin TTL: el kardex es histórico permanente.
- **Archivado por período** a partir de ~50 M de documentos: los movimientos de períodos cerrados con más de N años se mueven a `stock_movements_archive` (misma forma), consultable solo desde reportes históricos.
- Escritura *append-only* y siempre con `seq` creciente → localidad de índice favorable, sin actualizaciones en sitio.

### 5.5 `sales`

```jsonc
{
  "_id": ObjectId, "tenantId": ObjectId,
  "number": "V001-000123", "series": "V001", "sequence": 123,
  "branchId": ObjectId, "sellerId": ObjectId,
  "customerId": ObjectId,
  "customerSnapshot": { "code": "C-0007", "name": "María Fernández",
                        "taxId": "0801...", "address": "..." },
  "type": "CREDIT", "status": "CONFIRMED",
  "lines": [
    { "_id": ObjectId, "productId": ObjectId, "variantId": null,
      "snapshot": { "sku": "ANI-0042", "name": "Anillo solitario",
                    "attributes": { "material": "Oro 18k", "weightGr": "3.750" } },
      "quantity": Decimal128("1"), "unit": "UN",
      "unitPrice": { "amount": Long(2960000), "currency": "GTQ" },
      "discount":  { "amount": Long(0), "currency": "GTQ" },
      "taxCode": "ISV15", "taxAmount": { "amount": Long(386087), "currency": "GTQ" },
      "lineTotal": { "amount": Long(2960000), "currency": "GTQ" },
      "unitCost":  { "amount": Long(1850000), "currency": "GTQ" },   // congelado
      "serialId": ObjectId, "lotId": null }
  ],
  "payments": [ { "method": "CASH", "amount": {...}, "reference": null, "receivedAt": Date } ],
  "subtotal": {...}, "discountTotal": {...}, "taxTotal": {...}, "total": {...},
  "paidAmount": {...}, "creditAmount": {...},
  "cogs": {...}, "grossProfit": {...},          // congelados al confirmar
  "issuedAt": Date, "dueDate": Date, "periodId": ObjectId,
  "invoiceId": ObjectId,
  "voidedAt": null, "voidReason": null, "creditNoteId": null,
  "idempotencyKey": "..."
}
```

```js
{ tenantId: 1, number: 1 }                                  // unique
{ tenantId: 1, issuedAt: -1 }
{ tenantId: 1, branchId: 1, issuedAt: -1 }
{ tenantId: 1, customerId: 1, issuedAt: -1 }
{ tenantId: 1, sellerId: 1, issuedAt: -1 }
{ tenantId: 1, status: 1, type: 1, issuedAt: -1 }
{ tenantId: 1, periodId: 1 }
{ tenantId: 1, "lines.productId": 1, issuedAt: -1 }         // ranking de productos vendidos
{ tenantId: 1, idempotencyKey: 1 }                          // unique sparse
```

Las líneas se embeben: pertenecen a la venta, se leen siempre con ella y su
cantidad es acotada. `cogs` y `grossProfit` se congelan al confirmar para que la
utilidad histórica no cambie al variar costos futuros.

### 5.6 `document_series` — numeración correlativa

```jsonc
{
  "_id": ObjectId, "tenantId": ObjectId,
  "docType": "INVOICE",              // INVOICE | CREDIT_NOTE | SALE | PURCHASE | PAYMENT | ADJUSTMENT
  "branchId": ObjectId,
  "prefix": "F001", "padding": 6,
  "current": Long(123),
  "rangeFrom": Long(1), "rangeTo": Long(999999),   // autorización fiscal, si aplica
  "validUntil": Date|null,
  "isActive": true
}
```

```js
{ tenantId: 1, docType: 1, branchId: 1, prefix: 1 }   // unique
```

**Obtención del siguiente número — la única forma correcta:**

```js
const series = await DocumentSeries.findOneAndUpdate(
  { tenantId, docType, branchId, isActive: true, $expr: { $lt: ["$current", "$rangeTo"] } },
  { $inc: { current: 1 } },
  { new: true, session }
);
if (!series) throw new BusinessRuleViolation('SERIES_EXHAUSTED_OR_MISSING');
const number = `${series.prefix}-${String(series.current).padStart(series.padding, "0")}`;
```

Usar `countDocuments() + 1` o leer-luego-escribir produce números duplicados
bajo concurrencia. Con dos cajas vendiendo al mismo tiempo, ocurre el primer día.

### 5.7 `customer_accounts` y `account_entries`

```jsonc
// customer_accounts — proyección del saldo
{
  "_id": ObjectId, "tenantId": ObjectId, "customerId": ObjectId,
  "currency": "GTQ",
  "balance":        { "amount": Long(1250000), "currency": "GTQ" },
  "creditLimit":    { "amount": Long(5000000), "currency": "GTQ" },
  "overdueAmount":  { "amount": Long(320000),  "currency": "GTQ" },
  "unappliedCredit":{ "amount": Long(0),       "currency": "GTQ" },
  "oldestDueDate": Date, "lastPaymentAt": Date,
  "aging": { "current": {...}, "d1_30": {...}, "d31_60": {...}, "d61_90": {...}, "d90_plus": {...} },
  "status": "OVERDUE", "lastEntrySeq": Long(87), "version": 87
}

// account_entries — append-only, fuente de verdad
{
  "_id": ObjectId, "tenantId": ObjectId, "accountId": ObjectId, "customerId": ObjectId,
  "seq": Long(87),
  "entryDate": Date, "type": "DEBIT", "concept": "CREDIT_SALE",
  "amount":       { "amount": Long(2960000), "currency": "GTQ" },
  "balanceAfter": { "amount": Long(1250000), "currency": "GTQ" },
  "outstanding":  { "amount": Long(1250000), "currency": "GTQ" },
  "dueDate": Date, "status": "PARTIAL",
  "reference": { "docType": "SALE", "docId": ObjectId, "docNumber": "V001-000123" },
  "reversalOf": null, "periodId": ObjectId
}
```

```js
// account_entries
{ tenantId: 1, accountId: 1, seq: -1 }                                  // unique — estado de cuenta
{ tenantId: 1, accountId: 1, type: 1, status: 1, dueDate: 1 }           // débitos abiertos (aplicación FIFO)
{ tenantId: 1, customerId: 1, entryDate: -1 }
{ tenantId: 1, status: 1, dueDate: 1 }                                  // cartera vencida global
{ tenantId: 1, periodId: 1 }
```

Los asientos **no** se embeben en la cuenta: crecen sin límite (un cliente
activo genera miles) y se consultan paginados por su cuenta. Embeberlos
alcanzaría el límite de 16 MB y haría que cada lectura del saldo arrastrara todo
el historial.

### 5.8 `payments`

```jsonc
{
  "_id": ObjectId, "tenantId": ObjectId,
  "number": "REC-000045", "customerId": ObjectId, "accountId": ObjectId,
  "receivedAt": Date, "receivedBy": ObjectId, "branchId": ObjectId,
  "method": "CASH", "amount": {...}, "reference": null,
  "allocations": [
    { "entryId": ObjectId, "docNumber": "V001-000098", "appliedAmount": {...} },
    { "entryId": ObjectId, "docNumber": "V001-000123", "appliedAmount": {...} }
  ],
  "unappliedAmount": { "amount": Long(0), "currency": "GTQ" },
  "status": "APPLIED", "voidedAt": null, "reversalOf": null,
  "notes": null, "attachmentId": null, "periodId": ObjectId,
  "idempotencyKey": "..."
}
```

### 5.9 `audit_logs`

```jsonc
{
  "_id": ObjectId, "tenantId": ObjectId,
  "occurredAt": Date,
  "actor": { "userId": ObjectId, "name": "Ana López", "role": "MANAGER",
             "ip": "190.x.x.x", "userAgent": "..." },
  "action": "sale.void",
  "entity": { "type": "Sale", "id": ObjectId, "label": "V001-000123" },
  "changes": [ { "field": "status", "before": "CONFIRMED", "after": "VOIDED" } ],
  "metadata": { "reason": "Cliente desistió", "requestId": "01J8ZK...", "branchId": ObjectId },
  "severity": "HIGH"                                   // LOW | MEDIUM | HIGH | CRITICAL
}
```

```js
{ tenantId: 1, occurredAt: -1 }
{ tenantId: 1, "entity.type": 1, "entity.id": 1, occurredAt: -1 }   // historial de un registro
{ tenantId: 1, "actor.userId": 1, occurredAt: -1 }                  // actividad de un usuario
{ tenantId: 1, action: 1, occurredAt: -1 }
{ tenantId: 1, severity: 1, occurredAt: -1 }
```

Retención según el plan del tenant. El TTL **no** se aplica con índice TTL
global (borraría registros de planes con retención extendida): un job diario
elimina por tenant según su política, y el borrado queda registrado.

### 5.10 `idempotency_keys`

```jsonc
{
  "_id": ObjectId, "tenantId": ObjectId,
  "key": "cli-uuid-v4", "endpoint": "POST /api/v1/sales",
  "requestHash": "sha256(...)",           // detecta reuso de clave con distinto cuerpo
  "status": "COMPLETED",                   // IN_PROGRESS | COMPLETED | FAILED
  "responseStatus": 201, "responseBody": {...},
  "createdAt": Date, "expiresAt": Date
}
```

```js
{ tenantId: 1, key: 1, endpoint: 1 }   // unique
{ expiresAt: 1 }                        // TTL 24 h
```

Si llega la misma clave con un cuerpo distinto → `409 IDEMPOTENCY_KEY_REUSED`.
Si llega igual y ya está `COMPLETED` → se devuelve la respuesta original sin
reejecutar.

## 6. Reglas de indexación

1. **`tenantId` primero, siempre.** Un índice `{ sku: 1 }` sin tenant obliga a recorrer las claves de todos los tenants.
2. **Regla ESR**: campos de igualdad → ordenamiento → rango.
3. **Unicidad siempre compuesta con `tenantId`.** Un `unique` sobre `sku` sin tenant impediría que dos empresas usen el mismo código: un fallo funcional grave y difícil de revertir en producción.
4. Índices parciales para banderas de baja selectividad (`isActive: true`, `deletedAt: null`, `status: 'OPEN'`).
5. Cada índice debe justificarse por una consulta real y documentada. Se revisa periódicamente con `$indexStats` y se eliminan los no usados: cada índice encarece toda escritura.
6. Los índices de texto se limitan a uno por colección (restricción de MongoDB); si la búsqueda necesita más, se evalúa Atlas Search.

## 7. Agregaciones de reporte

Los reportes son *pipelines* de agregación con reglas estrictas:

1. **`$match` con `tenantId` en la primera etapa, sin excepción** — filtra por índice antes de cualquier trabajo.
2. `$lookup` solo tras haber reducido el conjunto; nunca sobre la colección completa.
3. `allowDiskUse` en reportes históricos amplios.
4. Reportes de períodos cerrados: **leer `period_closures`**, no recalcular.
5. Rango máximo consultable en línea configurable; más allá, se encola y se entrega como descarga.
6. El dashboard consume una colección de proyecciones (`dashboard_daily`) mantenida por eventos, no agrega sobre `sales` en cada carga.

```jsonc
// Ejemplo: productos más vendidos del período
[
  { "$match": { "tenantId": T, "status": "CONFIRMED", "issuedAt": { "$gte": from, "$lte": to } } },
  { "$unwind": "$lines" },
  { "$group": { "_id": "$lines.productId",
                "units":   { "$sum": "$lines.quantity" },
                "revenue": { "$sum": "$lines.lineTotal.amount" },
                "cost":    { "$sum": { "$multiply": ["$lines.unitCost.amount", "$lines.quantity"] } } } },
  { "$addFields": { "profit": { "$subtract": ["$revenue", "$cost"] } } },
  { "$sort": { "units": -1 } }, { "$limit": 20 },
  { "$lookup": { "from": "products", "localField": "_id", "foreignField": "_id",
                 "as": "product", "pipeline": [ { "$project": { "sku": 1, "name": 1 } } ] } }
]
```

## 8. Migraciones

- Versionadas, numeradas, idempotentes y **siempre hacia adelante**; sin *rollback* automático de datos (una reversión de datos suele destruir información nueva).
- Ejecutadas en el arranque del despliegue, no en el de la aplicación, y registradas en `migrations`.
- Cambios de esquema en dos fases: (1) escribir en ambos formatos y leer con tolerancia; (2) migrar datos y retirar el formato antiguo. Evita ventana de indisponibilidad.
- Índices nuevos creados en segundo plano; en colecciones grandes, con `rollingIndexBuild` en Atlas.
- Toda migración probada previamente sobre una copia de datos de producción.

## 9. Respaldo y recuperación

| Aspecto | Definición |
|---|---|
| Respaldo | Continuo con recuperación a un punto en el tiempo (Atlas) o `mongodump` diario + oplog |
| RPO | ≤ 5 minutos |
| RTO | ≤ 1 hora |
| Restauración por tenant | Procedimiento documentado: restaurar a instancia temporal, extraer por `tenantId`, reinsertar. Es la consecuencia operativa de compartir base y debe estar probada **antes** del primer cliente |
| Prueba de restauración | Trimestral y registrada. Un respaldo nunca verificado no es un respaldo |
| Cifrado | En reposo y en tránsito; archivos adjuntos cifrados en el almacenamiento |
