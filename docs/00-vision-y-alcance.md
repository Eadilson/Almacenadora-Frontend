# 00 — Visión y alcance

## 1. Problema y oportunidad

Las PyMEs de retail y distribución operan hoy con cuadernos, hojas de cálculo o
software de escritorio monopuesto. Los dolores concretos y recurrentes son:

| Dolor | Consecuencia medible |
|---|---|
| Existencias reales ≠ existencias registradas | Ventas perdidas por quiebres, capital inmovilizado en obsoletos |
| Créditos a clientes anotados a mano | Cartera incobrable, cobros olvidados, disputas de saldo |
| Sin costo real por producto | Se vende bajo costo sin saberlo |
| Sin trazabilidad de quién hizo qué | Faltantes sin responsable, imposible auditar |
| Reportes construidos a mano cada mes | Decisiones tardías o intuitivas |

La oportunidad de producto no está en resolver esto para *un* negocio, sino en
resolverlo de forma **configurable para muchos negocios del mismo perfil**. Ese
es el requisito que cambia el diseño: cada decisión de este documento se toma
para que el sistema sea *instalable y vendible N veces sin tocar el código*.

## 2. Identidad del producto

- **Nombre de trabajo:** `Inventra`
- **Categoría:** ERP comercial ligero / sistema de gestión de inventario, ventas y cartera
- **Modelo de entrega:** SaaS multi-tenant (una instancia sirve a muchas empresas), con opción de despliegue dedicado (*on-premise* / nube privada) para clientes que lo exijan
- **Público objetivo:** negocios de 1 a 25 usuarios, 1 a 10 sucursales, 500 a 100.000 SKU

### 2.1 El nombre no está en el código

Regla de diseño: **ninguna cadena de marca se escribe literal en el código
fuente.** Todo texto de marca proviene de:

1. `platform.branding` — configuración de la instancia (para el dueño del producto).
2. `tenant.branding` — configuración por empresa: nombre comercial, logo, colores primarios, pie de documentos, dominio propio.

Esto convierte el *white-label* en una característica vendible (revendedores,
distribuidores, contadores que ofrecen el sistema a sus clientes) en lugar de
un refactor futuro.

**Consecuencia práctica:** el prefijo de paquetes, nombres de colecciones y
variables de entorno usan un identificador neutro y estable (`inventra`, o el
que se decida al iniciar el repositorio), nunca el nombre del primer cliente ni
el de su rubro.

## 3. Estrategia de verticales

Este es el corazón de la generalización. El sistema es horizontal; los rubros
se modelan como **datos de configuración**, no como código.

### 3.1 Qué es específico de un rubro y cómo se resuelve

| Necesidad específica del rubro | Solución genérica del producto |
|---|---|
| Joyería: material, peso en gramos, quilates, piedra, talla | **Atributos dinámicos por categoría**: cada tenant define los atributos de sus categorías (tipo, obligatoriedad, unidad, opciones). El producto los guarda en `attributes` y los valida contra la definición. |
| Joyería: cada pieza es única (una sola unidad, costo propio) | **Modo de trazabilidad por producto**: `NONE` \| `LOT` \| `SERIAL`. Pieza única = `SERIAL` con existencia 1 y costeo específico. |
| Farmacia: lote y fecha de vencimiento, alerta de caducidad | Mismo mecanismo: `LOT` + atributos de lote (`expiresAt`) + regla de alerta configurable. |
| Ferretería: venta por metro/kilo, fracciones | **Unidades de medida por tenant** con `decimalPlaces` y factores de conversión. |
| Boutique: talla × color como variantes de un modelo | **Variantes**: producto padre + variantes generadas desde ejes de atributos. |
| Impuestos y formato de factura por país | **Perfil fiscal por tenant**: impuestos, retenciones, series de documento, plantillas de impresión. |
| Precio del oro que cambia a diario | **Listas de precio** con vigencia y, opcionalmente, precio calculado = `f(atributo peso, cotización)` mediante fórmula configurable por categoría. |

### 3.2 Plantillas de vertical (*industry templates*)

Una plantilla es un archivo declarativo versionado que se aplica al crear una
empresa y siembra su configuración inicial:

```jsonc
// templates/joyeria.template.json  (extracto conceptual)
{
  "key": "jewelry",
  "name": "Joyería y relojería",
  "version": "1.0.0",
  "units": [
    { "code": "UN", "name": "Unidad", "decimalPlaces": 0 },
    { "code": "GR", "name": "Gramo",  "decimalPlaces": 3 }
  ],
  "categories": [
    {
      "name": "Anillos",
      "trackingMode": "SERIAL",
      "attributes": [
        { "key": "material", "label": "Material", "type": "ENUM",
          "options": ["Oro 18k", "Oro 14k", "Plata 925", "Acero"], "required": true, "filterable": true },
        { "key": "weightGr", "label": "Peso (gr)", "type": "DECIMAL",
          "unit": "GR", "required": true, "scale": 3 },
        { "key": "stoneType", "label": "Piedra", "type": "ENUM",
          "options": ["Sin piedra", "Circón", "Diamante", "Esmeralda"] },
        { "key": "ringSize", "label": "Talla", "type": "STRING" }
      ]
    }
  ],
  "priceRules": [
    { "appliesToCategory": "Anillos", "formula": "attributes.weightGr * settings.goldGramPrice * (1 + margin)" }
  ],
  "documentSeries": [{ "type": "INVOICE", "prefix": "F001", "start": 1 }],
  "roles": ["OWNER", "MANAGER", "SELLER", "WAREHOUSE", "ACCOUNTANT"]
}
```

Consecuencias:

- Vender a una joyería, una farmacia o una ferretería es **elegir plantilla en el onboarding**, no un fork del código.
- Las plantillas son un activo comercial: cada nueva vertical amplía el mercado sin deuda técnica.
- El código nunca contiene `if (rubro === 'joyeria')`. Si aparece esa condición en una revisión, es un defecto de diseño.

### 3.3 Verticales objetivo del lanzamiento

1. **Joyería y relojería** (cliente inicial y caso de validación: piezas únicas, alto valor unitario, crédito y abonos).
2. **Ferretería / materiales** (volumen, unidades fraccionadas).
3. **Boutique / calzado** (variantes talla-color).

Farmacia y repuestos quedan como plantillas posteriores por su exigencia
regulatoria (lote, vencimiento, catálogo homologado).

## 4. Ediciones comercializables

Se implementan como **feature flags por tenant** resueltos desde su
suscripción, no como builds distintos. Un único artefacto desplegable.

| Capacidad | Básico | Pro | Enterprise |
|---|---|---|---|
| Inventario, compras, ventas contado, facturación | ✔ | ✔ | ✔ |
| Usuarios incluidos | 3 | 15 | ilimitado |
| Sucursales | 1 | 5 | ilimitado |
| Créditos, cuenta corriente y abonos | — | ✔ | ✔ |
| Reportes avanzados y dashboard | básico | ✔ | ✔ |
| Exportación PDF / Excel | PDF | ✔ | ✔ |
| Cierre mensual y períodos contables | — | ✔ | ✔ |
| Auditoría con retención extendida | 30 d | 1 año | configurable |
| White-label y dominio propio | — | — | ✔ |
| API pública y webhooks | — | lectura | completa |
| Multi-empresa bajo un mismo login (grupos) | — | — | ✔ |

El *gate* de cada capacidad se evalúa en la capa de aplicación
(`FeatureGuard`), nunca solo en la UI: ocultar un botón no es un control de
acceso.

## 5. Alcance funcional

### 5.1 Dentro del alcance

**Núcleo (MVP)**
- Autenticación, gestión de usuarios, roles y permisos por empresa
- Empresas, sucursales, configuración y plantilla de vertical
- Catálogo: categorías con atributos dinámicos, productos, variantes, unidades, listas de precio
- Inventario: existencias por sucursal, kardex append-only, ajustes, stock mínimo y alertas
- Compras: órdenes/recepciones a proveedor, costeo, actualización automática de inventario
- Proveedores y clientes
- Ventas al contado, con emisión de comprobante y descarga de inventario
- Facturación: series correlativas por sucursal, PDF, anulación por nota de crédito

**Comercial y financiero (post-MVP inmediato)**
- Ventas al crédito, cuenta corriente por cliente, deuda consolidada
- Abonos con aplicación automática a documentos abiertos, estados de cartera y mora
- Devoluciones de venta y de compra
- Reportes: inventario, valorización, compras, ventas, utilidad, cartera, ranking de rotación
- Exportación a PDF y Excel
- Dashboard con indicadores y series temporales
- Cierre mensual con snapshot inmutable
- Auditoría consultable

**Plataforma (habilita la venta)**
- Onboarding autoservicio con plantilla de vertical
- Suscripciones, planes y límites
- Panel de administración de la plataforma (super-admin)

### 5.2 Fuera del alcance (declarado explícitamente)

- Contabilidad de partida doble y libros fiscales completos → se expone integración/exportación, no se reimplementa
- Nómina y recursos humanos
- Facturación electrónica con firma y envío a autoridad fiscal → **fase posterior**, aislada tras un puerto `EInvoicingProvider` por país para no contaminar el dominio
- E-commerce y tienda pública
- Manufactura y explosión de materiales (relevante para joyería a medida; se evalúa como módulo `Producción` en F6)
- Aplicación móvil nativa (la web es responsive; el POS offline se evalúa en F6)

## 6. Atributos de calidad (metas medibles)

| Atributo | Meta | Cómo se verifica |
|---|---|---|
| Rendimiento | p95 < 300 ms en lecturas de catálogo con 50.000 SKU; < 800 ms al confirmar una venta | Pruebas de carga con dataset sintético por tenant |
| Escalabilidad | 500 tenants / 5.000 usuarios activos sobre una instancia horizontalmente escalable, sin estado en el proceso | API sin sesión en memoria; caché y colas externas |
| Aislamiento | 0 fugas cross-tenant | Suite de pruebas de aislamiento obligatoria en CI |
| Integridad financiera | Saldo de cartera recomputable desde asientos con diferencia 0 | Job de reconciliación diario |
| Disponibilidad | 99.5 % mensual | Healthchecks, reintentos, despliegue sin caída |
| Mantenibilidad | Dominio con 0 dependencias de framework; cobertura ≥ 80 % en dominio y aplicación | Regla de dependencias verificada en CI |
| Observabilidad | Toda petición con `requestId` correlacionable extremo a extremo | Logging estructurado |
| Seguridad | OWASP Top 10 mitigado; secretos fuera del repositorio | Revisión y análisis de dependencias en CI |

## 7. Restricciones

- **Stack obligatorio** (definido por el cliente): Node.js + Express + MongoDB/Mongoose + JWT + Bcrypt + Multer + PDFKit + ExcelJS + Dotenv + Morgan + Winston en backend; React + Vite + React Router + Axios + React Hook Form + Zod + TanStack Query + Tailwind + shadcn/ui + Lucide + Recharts en frontend.
- MongoDB debe operar como **replica set** (obligatorio para transacciones multi-documento; incluido en MongoDB Atlas, también en el tier gratuito).
- API REST versionada en `/api/v1`, desacoplada del frontend, consumible por terceros.
- Idioma de la interfaz: español, con textos externalizados desde el día 1 para permitir otros mercados.

## 8. Supuestos

1. Operación en línea; el POS no requiere trabajar sin conexión en el MVP.
2. Un usuario pertenece a **una** empresa en el MVP; los grupos multi-empresa llegan en Enterprise (el modelo de datos ya lo contempla, ver [04](04-multitenant-seguridad-auditoria.md)).
3. Moneda única por empresa en el MVP, con el campo `currency` ya presente para habilitar multimoneda sin migración.
4. Los comprobantes del MVP son documentos internos con numeración propia; la homologación fiscal por país se aborda en la fase de facturación electrónica.

## 9. Glosario

| Término | Definición operativa en este sistema |
|---|---|
| **Tenant / Empresa** | Unidad de aislamiento de datos. Todo registro operativo pertenece a exactamente un tenant. |
| **Sucursal** | Ubicación física de un tenant. Las existencias son por sucursal, nunca globales. |
| **SKU** | Identificador único de un producto o variante vendible dentro del tenant. |
| **Kardex** | Libro append-only de movimientos de inventario con saldo resultante por movimiento. |
| **Movimiento** | Hecho que altera existencias: compra, venta, ajuste, devolución, pérdida, traslado, corrección. |
| **CPP** | Costo promedio ponderado: método de costeo por defecto. |
| **Cuenta corriente** | Estado de deuda consolidada de un cliente: débitos por ventas a crédito, créditos por abonos. |
| **Asiento de cuenta** | Registro inmutable de débito o crédito en una cuenta corriente. |
| **Abono** | Pago parcial o total que se aplica a uno o varios documentos abiertos. |
| **Serie de documento** | Contador correlativo por tipo de comprobante y sucursal. |
| **Período** | Mes contable con estado abierto o cerrado. Un período cerrado rechaza escrituras con fecha dentro de él. |
| **Cierre mensual** | Snapshot inmutable de los totales de un período. |
| **Plantilla de vertical** | Configuración declarativa que especializa el sistema para un rubro. |
| **Atributo dinámico** | Campo definido por el tenant en una categoría, no en el código. |
