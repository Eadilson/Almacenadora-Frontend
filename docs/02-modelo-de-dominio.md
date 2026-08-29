# 02 — Modelo de dominio

## 1. Contextos delimitados (*bounded contexts*)

Nueve contextos con lenguaje y responsabilidad propios. Cada uno posee sus
datos: ningún contexto lee las colecciones de otro; se comunican por casos de
uso o eventos.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  PLATAFORMA  (fuera del tenant)                                             │
│  Tenant · Subscription · Plan · IndustryTemplate · PlatformUser             │
└──────────────────────────────────────────────────────────────────────────────┘
        │ provisiona
┌───────▼──────────────────────────────────────────────────────────────────────┐
│  IDENTIDAD Y ACCESO                                                          │
│  User · Role · Permission · Branch · Session · Invitation                    │
└──────────────────────────────────────────────────────────────────────────────┘
        │ contexto de ejecución (tenantId, userId, permisos, sucursal)
        ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│    CATÁLOGO      │   │    INVENTARIO    │   │     COMPRAS      │
│ Category         │──►│ Stock            │◄──│ Supplier         │
│ AttributeDef     │   │ StockMovement    │   │ PurchaseOrder    │
│ Product/Variant  │   │ Lot · SerialItem │   │ GoodsReceipt     │
│ Unit · PriceList │   │ (Kardex)         │   │ SupplierReturn   │
└──────────────────┘   └────────▲─────────┘   └──────────────────┘
                                │ consume existencias
┌──────────────────┐   ┌────────┴─────────┐   ┌──────────────────┐
│     VENTAS       │   │   FACTURACIÓN    │   │     CRÉDITO      │
│ Customer         │──►│ Invoice          │──►│ CustomerAccount  │
│ Sale · SaleLine  │   │ CreditNote       │   │ AccountEntry     │
│ SaleReturn       │   │ DocumentSeries   │   │ Payment          │
│                  │   │ TaxRule          │   │ PaymentAllocation│
└──────────────────┘   └──────────────────┘   └──────────────────┘

┌──────────────────────────────┐   ┌────────────────────────────────────────┐
│  PERÍODOS Y CIERRE           │   │  AUDITORÍA Y REPORTES (solo lectura)   │
│  AccountingPeriod            │   │  AuditLog · proyecciones y agregados   │
│  PeriodClosure               │   │                                        │
└──────────────────────────────┘   └────────────────────────────────────────┘
```

**Contexto compartido mínimo:** los value objects `Money`, `Quantity`, `TenantId`
y `DateRange` viven en `domain/shared` y son los únicos tipos que cruzan
fronteras. Todo lo demás se referencia por identificador, más una copia
*snapshot* de los datos que el documento debe conservar (ver [§8](#8-snapshots-por-qué-se-duplican-datos-a-propósito)).

## 2. Value objects

Tipos sin identidad, inmutables, que validan al construirse. Son el mecanismo
que evita que valores inválidos existan en memoria.

| Value object | Contenido | Invariantes que garantiza |
|---|---|---|
| `Money` | `amount` (entero, unidad mínima), `currency` | No opera entre monedas distintas; redondeo explícito; sin punto flotante; `allocate()` reparte un total en cuotas sin perder centavos |
| `Quantity` | `value` (decimal), `unit`, `scale` | No negativa salvo en contextos que lo permiten; respeta los decimales de la unidad; no suma unidades incompatibles |
| `Percentage` | `basisPoints` (entero) | Rango 0–10000; aplicar a `Money` produce `Money` |
| `TaxAmount` | `base`, `rate`, `amount`, `code` | `amount` derivado, nunca capturado a mano |
| `DocumentNumber` | `series`, `number`, `formatted` | Inmutable una vez emitido |
| `Email`, `Phone`, `TaxId` | cadena normalizada | Formato válido; `TaxId` valida según el país del tenant |
| `DateRange` | `from`, `to` | `from <= to`; expone `contains()` y `overlaps()` |
| `AttributeValue` | `key`, `type`, `value` | Coincide con el tipo y las restricciones de su `AttributeDefinition` |

Ejemplo de la invariante más importante del sistema:

```js
class Money {
  #amount; #currency;                      // entero en unidad mínima
  static of(major, currency) { /* "125.40" → 12540 */ }
  add(other)      { this.#assertSameCurrency(other); return new Money(this.#amount + other.#amount, this.#currency); }
  multiply(qty)   { return new Money(roundHalfUp(this.#amount * qty), this.#currency); }
  allocate(ratios){ /* reparte sin perder ni inventar centavos */ }
  #assertSameCurrency(o) { if (o.currency !== this.#currency) throw new InvariantViolation('CURRENCY_MISMATCH'); }
}
```

## 3. Catálogo

### 3.1 `Category` (raíz de agregado)

Jerárquica (padre opcional) y **portadora del esquema de atributos** de sus
productos: es el punto donde el sistema se vuelve multi-vertical.

```
Category
├── name, code, parentId, path[]        # path materializado para consultas por rama
├── trackingMode: NONE | LOT | SERIAL   # heredado por sus productos, sobreescribible
├── attributeDefinitions: AttributeDefinition[]
├── defaultTaxCode, defaultMarginBp
└── isActive
```

`AttributeDefinition`:

```
key            # identificador estable, inmutable tras crearse
label          # texto visible, editable
type           # STRING | NUMBER | DECIMAL | BOOLEAN | DATE | ENUM | MULTI_ENUM
required       # bool
options[]      # solo ENUM/MULTI_ENUM
unit           # solo NUMBER/DECIMAL (referencia a Unit)
scale          # decimales permitidos
filterable     # si true, se indexa parcialmente y aparece en filtros
showInList     # si aparece como columna en las tablas
order
```

**Invariantes**
1. `key` es único dentro de la categoría e **inmutable**: los productos ya guardados lo referencian.
2. Un atributo `required` no puede agregarse a una categoría con productos existentes sin un valor por defecto (evita dejar registros inválidos).
3. Eliminar una opción de un `ENUM` está prohibido si algún producto la usa; se marca como obsoleta.
4. Cambiar `type` exige una migración explícita y auditada del tenant.

### 3.2 `Product` (raíz de agregado)

```
Product
├── sku, barcode[], name, description
├── categoryId, brand
├── attributes: Map<key, AttributeValue>      ← específico del rubro, validado contra la categoría
├── unitId, trackingMode
├── cost: Money            (costo actual según método de costeo)
├── prices: { listId → Money }
├── taxCode
├── minStock, maxStock, reorderPoint
├── images[], isActive
├── variants: ProductVariant[]                (embebidas; ver §3.3)
└── supplierRefs[]                            (proveedor habitual, código del proveedor)
```

**Invariantes**
1. `sku` único por tenant; `barcode` único por tenant si está presente.
2. Todo atributo `required` de su categoría tiene valor; ningún atributo fuera de la definición se acepta.
3. `price >= cost` genera **advertencia**, no error: vender bajo costo es una decisión válida en liquidaciones, pero debe ser visible y auditada.
4. **El producto no conoce sus existencias.** `quantity` no es un campo del producto: pertenece a `Stock` por sucursal. Esta separación es lo que permite multi-sucursal sin rediseño.
5. Con `trackingMode = SERIAL`, cada unidad física es un `SerialItem` con costo propio.

> **Sobre la especificación original:** los campos `material`, `peso` y `color`
> pedidos para joyería **no** son campos de `Product`. Son
> `AttributeDefinition` de sus categorías, sembradas por la plantilla
> `jewelry`. Funcionalmente el usuario ve exactamente lo pedido; estructuralmente
> el sistema sirve a cualquier rubro. Igual criterio para `fecha de ingreso`
> (derivada del primer movimiento de kardex, no capturada) y `proveedor` (el
> habitual en `supplierRefs`; el real de cada unidad, en su movimiento de compra).

### 3.3 `ProductVariant`

Combinación vendible de ejes de atributos (talla × color en boutique; largo de
cadena en joyería). Se embebe en el producto porque no tiene ciclo de vida
propio, se consulta siempre junto al padre y su cardinalidad es acotada.

```
ProductVariant: { sku, barcode, axisValues: {talla:'M', color:'Negro'}, cost, prices, isActive }
```

Las existencias y el kardex se llevan **a nivel de variante** cuando existen;
por eso la clave de `Stock` es `(productId, variantId|null, branchId)`.

### 3.4 `PriceList`

Listas con vigencia (`validFrom`, `validTo`), moneda y prioridad; opcionalmente
por segmento de cliente. Soporta **precio calculado** mediante fórmula
declarativa evaluada en un intérprete restringido (sin `eval`), con acceso solo
a `attributes.*`, `cost` y `settings.*`:

```
"attributes.weightGr * settings.goldGramPrice * (1 + margin)"
```

Esto resuelve el caso real de la joyería (el oro cambia a diario) sin ningún
código específico de joyería: el mismo mecanismo sirve para chatarra por kilo o
cable por metro.

## 4. Inventario

Contexto con las reglas más críticas: aquí se pierde dinero cuando el diseño es
flojo.

### 4.1 `Stock` (proyección, no fuente de verdad)

```
Stock (clave: tenantId + productId + variantId + branchId)
├── onHand      : Quantity   # físico
├── reserved    : Quantity   # comprometido en ventas no confirmadas
├── available    = onHand - reserved   (derivado)
├── averageCost : Money
├── lastMovementAt, lastCountedAt
└── version
```

`Stock` es una **proyección** del kardex mantenida de forma transaccional para
poder consultarla rápido. La fuente de verdad es `StockMovement`; un job de
reconciliación recalcula y reporta cualquier divergencia como incidente.

### 4.2 `StockMovement` — el Kardex (append-only)

```
StockMovement
├── seq              # correlativo por tenant+producto+sucursal, sin huecos
├── occurredAt, registeredAt, registeredBy
├── productId, variantId, branchId, lotId?, serialId?
├── type: PURCHASE | SALE | ADJUSTMENT_IN | ADJUSTMENT_OUT | SALE_RETURN
│         | PURCHASE_RETURN | LOSS | TRANSFER_IN | TRANSFER_OUT | CORRECTION
│         | OPENING_BALANCE
├── direction: IN | OUT             (derivado del tipo, nunca capturado)
├── quantity: Quantity              (siempre positiva; el signo lo da direction)
├── unitCost: Money
├── balanceAfter:  Quantity         ← existencia resultante
├── avgCostAfter:  Money            ← costo promedio resultante
├── reference: { docType, docId, docNumber }   # venta/compra/nota que lo originó
├── reason, notes                   # obligatorio en ADJUSTMENT, LOSS, CORRECTION
└── periodId
```

**Invariantes**
1. **Inmutable.** Un movimiento equivocado se corrige con un `CORRECTION` que lo referencia; nunca se edita ni se borra.
2. `balanceAfter` se calcula en la misma transacción que actualiza `Stock`; ambos deben coincidir siempre.
3. Un movimiento `OUT` no puede dejar `balanceAfter` negativo, salvo que el tenant active `allowNegativeStock` (necesario en algunos flujos de distribución) — y entonces se marca y se reporta.
4. `ADJUSTMENT`, `LOSS` y `CORRECTION` exigen `reason` y el permiso correspondiente: son la vía por la que se encubren faltantes, así que son las más auditadas.
5. Todo movimiento pertenece a un período **abierto**.
6. Un `TRANSFER` genera **dos** movimientos (OUT en origen, IN en destino) en una sola transacción, con el mismo `transferId`.

### 4.3 Costeo

`costingMethod` por tenant, configurable:

| Método | Cómo calcula | Cuándo usarlo |
|---|---|---|
| `AVERAGE` (por defecto) | `nuevoAvg = (onHand·avg + qty·costoEntrada) / (onHand + qty)`; las salidas no alteran el promedio | Retail general. Estable y simple de explicar al cliente. |
| `FIFO` | Capas de costo consumidas en orden de entrada | Cuando el costo varía mucho y se exige margen exacto por lote |
| `SPECIFIC` | Costo propio de cada unidad serializada | Piezas únicas de alto valor (joyería) |

La utilidad por venta se calcula con el costo **vigente en el momento del
movimiento** (`unitCost` del movimiento de salida), nunca con el costo actual
del producto: recalcular márgenes históricos al cambiar un precio de compra es
un error clásico que invalida todos los reportes de utilidad.

### 4.4 `Lot` y `SerialItem`

```
Lot        : { code, expiresAt?, receivedAt, initialQty, remainingQty, unitCost, supplierId }
SerialItem : { serial, status: IN_STOCK|SOLD|RESERVED|RETURNED|LOST, unitCost, purchaseRef, saleRef }
```

Un `SerialItem` no puede venderse dos veces: la transición
`IN_STOCK → SOLD` es la invariante que lo garantiza. Esto es lo que hace
correcta la venta de piezas únicas sin ningún tratamiento especial en el código
de ventas.

## 5. Compras

```
PurchaseOrder (raíz)
├── number, supplierId + snapshot, branchId
├── status: DRAFT → CONFIRMED → PARTIALLY_RECEIVED → RECEIVED → CANCELLED
├── lines[]: { productId, variantId?, quantity, unitCost, taxCode, discount,
│              lineTotal, receivedQty }
├── subtotal, taxTotal, discountTotal, total     (calculados, nunca capturados)
├── expectedAt, currency, exchangeRate?
├── additionalCosts[]: { concept, amount, distribution: BY_VALUE|BY_QUANTITY|BY_WEIGHT }
└── notes, attachments[]

GoodsReceipt (raíz)   # separado de la orden: recibir es un hecho distinto de pedir
├── purchaseOrderId?, supplierId, branchId, receivedAt
├── lines[]: { productId, quantity, unitCost, lotCode?, serials[]?, expiresAt? }
└── generatesMovements: StockMovement[] (PURCHASE)
```

**Invariantes**
1. Los totales se calculan en el dominio; el cliente puede enviarlos, pero se recalculan y se rechaza la discrepancia (defensa contra manipulación desde el cliente).
2. Solo una orden `CONFIRMED` puede recibirse; recibir actualiza inventario y costo **en una transacción**.
3. `receivedQty <= quantity` salvo tolerancia configurada por el tenant.
4. Los **costos adicionales** (flete, seguro, aduana) se distribuyen entre líneas según el criterio elegido y forman parte del costo unitario. Omitir esto es la causa más común de márgenes irreales.
5. Una orden con recepciones no se cancela: se cierra por diferencia.
6. Recibir con proveedor a crédito genera la cuenta por pagar correspondiente (`AP`, fase F4).

## 6. Ventas

```
Sale (raíz)
├── number, branchId, sellerId
├── customerId + snapshot {name, taxId, address}   # el cliente puede cambiar de nombre después
├── type: CASH | CREDIT | MIXED
├── status: DRAFT → CONFIRMED → (VOIDED | RETURNED | PARTIALLY_RETURNED)
├── lines[]: { productId, variantId?, snapshot{sku,name,attributes},
│              quantity, unitPrice, discount, taxCode, taxAmount, lineTotal,
│              unitCost /* congelado */, lotId?, serialId? }
├── payments[]: { method: CASH|CARD|TRANSFER|CHECK|CREDIT|OTHER, amount, reference }
├── subtotal, discountTotal, taxTotal, total, paidAmount, creditAmount
├── issuedAt, periodId, invoiceId
└── notes
```

**Invariantes**
1. `total = Σ lineTotal − discountTotal + taxTotal`, calculado en el dominio.
2. `Σ payments.amount + creditAmount = total`. Un centavo de diferencia impide confirmar.
3. Una venta `CONFIRMED` es **inmutable**. Se anula (`VOIDED`, con nota de crédito y reversión de inventario) o se devuelve parcialmente (`SaleReturn`).
4. Solo se confirma con existencias suficientes en la sucursal (o `allowNegativeStock`).
5. Con `type = CREDIT`: el cliente debe permitirlo, estar sin bloqueo por mora y no exceder su límite de crédito (`CreditLimitPolicy`).
6. Confirmar es atómico: descuento de inventario + movimientos de kardex + factura numerada + asiento de cuenta corriente si aplica. Si algo falla, nada ocurre.
7. `unitCost` se **congela** en la línea al confirmar: es lo que hace que la utilidad histórica sea estable.

### 6.1 `Customer`

```
Customer
├── code, type: INDIVIDUAL|COMPANY, name, taxId, email, phone, addresses[]
├── segmentId, priceListId?
├── credit: { enabled, limit: Money, termDays, requiresApproval }
├── accountSummary: { balance, overdueAmount, lastPaymentAt, oldestDueDate }   # proyección
├── status: ACTIVE | BLOCKED | INACTIVE
└── tags[], notes
```

`accountSummary` es proyección del contexto de crédito, mantenida por eventos.
Se conserva desnormalizada porque el listado de clientes con su deuda es una de
las consultas más frecuentes del sistema y recalcularla por cliente en cada
listado no escala.

## 7. Crédito y cartera

El requisito del cliente —"las compras de distintas fechas se acumulan en una
sola deuda; los abonos disminuyen el saldo; al llegar a cero se marca cancelado
conservando el historial"— se modela como **cuenta corriente con asientos**, no
como un campo `saldo` que se suma y se resta. Un campo mutable no puede
explicar cómo llegó a su valor; una secuencia de asientos, sí.

```
CustomerAccount (raíz, una por cliente)
├── customerId, currency
├── balance: Money            # proyección: Σ débitos − Σ créditos
├── creditLimit, availableCredit (derivado)
├── overdueAmount, oldestDueDate
├── status: CURRENT | OVERDUE | BLOCKED | SETTLED
└── version

AccountEntry (append-only)
├── seq                       # correlativo por cuenta, sin huecos
├── entryDate, type: DEBIT | CREDIT
├── concept: CREDIT_SALE | PAYMENT | CREDIT_NOTE | INTEREST | ADJUSTMENT | WRITE_OFF | OPENING_BALANCE
├── amount: Money
├── balanceAfter: Money       ← saldo resultante, para estado de cuenta sin recálculo
├── reference: { docType, docId, docNumber }
├── dueDate?                  # solo débitos
├── outstanding: Money        # pendiente de este documento (solo débitos)
├── status: OPEN | PARTIAL | PAID   (solo débitos)
└── periodId

Payment (raíz)
├── number, customerId, receivedAt, receivedBy, branchId
├── method, amount, reference, notes, attachment?
├── allocations[]: PaymentAllocation { entryId, docNumber, appliedAmount }
├── unappliedAmount: Money    # saldo a favor si el abono excede la deuda
└── status: APPLIED | PARTIALLY_APPLIED | VOIDED
```

### 7.1 Reglas de aplicación de abonos

1. **Estrategia por defecto: FIFO por vencimiento** (se paga primero lo más antiguo). Configurable por tenant a `MANUAL` (el cobrador elige documentos) o `SPECIFIC` (el cliente indica qué factura paga). Es una decisión de negocio real: forzar FIFO cuando el cliente quiere pagar una factura concreta genera disputas.
2. Un abono genera **un** `AccountEntry` de tipo `CREDIT` y **N** `PaymentAllocation` contra débitos abiertos.
3. `Σ allocations.appliedAmount + unappliedAmount = payment.amount`. Siempre.
4. Al aplicarse, cada débito reduce su `outstanding`; en 0 pasa a `PAID`.
5. Cuando `balance = 0` y no quedan débitos abiertos, la cuenta pasa a `SETTLED` — **sin borrar nada**: el historial completo permanece consultable, que es exactamente lo pedido.
6. Un excedente queda como `unappliedAmount` (saldo a favor) y se aplica automáticamente a la siguiente venta a crédito. Nunca se descarta.
7. Anular un abono genera un **contra-asiento** y revierte las asignaciones; no elimina registros.
8. `balance` es siempre recomputable: `Σ DEBIT − Σ CREDIT`. El job de reconciliación compara proyección y asientos; cualquier diferencia es un incidente, no un redondeo.

### 7.2 Antigüedad de saldos (*aging*)

Rangos configurables (por defecto: corriente, 1–30, 31–60, 61–90, +90 días),
calculados sobre `dueDate` de los débitos con `outstanding > 0`. Alimenta el
reporte de cartera, la política de bloqueo por mora y las alertas de cobranza.

## 8. Snapshots: por qué se duplican datos a propósito

Los documentos transaccionales guardan una **copia inmutable** de los datos
relevantes en el momento de emitirse: nombre y `taxId` del cliente en la venta,
nombre y SKU del producto en cada línea, razón social del proveedor en la
compra.

No es redundancia por descuido: una factura emitida en marzo debe seguir
mostrando en diciembre el nombre que el cliente tenía en marzo. Si la factura
resolviera el nombre por referencia, cambiar un dato del cliente reescribiría
silenciosamente todo su historial de documentos —lo que es, además, inaceptable
en cualquier revisión fiscal.

**Regla:** referencia (`customerId`) para navegar y agregar; snapshot para
mostrar y para el documento legal.

## 9. Períodos y cierre mensual

```
AccountingPeriod : { year, month, status: OPEN|CLOSING|CLOSED|REOPENED,
                     closedAt, closedBy, reopenedAt?, reopenReason? }

PeriodClosure (snapshot inmutable)
├── periodId, generatedAt, generatedBy
├── purchases : { count, subtotal, tax, total }
├── sales     : { count, subtotal, tax, total, byPaymentType{}, byBranch{} }
├── cogs, grossProfit, grossMarginBp
├── credit    : { openingBalance, creditSales, payments, adjustments, closingBalance,
│                 aging{}, overdueAmount }
├── inventory : { valuationAtCost, unitsOnHand, byCategory{}, movementsCount }
├── topProducts[], slowMovingProducts[]
└── checksum                # detecta alteración posterior del snapshot
```

**Invariantes**
1. Cerrar un período **rechaza toda escritura** con fecha dentro de él (`PeriodPolicy` en la capa de aplicación, verificado además al persistir).
2. El cierre es un snapshot: los reportes históricos lo **leen**, no recalculan. Así, un ajuste de costo hecho hoy no altera la utilidad publicada de un mes ya cerrado — que es literalmente el requisito "sin alterar el historial".
3. No se cierra un período si el anterior está abierto.
4. Reabrir exige permiso `accounting:reopen`, motivo obligatorio y queda auditado; regenerar el cierre conserva la versión anterior.
5. El `checksum` permite demostrar que un cierre no fue modificado después de emitirse.

## 10. Eventos de dominio

Publicados **después** de confirmar la transacción, consumidos por
suscriptores. Desacoplan los efectos secundarios del flujo principal.

| Evento | Suscriptores |
|---|---|
| `SaleConfirmed` | Auditoría · proyección de dashboard · invalidación de caché · actualización de `accountSummary` · alerta de stock mínimo · notificación al cliente |
| `SaleVoided` / `SaleReturned` | Auditoría · reversión de proyecciones · contra-asiento de cartera |
| `GoodsReceived` | Recálculo de costo · alerta de precio de compra anómalo · cierre de orden |
| `StockBelowMinimum` | Notificación · sugerencia de reposición |
| `PaymentRegistered` | Auditoría · `accountSummary` · liberación de bloqueo por mora · recibo en PDF |
| `CreditLimitExceeded` | Alerta al responsable · solicitud de aprobación |
| `PeriodClosed` | Generación de reportes · congelamiento de escrituras · notificación |
| `TenantProvisioned` | Aplicación de plantilla de vertical · usuario propietario · correo de bienvenida |

**Regla:** un suscriptor que falla no revierte el hecho de negocio. Los eventos
críticos con efectos externos se encolan con reintentos; los informativos se
descartan tras registrar el fallo.

## 11. Servicios de dominio

Lógica que no pertenece a una sola entidad:

| Servicio | Responsabilidad |
|---|---|
| `PricingService` | Resuelve precio: lista aplicable, vigencia, segmento, fórmula calculada, descuentos |
| `TaxCalculationService` | Aplica reglas fiscales del tenant (incluido/excluido, exenciones, retenciones) |
| `CostingService` | Aplica el método de costeo y produce el nuevo costo tras cada entrada |
| `StockService` | Aplica movimientos garantizando atomicidad, saldo y kardex |
| `CreditService` | Abre débitos, aplica abonos, recalcula estado y antigüedad |
| `NumberingService` | Entrega correlativos atómicos por serie y sucursal |
| `AttributeValidationService` | Valida `attributes` contra la definición de la categoría |
| `PeriodPolicy` | Determina si una fecha admite escritura |

## 12. Matriz de invariantes críticas

Las que, si se rompen, corrompen datos o pierden dinero. Cada una debe tener
prueba automatizada propia.

| # | Invariante | Dónde se aplica | Prueba |
|---|---|---|---|
| 1 | Ninguna operación cruza tenants | Repositorio + contexto + plugin | `tests/isolation` |
| 2 | Existencia nunca negativa (salvo opt-in) | Actualización condicional atómica | Unitaria + concurrencia |
| 3 | `Stock.onHand` = último `balanceAfter` del kardex | Transacción + job de reconciliación | Integración |
| 4 | Numeración de documentos sin huecos ni repetidos | `$inc` atómico sobre la serie | Concurrencia (100 emisiones en paralelo) |
| 5 | `CustomerAccount.balance` = Σ débitos − Σ créditos | Transacción + reconciliación | Integración |
| 6 | `Σ pagos + crédito = total` de la venta | Dominio, al confirmar | Unitaria |
| 7 | Documento financiero jamás mutado | Sin métodos de actualización en el repositorio | Integración |
| 8 | Sin escrituras en período cerrado | `PeriodPolicy` + verificación al persistir | Integración |
| 9 | Unidad serializada vendida una sola vez | Transición de estado del `SerialItem` | Concurrencia |
| 10 | Atributos válidos respecto de su categoría | `AttributeValidationService` | Unitaria |
| 11 | Aritmética monetaria exacta | `Money` (enteros) | Unitaria con casos límite |
| 12 | Mutación financiera idempotente | Middleware `Idempotency-Key` | e2e con reintento |
