# 05 — Casos de uso e historias de usuario

## 1. Actores

| Actor | Descripción | Fase |
|---|---|---|
| **Propietario** (`OWNER`) | Dueño del negocio. Ve todo, incluidos márgenes y cartera | F1 |
| **Encargado** (`MANAGER`) | Administra la operación diaria de una o más sucursales | F1 |
| **Vendedor** (`SELLER`) | Atiende y vende. No ve costos | F1 |
| **Cajero** (`CASHIER`) | Cobra ventas de contado y abonos | F2 |
| **Bodeguero** (`WAREHOUSE`) | Recibe mercancía, ajusta y cuenta inventario | F1 |
| **Contador** (`ACCOUNTANT`) | Consulta, exporta y cierra períodos | F3 |
| **Auditor** (`AUDITOR`) | Solo lectura, incluida auditoría | F4 |
| **Super-admin** | Operador del producto: crea empresas, gestiona planes | F5 |

## 2. Catálogo de casos de uso

Notación: **UC-XX-NN**. La columna *Fase* remite al [roadmap](07-roadmap.md).

### Identidad y acceso (UC-ID)

| ID | Caso de uso | Actor | Fase |
|---|---|---|---|
| UC-ID-01 | Iniciar sesión | Todos | F1 |
| UC-ID-02 | Renovar sesión (refresh rotativo) | Todos | F1 |
| UC-ID-03 | Cerrar sesión / cerrar todas las sesiones | Todos | F1 |
| UC-ID-04 | Recuperar contraseña | Todos | F1 |
| UC-ID-05 | Cambiar contraseña | Todos | F1 |
| UC-ID-06 | Invitar usuario | Propietario, Encargado | F1 |
| UC-ID-07 | Asignar rol y sucursales a un usuario | Propietario | F1 |
| UC-ID-08 | Desactivar usuario y revocar sus sesiones | Propietario | F1 |
| UC-ID-09 | Crear rol personalizado con permisos | Propietario | F2 |
| UC-ID-10 | Activar 2FA | Todos | F5 |
| UC-ID-11 | Cambiar empresa activa (grupos) | Multi-empresa | F6 |

### Plataforma y configuración (UC-PL)

| ID | Caso de uso | Actor | Fase |
|---|---|---|---|
| UC-PL-01 | Crear empresa y aplicar plantilla de vertical | Super-admin / autoservicio | F1 (manual) / F5 (autoservicio) |
| UC-PL-02 | Configurar datos fiscales, moneda, zona horaria | Propietario | F1 |
| UC-PL-03 | Configurar branding (logo, colores, pie de documentos) | Propietario | F5 |
| UC-PL-04 | Crear y administrar sucursales | Propietario | F1 |
| UC-PL-05 | Definir series de documentos por sucursal | Propietario | F1 |
| UC-PL-06 | Configurar impuestos y reglas fiscales | Propietario | F1 |
| UC-PL-07 | Configurar método de costeo y política de existencias negativas | Propietario | F1 |
| UC-PL-08 | Configurar política de crédito (plazo, límite, bloqueo por mora) | Propietario | F2 |
| UC-PL-09 | Cambiar de plan / gestionar suscripción | Propietario | F5 |
| UC-PL-10 | Administrar plantillas de vertical | Super-admin | F5 |

### Catálogo (UC-CT)

| ID | Caso de uso | Actor | Fase |
|---|---|---|---|
| UC-CT-01 | Crear categoría con sus atributos dinámicos | Encargado | F1 |
| UC-CT-02 | Crear producto con atributos de su categoría | Encargado | F1 |
| UC-CT-03 | Generar variantes desde ejes de atributos | Encargado | F2 |
| UC-CT-04 | Subir imágenes del producto | Encargado | F1 |
| UC-CT-05 | Buscar producto por nombre, SKU, código de barras o atributo | Todos | F1 |
| UC-CT-06 | Definir listas de precio con vigencia | Encargado | F2 |
| UC-CT-07 | Definir precio calculado por fórmula | Encargado | F2 |
| UC-CT-08 | Importar catálogo desde Excel | Encargado | F3 |
| UC-CT-09 | Actualización masiva de precios | Encargado | F3 |
| UC-CT-10 | Desactivar producto | Encargado | F1 |
| UC-CT-11 | Imprimir etiquetas con código de barras | Encargado | F4 |

### Inventario (UC-IN)

| ID | Caso de uso | Actor | Fase |
|---|---|---|---|
| UC-IN-01 | Consultar existencias por producto y sucursal | Todos | F1 |
| UC-IN-02 | Consultar kardex de un producto | Encargado, Bodeguero | F1 |
| UC-IN-03 | Registrar saldo inicial de inventario | Bodeguero | F1 |
| UC-IN-04 | Ajustar existencias con motivo obligatorio | Bodeguero | F1 |
| UC-IN-05 | Registrar pérdida, robo o daño | Bodeguero | F1 |
| UC-IN-06 | Corregir un movimiento erróneo (por compensación) | Encargado | F2 |
| UC-IN-07 | Trasladar mercancía entre sucursales | Bodeguero | F2 |
| UC-IN-08 | Realizar conteo físico y aplicar diferencias | Bodeguero | F3 |
| UC-IN-09 | Consultar productos bajo stock mínimo | Encargado | F1 |
| UC-IN-10 | Recibir alerta de existencias bajas | Encargado | F3 |
| UC-IN-11 | Administrar lotes y vencimientos | Bodeguero | F4 |
| UC-IN-12 | Administrar unidades serializadas | Bodeguero | F2 |

### Compras y proveedores (UC-CO)

| ID | Caso de uso | Actor | Fase |
|---|---|---|---|
| UC-CO-01 | Registrar proveedor | Encargado | F1 |
| UC-CO-02 | Crear orden de compra | Encargado | F1 |
| UC-CO-03 | Confirmar / aprobar orden de compra | Encargado | F1 |
| UC-CO-04 | Recibir mercancía (total o parcial) | Bodeguero | F1 |
| UC-CO-05 | Distribuir costos adicionales (flete, seguro) | Encargado | F2 |
| UC-CO-06 | Devolver mercancía al proveedor | Bodeguero | F2 |
| UC-CO-07 | Anular orden de compra | Encargado | F1 |
| UC-CO-08 | Consultar historial de compras por proveedor | Encargado | F1 |
| UC-CO-09 | Comparar precios de compra entre proveedores | Encargado | F4 |
| UC-CO-10 | Gestionar cuentas por pagar | Contador | F4 |

### Clientes y ventas (UC-VE)

| ID | Caso de uso | Actor | Fase |
|---|---|---|---|
| UC-VE-01 | Registrar cliente | Vendedor | F1 |
| UC-VE-02 | Buscar cliente | Vendedor | F1 |
| UC-VE-03 | Registrar venta al contado | Vendedor | F1 |
| UC-VE-04 | Registrar venta al crédito | Vendedor | F2 |
| UC-VE-05 | Registrar venta con pago mixto | Cajero | F2 |
| UC-VE-06 | Aplicar descuento (dentro del límite del rol) | Vendedor | F1 |
| UC-VE-07 | Anular venta y emitir nota de crédito | Encargado | F2 |
| UC-VE-08 | Registrar devolución parcial | Encargado | F2 |
| UC-VE-09 | Consultar historial de compras de un cliente | Vendedor | F1 |
| UC-VE-10 | Emitir factura en PDF | Vendedor | F1 |
| UC-VE-11 | Reimprimir o enviar factura por correo | Vendedor | F3 |
| UC-VE-12 | Guardar venta como borrador / cotización | Vendedor | F3 |
| UC-VE-13 | Apartar producto con anticipo | Vendedor | F4 |

### Crédito y cobranza (UC-CR)

| ID | Caso de uso | Actor | Fase |
|---|---|---|---|
| UC-CR-01 | Consultar estado de cuenta de un cliente | Cajero, Encargado | F2 |
| UC-CR-02 | Registrar abono y aplicarlo a documentos | Cajero | F2 |
| UC-CR-03 | Aplicar abono manualmente a facturas elegidas | Cajero | F2 |
| UC-CR-04 | Emitir recibo de abono en PDF | Cajero | F2 |
| UC-CR-05 | Anular abono | Encargado | F2 |
| UC-CR-06 | Consultar cartera por antigüedad de saldos | Encargado | F3 |
| UC-CR-07 | Definir y modificar límite de crédito | Encargado | F2 |
| UC-CR-08 | Bloquear o desbloquear crédito de un cliente | Encargado | F2 |
| UC-CR-09 | Castigar deuda como incobrable | Propietario | F4 |
| UC-CR-10 | Consultar clientes con pagos vencidos | Encargado | F3 |
| UC-CR-11 | Enviar recordatorio de pago | Encargado | F5 |
| UC-CR-12 | Aplicar interés por mora | Encargado | F6 |

### Reportes y análisis (UC-RE)

| ID | Caso de uso | Actor | Fase |
|---|---|---|---|
| UC-RE-01 | Ver dashboard con indicadores del negocio | Propietario, Encargado | F3 |
| UC-RE-02 | Reporte de inventario valorizado | Encargado | F3 |
| UC-RE-03 | Reporte de compras por período y proveedor | Encargado | F3 |
| UC-RE-04 | Reporte de ventas por período, sucursal y vendedor | Encargado | F3 |
| UC-RE-05 | Reporte de utilidades y márgenes | Propietario | F3 |
| UC-RE-06 | Reporte de cartera y créditos | Encargado | F3 |
| UC-RE-07 | Reporte de clientes (frecuencia, ticket promedio) | Encargado | F3 |
| UC-RE-08 | Productos más vendidos | Encargado | F3 |
| UC-RE-09 | Productos con menor rotación | Encargado | F3 |
| UC-RE-10 | Exportar cualquier reporte a PDF y Excel | Contador | F3 |
| UC-RE-11 | Programar envío periódico de reportes | Propietario | F6 |

### Cierre y auditoría (UC-CI)

| ID | Caso de uso | Actor | Fase |
|---|---|---|---|
| UC-CI-01 | Consultar estado de los períodos | Contador | F4 |
| UC-CI-02 | Cerrar período mensual y generar snapshot | Contador | F4 |
| UC-CI-03 | Consultar cierre de un período histórico | Contador | F4 |
| UC-CI-04 | Reabrir período con motivo (auditado) | Propietario | F4 |
| UC-CI-05 | Consultar bitácora de auditoría con filtros | Auditor | F4 |
| UC-CI-06 | Ver historial de cambios de un registro | Auditor | F4 |
| UC-CI-07 | Exportar bitácora de auditoría | Auditor | F4 |

**Total: 96 casos de uso.** 40 en el MVP (F1), 26 en F2, 18 en F3, 12 en F4+.

## 3. Historias de usuario con criterios de aceptación

Se detallan las historias donde el criterio de aceptación **define la
arquitectura**. El resto sigue el mismo formato en el backlog.

---

### HU-01 · Venta al contado con descarga de inventario  · UC-VE-03 · F1

> **Como** vendedor, **quiero** registrar una venta al contado y que el sistema
> descuente el inventario y emita la factura, **para** cobrar sin llevar
> cuentas aparte y sin descuadrar las existencias.

**Criterios de aceptación**

```gherkin
Escenario: Venta con existencias suficientes
  Dado que el producto "ANI-0042" tiene 3 unidades disponibles en la sucursal "Centro"
    Y su precio de venta es 2.960,00 y su costo promedio 1.850,00
  Cuando registro una venta al contado de 1 unidad al cliente "María Fernández"
  Entonces la venta queda en estado CONFIRMED con total 2.960,00
    Y las existencias de "ANI-0042" en "Centro" quedan en 2
    Y se crea un movimiento de kardex tipo SALE, dirección OUT, cantidad 1, balanceAfter 2
    Y el movimiento registra unitCost 1.850,00
    Y se emite una factura con el siguiente número correlativo de la serie de "Centro"
    Y la utilidad registrada de la venta es 1.110,00
    Y la venta queda asociada al período abierto correspondiente

Escenario: Existencias insuficientes
  Dado que el producto "ANI-0042" tiene 1 unidad disponible
  Cuando intento vender 3 unidades
  Entonces la operación se rechaza con código INSUFFICIENT_STOCK y estado 409
    Y el mensaje indica la cantidad disponible
    Y no se crea la venta, ni la factura, ni ningún movimiento de kardex
    Y no se consume número de la serie de facturación

Escenario: Los pagos deben cuadrar con el total
  Cuando registro una venta de total 2.960,00 con pagos que suman 2.900,00
  Entonces se rechaza con código PAYMENTS_DO_NOT_MATCH_TOTAL

Escenario: Reintento por red inestable (idempotencia)
  Dado que envío la venta con Idempotency-Key "abc-123" y recibo tiempo de espera agotado
  Cuando reenvío la misma petición con la misma clave
  Entonces recibo la respuesta de la venta original
    Y existe exactamente una venta, una factura y un movimiento de kardex

Escenario: Dos cajas venden la última unidad al mismo tiempo
  Dado que el producto tiene 1 unidad disponible
  Cuando dos vendedores confirman simultáneamente una venta de 1 unidad
  Entonces exactamente una venta se confirma
    Y la otra recibe INSUFFICIENT_STOCK
    Y las existencias quedan en 0, nunca en -1

Escenario: Período cerrado
  Dado que el período de mayo está cerrado
  Cuando intento registrar una venta con fecha 15 de mayo
  Entonces se rechaza con código PERIOD_CLOSED
```

**Notas de implementación:** transacción única para stock + kardex + factura;
descuento con actualización condicional atómica; número de serie con `$inc`.

---

### HU-02 · Venta al crédito con validación de límite · UC-VE-04 · F2

> **Como** vendedor, **quiero** vender a crédito a un cliente autorizado
> **para** no perder la venta, sabiendo que el sistema controla su límite y su
> mora.

```gherkin
Escenario: Cliente autorizado y dentro del límite
  Dado que "María Fernández" tiene crédito habilitado con límite 50.000,00
    Y su saldo actual es 12.500,00 y no tiene documentos vencidos
  Cuando registro una venta al crédito por 8.000,00 con plazo de 30 días
  Entonces la venta queda CONFIRMED con creditAmount 8.000,00 y paidAmount 0,00
    Y se crea un AccountEntry DEBIT por 8.000,00 con concepto CREDIT_SALE
    Y el asiento tiene outstanding 8.000,00, estado OPEN y dueDate a 30 días
    Y el saldo de la cuenta pasa a 20.500,00
    Y el balanceAfter del asiento es 20.500,00
    Y el crédito disponible del cliente pasa a 29.500,00

Escenario: Límite de crédito excedido
  Dado que el saldo es 45.000,00 y el límite 50.000,00
  Cuando intento una venta al crédito por 8.000,00
  Entonces se rechaza con código CREDIT_LIMIT_EXCEEDED
    Y la respuesta indica el disponible (5.000,00)
    Y si el usuario tiene el permiso credit:limit:manage, se ofrece solicitar aprobación

Escenario: Cliente bloqueado por mora
  Dado que el cliente tiene un documento vencido hace 15 días
    Y la empresa tiene activado "bloquear ventas con mora"
  Cuando intento una venta al crédito
  Entonces se rechaza con código CUSTOMER_OVERDUE
    Y la venta al contado sí está permitida

Escenario: El plan no incluye créditos
  Dado que la empresa tiene plan Básico
  Cuando intento una venta al crédito
  Entonces se rechaza con código FEATURE_NOT_AVAILABLE y estado 403
```

---

### HU-03 · Deuda consolidada y abono que reduce el saldo · UC-CR-02 · F2

> **Como** cajero, **quiero** registrar un abono que se aplique automáticamente
> a las facturas más antiguas **para** que el saldo del cliente baje solo y no
> haya discusiones sobre cuánto debe.
>
> *(Esta historia implementa literalmente el requisito: "las compras de distintas
> fechas se acumulan en una sola deuda; los abonos disminuyen automáticamente el
> saldo; al llegar a cero se marca cancelado conservando el historial completo".)*

```gherkin
Escenario: Deuda acumulada de varias fechas en un solo saldo
  Dado que el cliente compró a crédito 3.000,00 el 10 de enero
    Y compró a crédito 5.000,00 el 2 de febrero
    Y compró a crédito 2.000,00 el 20 de febrero
  Cuando consulto su estado de cuenta
  Entonces el saldo total es 10.000,00
    Y se listan los tres documentos con su outstanding individual y su vencimiento
    Y el estado de cuenta muestra el saldo resultante después de cada movimiento

Escenario: Abono aplicado en orden de antigüedad (FIFO)
  Dado el saldo anterior de 10.000,00 con esos tres documentos abiertos
  Cuando registro un abono de 4.000,00
  Entonces el documento del 10 de enero queda PAID con outstanding 0,00
    Y el documento del 2 de febrero queda PARTIAL con outstanding 4.000,00
    Y el documento del 20 de febrero permanece OPEN con outstanding 2.000,00
    Y se crea un AccountEntry CREDIT por 4.000,00 con balanceAfter 6.000,00
    Y el abono registra dos asignaciones: 3.000,00 y 1.000,00
    Y el saldo del cliente es 6.000,00
    Y se genera un recibo en PDF con el detalle de la aplicación

Escenario: Cancelación total conservando el historial
  Dado un saldo de 6.000,00
  Cuando registro un abono de 6.000,00
  Entonces el saldo queda en 0,00
    Y todos los documentos quedan PAID
    Y la cuenta pasa a estado SETTLED
    Y el historial completo de asientos sigue consultable
    Y ningún registro fue eliminado ni modificado

Escenario: Abono mayor que la deuda
  Dado un saldo de 1.000,00
  Cuando registro un abono de 1.500,00
  Entonces la deuda queda en 0,00
    Y unappliedCredit del cliente es 500,00
    Y ese saldo a favor se aplica automáticamente a su siguiente venta al crédito

Escenario: Aplicación manual
  Dado que la empresa configuró la estrategia MANUAL
    Y el cliente quiere pagar específicamente la factura del 20 de febrero
  Cuando registro el abono indicando ese documento
  Entonces se aplica solo a ese documento
    Y los demás conservan su outstanding

Escenario: Anulación de abono
  Dado un abono de 4.000,00 ya aplicado
  Cuando lo anulo indicando el motivo
  Entonces se crea un asiento de reversión que referencia al original
    Y los documentos afectados recuperan su outstanding anterior
    Y el saldo vuelve a 10.000,00
    Y el abono original permanece visible con estado VOIDED
    Y queda registro en auditoría con el motivo y el usuario

Escenario: El saldo siempre es reconstruible
  Cuando el proceso de reconciliación recalcula el saldo desde los asientos
  Entonces coincide exactamente con el saldo proyectado de la cuenta
```

---

### HU-04 · Aislamiento entre empresas · F1 (transversal)

> **Como** propietario, **quiero** certeza de que ninguna otra empresa del
> sistema puede ver mis datos, **para** poder usar un sistema compartido con
> competidores.

```gherkin
Escenario: Datos completamente separados
  Dado que la empresa A tiene 50 productos y la empresa B tiene 30
  Cuando un usuario de A consulta el catálogo
  Entonces recibe únicamente sus 50 productos
    Y ningún total, contador o reporte incluye datos de B

Escenario: Acceso directo por identificador ajeno
  Dado un producto de la empresa B con identificador conocido
  Cuando un usuario de A solicita ese producto por su identificador
  Entonces recibe 404, nunca 403
    Y el intento queda registrado

Escenario: Mismo código en empresas distintas
  Dado que A tiene el SKU "ANI-001"
  Cuando B crea un producto con SKU "ANI-001"
  Entonces la operación es aceptada

Escenario: Token manipulado
  Cuando envío una petición con un tenantId distinto en el cuerpo
  Entonces se ignora y se usa el del token verificado
    Y la discrepancia se registra como intento de acceso indebido

Escenario: Reportes agregados
  Cuando un usuario de A genera cualquier reporte
  Entonces el pipeline de agregación filtra por su tenant en la primera etapa
    Y el resultado no contiene ningún registro de otra empresa
```

---

### HU-05 · Ajuste de inventario auditado · UC-IN-04 · F1

> **Como** bodeguero, **quiero** ajustar existencias cuando el conteo físico no
> coincide, **para** que el sistema refleje la realidad; **y como** propietario,
> **quiero** saber quién ajustó qué y por qué.

```gherkin
Escenario: Ajuste con motivo
  Dado que el sistema registra 10 unidades y el conteo físico da 8
  Cuando registro un ajuste de salida de 2 unidades con motivo "Faltante en conteo del 30/07"
  Entonces las existencias quedan en 8
    Y se crea un movimiento ADJUSTMENT_OUT con el motivo, balanceAfter 8 y mi usuario
    Y se registra en auditoría con severidad HIGH

Escenario: Motivo obligatorio
  Cuando intento un ajuste sin motivo
  Entonces se rechaza con código REASON_REQUIRED

Escenario: Sin permiso
  Dado que soy vendedor y no tengo el permiso stock:adjust
  Cuando intento ajustar existencias
  Entonces recibo 403 con código FORBIDDEN

Escenario: Corrección de un ajuste erróneo
  Dado un ajuste ya registrado con cantidad equivocada
  Cuando lo corrijo
  Entonces se crea un movimiento CORRECTION que referencia al original
    Y el movimiento original permanece intacto en el kardex
```

---

### HU-06 · El sistema se adapta a mi rubro · UC-CT-01 / UC-CT-02 · F1

> **Como** propietario de un negocio, **quiero** que las fichas de producto
> tengan los campos propios de lo que vendo, **para** no llenar campos que no me
> sirven ni anotar datos importantes en observaciones.
>
> *(Es la historia que hace el producto vendible a más de un rubro.)*

```gherkin
Escenario: Alta de empresa con plantilla de rubro
  Cuando se crea la empresa "Joyería El Diamante" con la plantilla "jewelry"
  Entonces existen las categorías Anillos, Cadenas, Aretes y Relojes
    Y la categoría Anillos define los atributos Material, Peso (gr), Piedra y Talla
    Y la unidad Gramo existe con 3 decimales
    Y existe una serie de facturación para la sucursal principal

Escenario: Formulario de producto según categoría
  Dado que la categoría "Anillos" define Material (lista), Peso (decimal, 3), Piedra (lista) y Talla (texto)
  Cuando abro el formulario de nuevo producto y elijo "Anillos"
  Entonces se muestran esos cuatro campos con su control adecuado
    Y Material y Peso son obligatorios
    Y el peso solo acepta hasta 3 decimales

Escenario: El cliente agrega un atributo por su cuenta
  Cuando agrego el atributo "Certificado" de tipo texto a la categoría Anillos
  Entonces aparece de inmediato en el formulario y en el detalle del producto
    Y no fue necesaria ninguna actualización del sistema

Escenario: Otro rubro, mismo sistema
  Cuando se crea la empresa "Ferretería El Tornillo" con la plantilla "hardware"
  Entonces sus categorías definen Calibre, Longitud y Material
    Y sus productos se venden por metro con 2 decimales
    Y ninguna pantalla muestra campos de joyería

Escenario: Filtrar por atributo del rubro
  Dado que "Material" está marcado como filtrable
  Cuando filtro el catálogo por Material = "Oro 18k"
  Entonces obtengo solo esos productos
    Y la consulta usa un índice (no recorre la colección)

Escenario: Validación coherente entre frontend y backend
  Cuando envío un producto sin el atributo obligatorio "Material" directamente a la API
  Entonces se rechaza con 422 y código ATTRIBUTE_REQUIRED, campo attributes.material
```

---

### HU-07 · Cierre mensual que no se altera después · UC-CI-02 · F4

> **Como** contador, **quiero** cerrar el mes y obtener cifras definitivas,
> **para** que los números que reporto hoy sigan siendo los mismos dentro de un
> año.

```gherkin
Escenario: Cierre del período
  Dado que el período de julio está abierto y junio está cerrado
  Cuando cierro julio
  Entonces se genera un snapshot con compras, ventas, costo de ventas, utilidad,
          créditos pendientes, pagos recibidos e inventario final valorizado
    Y el período queda CLOSED con fecha, usuario y checksum
    Y el reporte del período se sirve desde el snapshot

Escenario: Bloqueo de escrituras retroactivas
  Dado que julio está cerrado
  Cuando intento registrar una venta, una compra, un ajuste o un abono con fecha de julio
  Entonces se rechaza con código PERIOD_CLOSED

Escenario: Los cierres publicados no cambian
  Dado que julio está cerrado con utilidad 125.000,00
  Cuando en agosto modifico el precio de compra de un producto
  Entonces la utilidad reportada de julio sigue siendo 125.000,00

Escenario: Orden de cierre
  Dado que junio está abierto
  Cuando intento cerrar julio
  Entonces se rechaza con código PREVIOUS_PERIOD_OPEN

Escenario: Reapertura auditada
  Dado que julio está cerrado
  Cuando el propietario lo reabre con el motivo "Factura de proveedor recibida tarde"
  Entonces el período pasa a REOPENED
    Y el cierre anterior se conserva como versión histórica
    Y queda auditado con severidad CRITICAL
    Y un usuario sin el permiso periods:reopen recibe 403
```

---

### HU-08 · Reporte exportable sin bloquear el sistema · UC-RE-10 · F3

> **Como** contador, **quiero** exportar reportes extensos a Excel y PDF
> **para** trabajarlos aparte, sin que el sistema se congele para los demás.

```gherkin
Escenario: Exportación pequeña, inmediata
  Cuando exporto un reporte de menos de 5.000 filas
  Entonces recibo el archivo directamente

Escenario: Exportación grande, asíncrona
  Cuando exporto un reporte de 80.000 movimientos
  Entonces recibo 202 con el identificador del trabajo
    Y puedo consultar su progreso
    Y al terminar recibo una URL de descarga firmada y con expiración
    Y el resto de los usuarios no percibe degradación

Escenario: Contenido del archivo
  Entonces el Excel incluye encabezados, tipos correctos (fechas como fecha, montos como número),
          totales, y el logo y datos de la empresa
    Y el PDF incluye membrete, período, filtros aplicados, paginación y fecha de generación

Escenario: Permiso de datos financieros
  Dado que soy vendedor sin el permiso reports:financial:read
  Cuando exporto el reporte de ventas
  Entonces el archivo no incluye columnas de costo, margen ni utilidad
```

---

## 4. Matriz rol × permiso (roles predefinidos)

`✔` = concedido · `—` = denegado · `L` = solo lectura

| Permiso | OWNER | MANAGER | SELLER | CASHIER | WAREHOUSE | ACCOUNTANT | AUDITOR |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `products:read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `products:create/update` | ✔ | ✔ | — | — | — | — | — |
| `products:delete` | ✔ | — | — | — | — | — | — |
| `products:cost:read` | ✔ | ✔ | — | — | ✔ | ✔ | ✔ |
| `stock:read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `stock:adjust` | ✔ | ✔ | — | — | ✔ | — | — |
| `stock:transfer` | ✔ | ✔ | — | — | ✔ | — | — |
| `stock:count` | ✔ | ✔ | — | — | ✔ | — | — |
| `purchases:read` | ✔ | ✔ | — | — | ✔ | ✔ | ✔ |
| `purchases:create` | ✔ | ✔ | — | — | — | — | — |
| `purchases:approve` | ✔ | ✔ | — | — | — | — | — |
| `purchases:receive` | ✔ | ✔ | — | — | ✔ | — | — |
| `purchases:void` | ✔ | ✔ | — | — | — | — | — |
| `customers:read` | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ |
| `customers:create/update` | ✔ | ✔ | ✔ | ✔ | — | — | — |
| `sales:read` | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ |
| `sales:create` | ✔ | ✔ | ✔ | ✔ | — | — | — |
| `sales:credit` | ✔ | ✔ | ✔ | — | — | — | — |
| `sales:void` | ✔ | ✔ | — | — | — | — | — |
| `sales:return` | ✔ | ✔ | — | — | — | — | — |
| `sales:discount:override` | ✔ | ✔ | — | — | — | — | — |
| `credit:read` | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ |
| `credit:limit:manage` | ✔ | ✔ | — | — | — | — | — |
| `credit:writeoff` | ✔ | — | — | — | — | — | — |
| `payments:read` | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ |
| `payments:create` | ✔ | ✔ | ✔ | ✔ | — | — | — |
| `payments:void` | ✔ | ✔ | — | — | — | — | — |
| `invoices:issue` | ✔ | ✔ | ✔ | ✔ | — | — | — |
| `invoices:void` | ✔ | ✔ | — | — | — | — | — |
| `reports:read` | ✔ | ✔ | L | L | L | ✔ | ✔ |
| `reports:financial:read` | ✔ | ✔ | — | — | — | ✔ | ✔ |
| `reports:export` | ✔ | ✔ | — | — | — | ✔ | ✔ |
| `periods:close` | ✔ | — | — | — | — | ✔ | — |
| `periods:reopen` | ✔ | — | — | — | — | — | — |
| `audit:read` | ✔ | ✔ | — | — | — | ✔ | ✔ |
| `users:invite/update` | ✔ | ✔ | — | — | — | — | — |
| `roles:manage` | ✔ | — | — | — | — | — | — |
| `settings:manage` | ✔ | — | — | — | — | — | — |

Cada tenant puede clonar y editar estos roles: la matriz es el punto de partida,
no una restricción del sistema.
