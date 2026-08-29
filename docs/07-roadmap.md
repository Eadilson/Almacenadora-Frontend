# 07 — Roadmap de desarrollo

## 1. Criterio de ordenamiento

Las fases no siguen el organigrama del sistema, sino tres reglas:

1. **Primero lo que no se puede añadir después sin reescribir.** Multi-tenant, dinero, kardex append-only e inmutabilidad de documentos son decisiones estructurales: agregarlas en la fase 4 significa migrar todos los datos existentes y reescribir la mitad del código.
2. **Cada fase termina en algo que un cliente real puede usar.** No hay fases que solo produzcan andamiaje invisible.
3. **Lo que valida el negocio antes que lo que lo pule.** Ventas y créditos antes que dashboards bonitos.

La estimación asume **un desarrollador con dedicación completa**. Con dos
personas (una en backend, una en frontend) las fases F1–F3 se comprimen
aproximadamente un 40 %, no un 50 %: la coordinación tiene costo.

---

## F0 · Fundaciones — 2 semanas

> **Estado: completado** (2026-08-01) en backend y frontend. Lint y verificación
> de tipos limpios en ambos proyectos. Detalle en [`README.md`](../README.md) y en
> el del proyecto `Inventario-frontend`.
>
> Los dos proyectos son ahora independientes: `Inventario-backend` (esta API) e
> `Inventario-frontend` (la aplicación web), sin código ni dependencias
> compartidas.

Nada de esto es funcionalidad de negocio, y es exactamente por eso que debe
existir antes: es el suelo sobre el que se apoya todo lo demás.

**Backend**
- Repositorio, estructura de carpetas por capas, ESLint + Prettier + reglas de import por capa
- Configuración validada al arrancar (falla si falta una variable)
- Conexión a MongoDB con replica set, reintentos y apagado ordenado
- `AsyncLocalStorage`: `RequestContext` y `TenantContext`
- Plugins de Mongoose: `tenantScope`, `softDelete`, `auditFields`, `optimisticLock`
- `BaseRepository` con filtrado por tenant obligatorio y `UnitOfWork`
- Jerarquía de errores + middleware central RFC 7807
- Winston + Morgan integrados, con `requestId` y redacción de datos sensibles
- Value objects `Money`, `Quantity`, `Percentage` **con pruebas exhaustivas de casos límite**
- Contenedor de dependencias
- Helmet, CORS, límite de tasa, sanitización, límite de carga
- Healthchecks y `/version`
- Runner de migraciones y semillas
- Pipeline de CI: lint, pruebas, cobertura, regla de dependencias, `npm audit`

**Frontend**
- Vite + React + Tailwind + shadcn/ui inicializados
- Cliente Axios con interceptores, refresh automático y `requestId`
- QueryClient con política de reintentos y caché
- Layouts, tema claro/oscuro, `ErrorBoundary`, sistema de notificaciones
- `DataTable` genérico con paginación, ordenamiento y filtros
- Componentes de formulario base + `MoneyInput` y `QuantityInput`

**Criterio de salida**
- [x] `GET /health/ready` distingue proceso vivo de dependencias listas y responde 503 sin base de datos
- [x] Las pruebas de aislamiento fallan si se elimina el plugin de tenant (verificado con una prueba negativa explícita)
- [x] `Money` pasa pruebas de redondeo, reparto y mezcla de monedas (132 pruebas de aritmética)
- [x] La regla de dependencias rompe el build si el dominio importa Mongoose (y el detector se auto-verifica)
- [x] Andamiaje del frontend: Vite + React + Tailwind, cliente Axios con refresco compartido, `DataTable`, componentes base, tema claro/oscuro y sistema de avisos

> Sin F0, cada fase siguiente reimplementa lo mismo de forma inconsistente. Es
> la inversión que se paga a partir de F2.

---

## F1 · MVP operativo — 6 semanas

**Objetivo:** un negocio real puede reemplazar su cuaderno. Comprar, tener
inventario correcto y vender al contado con comprobante.

> **En curso.** Identidad y plantillas de vertical están terminadas y verificadas
> contra MongoDB real: alta de empresa por línea de comandos, inicio de sesión,
> renovación rotativa con detección de reutilización, cierre de sesión local y en
> todos los dispositivos, perfil, 44 permisos granulares y 7 roles sembrados como
> datos editables. Falta la recuperación de contraseña y la gestión de usuarios
> desde la interfaz.

**Módulos**
1. **Identidad** ✔: alta de empresa (por línea de comandos; autoservicio en F5), login, refresh, cierre de sesión, perfil, roles y permisos, sucursales. Pendiente: recuperación de contraseña e invitaciones
2. **Configuración**: datos fiscales, moneda, zona horaria, impuestos, series de documento, método de costeo — *sembrados por la plantilla; falta la pantalla de edición*
3. **Plantillas de vertical** ✔: motor de aplicación con herencia de la genérica + plantillas `jewelry` y `generic`
4. **Catálogo** ← *siguiente*: categorías con atributos dinámicos, unidades, productos, imágenes, búsqueda, código de barras
5. **Inventario**: existencias por sucursal, kardex, saldo inicial, ajustes, pérdidas, alerta de mínimos
6. **Compras**: proveedores, órdenes, recepción, actualización de costo e inventario
7. **Ventas al contado**: clientes, POS, descuentos, factura numerada, PDF
8. **Períodos**: creación automática de períodos y validación de escritura

**Frontend:** login, panel con navegación por permisos, CRUD de catálogo con
formulario dinámico, consulta de inventario y kardex, flujo de compra, pantalla
de POS, listado de ventas, configuración.

**Criterio de salida (verificable, no declarativo)**
- Un negocio piloto opera una semana completa sin intervención técnica
- Kardex y existencias cuadran al 100 % tras 500 movimientos
- 100 emisiones concurrentes de factura → 100 números correlativos sin huecos ni duplicados
- Dos ventas simultáneas de la última unidad → una confirma, la otra recibe `INSUFFICIENT_STOCK`
- Las pruebas de aislamiento cubren todos los repositorios existentes
- Crear una empresa con la plantilla `hardware` produce un sistema coherente sin campos de joyería

**Riesgo principal:** subestimar los atributos dinámicos. Es el mecanismo del
que dependen catálogo, formularios, filtros, validación e importación. Se
construye completo en F1, no "provisional".

---

## F2 · Crédito, cartera y correcciones — 4 semanas

**Objetivo:** el sistema maneja dinero que el cliente aún debe. Aquí está el
mayor dolor del negocio y el mayor valor comercial del producto.

1. ✅ **Ventas al crédito**: política de crédito, límite, validación de mora, plazo, pago mixto
2. ✅ **Cuenta corriente**: asientos append-only, saldo proyectado, estado de cuenta con saldo por movimiento — *falta el PDF*
3. ✅ **Abonos**: registro, aplicación FIFO y manual, saldo a favor, anulación con contra-asiento — *falta el recibo en PDF*
4. ✅ **Antigüedad de saldos**: tramos, bloqueo manual y por mora, cartera de vencidos
5. **Anulaciones y devoluciones**: ✅ anulación de venta al crédito con reversión de inventario y de deuda; faltan la devolución parcial, la devolución a proveedor y la corrección de kardex
6. **Variantes y series**: variantes por ejes de atributos, unidades serializadas (pieza única), traslados entre sucursales
7. **Listas de precio**: vigencia, segmentos, precio calculado por fórmula
8. ✅ **Roles personalizados**: creación y edición de roles por el tenant, con catálogo de permisos y regla anti-escalada
9. ✅ **Costos adicionales de compra**: distribución por valor, cantidad o peso *(adelantado en F1)*

**Criterio de salida**
- El escenario completo de [HU-03](05-casos-de-uso-e-historias.md#hu-03--deuda-consolidada-y-abono-que-reduce-el-saldo--uc-cr-02--f2) pasa íntegro, incluida la anulación
- El job de reconciliación reporta diferencia 0 entre saldos proyectados y asientos, tras 1.000 operaciones aleatorias
- Ninguna anulación modifica o elimina un documento original
- Una pieza serializada no puede venderse dos veces bajo concurrencia

**Riesgo principal:** la aplicación de abonos es la lógica más sutil del
sistema (parciales, excedentes, anulaciones, orden de aplicación). Se
desarrolla con pruebas basadas en propiedades sobre secuencias aleatorias de
ventas, abonos y anulaciones, verificando que el saldo siempre sea reconstruible.

---

## F3 · Reportes, análisis y exportación — 3 semanas

1. ✅ **Dashboard**: indicadores del período, series de ventas, ranking y alertas — *se calcula por agregación; la proyección `dashboard_daily` por eventos queda para cuando el volumen la exija*
2. ✅ **Reportes**: ventas, inventario valorizado, utilidad, rotación, clientes y compras — *el kardex ya existía en inventario; falta el detalle de cartera como reporte propio*
3. **Exportación**: ✅ Excel con ExcelJS, síncrona; falta el PDF y la variante asíncrona con `JobQueue`
4. ✅ **Autorización de campos financieros** en reportes y exportaciones, verificada por prueba
5. **Importación de catálogo** desde Excel con validación previa e informe de errores por fila
6. **Actualización masiva de precios**
7. **Conteo físico** de inventario con aplicación de diferencias
8. **Cotizaciones** y conversión a venta
9. **Notificaciones**: alerta de mínimos, correo de factura, recordatorio de pago
10. **Sistema de trabajos asíncronos** con estado y descarga firmada

**Criterio de salida**
- Reporte de 100.000 movimientos exportado sin degradar la latencia de otros usuarios
- Todo reporte con rango de un año responde en menos de 3 s con datos de 50.000 SKU
- Los reportes financieros no emiten costos a roles sin permiso (verificado por prueba, no por inspección visual)

---

## F4 · Cierre, auditoría y control — 3 semanas

1. **Períodos contables**: estado, cierre con snapshot y checksum, reapertura auditada, bloqueo de escrituras retroactivas
2. **Reporte de cierre mensual** completo y su PDF
3. **Auditoría**: decorador sobre casos de uso, bitácora consultable, historial por registro, exportación
4. **Lotes y vencimientos** con alertas (habilita la vertical de farmacia)
5. **Etiquetas con código de barras** imprimibles
6. **Cuentas por pagar a proveedores** (contraparte de la cartera de clientes)
7. **Castigo de incobrables**
8. **Comparación de precios de compra** entre proveedores
9. **Job de reconciliación** de existencias y saldos, con alerta ante divergencias

**Criterio de salida**
- Un período cerrado rechaza toda escritura retroactiva por cualquier vía
- Los totales de un cierre publicado no cambian tras modificar costos posteriores
- La bitácora registra el 100 % de las acciones catalogadas como `HIGH`/`CRITICAL`
- La reconciliación se ejecuta a diario y reporta

---

## F5 · Producto vendible como SaaS — 4 semanas

Esta fase no agrega funciones de negocio: **convierte un sistema en un
producto**. Sin ella, cada venta requiere trabajo manual del equipo técnico y el
negocio no escala.

1. **Onboarding autoservicio**: registro de empresa, selección de plantilla de vertical, asistente de configuración inicial, datos de demostración opcionales
2. **Planes y suscripciones**: definición de planes, límites efectivos, verificación de capacidades y de cuotas (usuarios, sucursales, SKU)
3. **Panel de super-admin**: empresas, suscripciones, métricas del producto, soporte
4. **Impersonación auditada** con consentimiento del tenant
5. **White-label**: logo, colores, pie de documentos, dominio propio
6. **Plantillas adicionales**: `hardware`, `boutique`, `pharmacy`
7. **2FA (TOTP)** y políticas de seguridad por tenant
8. **Cadena de hashes** en la bitácora de auditoría
9. **Internacionalización** de la interfaz y formatos por locale
10. **Documentación**: manual de usuario por rol, guía de puesta en marcha, `/docs` con OpenAPI publicado
11. **Observabilidad de producción**: métricas, alertas, seguimiento de errores, tablero operativo

**Criterio de salida**
- Un cliente nuevo se da de alta, configura su empresa y registra su primera venta **sin contacto con el equipo técnico**
- Un tenant en plan Básico no puede acceder a créditos por ninguna vía (UI, API directa, exportación)
- Los límites del plan se aplican en el servidor y devuelven un error claro y accionable

---

## F6 · Expansión — continuo

Priorizado por demanda real de clientes, no por atractivo técnico.

| Iniciativa | Valor | Costo | Nota |
|---|---|---|---|
| **Facturación electrónica** por país | Alto (a veces obligatorio) | Alto | Tras el puerto `EInvoicingProvider`, un adaptador por país. No contamina el dominio |
| **POS con funcionamiento sin conexión** | Alto en zonas con mala conectividad | Muy alto | Requiere resolución de conflictos y numeración local. Diseñar antes de prometer |
| **Aplicación móvil** (consulta y cobro en ruta) | Medio-alto | Medio | Sobre la misma API |
| **Grupos multi-empresa** y consolidación | Medio (Enterprise) | Medio | Modelo ya preparado en F0 |
| **API pública y webhooks** | Medio | Medio | Habilita integraciones e integradores como canal de venta |
| **Portal del cliente** (ver su estado de cuenta y pagar) | Medio | Medio | Reduce llamadas de cobranza |
| **Pasarela de pagos** | Medio | Medio | Cobro de abonos en línea |
| **Módulo de producción** (piezas a medida, reparaciones) | Medio (joyería, talleres) | Alto | Nueva vertical con explosión de materiales |
| **Intereses por mora y refinanciamiento** | Medio | Medio | Depende de la legislación local |
| **Integración contable** (exportación a software del contador) | Medio | Bajo | Alta relación valor/costo |
| **Recomendación de reposición** | Medio | Medio | Sobre el histórico de rotación |
| **Base dedicada por tenant** | Bajo hasta el primer cliente grande | Medio | `TenantConnectionProvider` ya previsto |

---

## 2. Resumen de cronograma

```
Semana:  1   3   5   7   9   11  13  15  17  19  21  23
F0      ██
F1          ████████████
F2                      ████████
F3                              ██████
F4                                    ██████
F5                                          ████████
                                                    → F6 continuo

Hitos:
  S2   ─ Fundaciones listas
  S8   ─ MVP: comprar, inventariar y vender al contado   ← primer cliente piloto
  S12  ─ Créditos y cartera completos                    ← producto competitivo
  S15  ─ Reportes y exportación                          ← argumento de venta
  S18  ─ Cierre y auditoría                              ← apto para contadores
  S22  ─ Producto SaaS vendible sin intervención técnica
```

**Total hasta producto vendible: ~22 semanas (5,5 meses)** con un desarrollador
a tiempo completo; **~14 semanas** con dos personas.

## 3. Riesgos y mitigaciones

| Riesgo | Impacto | Prob. | Mitigación |
|---|---|---|---|
| Fuga de datos entre empresas | Crítico | Media | Aislamiento en 3 capas + suite bloqueante en CI ([04 §2](04-multitenant-seguridad-auditoria.md#2-aislamiento-en-tres-capas)) |
| Descuadre entre inventario y kardex | Alto | Media | Transacciones, actualización condicional atómica, job de reconciliación diario |
| Errores de centavos en cartera | Alto | Alta si se usa `Number` | `Money` en enteros desde F0; prohibido el punto flotante |
| Números de factura duplicados | Alto | Alta sin `$inc` | Contador atómico; prueba de concurrencia en F1 |
| Ventas duplicadas por reintento | Alto | Alta en móvil | `Idempotency-Key` obligatoria desde F1 |
| Alcance creciente durante el MVP | Alto | **Muy alta** | Alcance de F1 congelado; toda solicitud nueva va al backlog de F2+ |
| Atributos dinámicos resueltos a medias | Alto | Media | Se construyen completos en F1; sin condicionales por rubro en el código |
| Rendimiento con 500 tenants | Medio | Media | `tenantId` primero en todo índice; pruebas de carga en F3; proyecciones para el dashboard |
| Cliente piloto pide algo específico de joyería | Medio | **Alta** | Se resuelve como atributo, plantilla o configuración; si exige código específico, se rechaza o se modela como capacidad genérica |
| Complejidad fiscal por país | Medio | Alta | Perfil fiscal configurable; facturación electrónica aislada tras un puerto |
| Migraciones en producción | Medio | Media | Migraciones en dos fases, siempre hacia adelante, probadas sobre copia real |
| Dependencia de una sola persona | Alto | Media | Documentación de decisiones (estos documentos), pruebas como especificación ejecutable, ADRs |

## 4. Definición de "terminado"

Una funcionalidad no está terminada hasta que cumple **todos** los puntos:

- [ ] Casos de uso implementados con pruebas unitarias del dominio
- [ ] Pruebas de integración de los repositorios involucrados
- [ ] Prueba de aislamiento multi-tenant para cada repositorio nuevo
- [ ] Prueba e2e del flujo principal y de al menos un caso de error
- [ ] Validación en las cuatro capas ([04 §5](04-multitenant-seguridad-auditoria.md#5-validación-en-capas))
- [ ] Permisos aplicados y verificados por prueba (incluida la denegación)
- [ ] Errores con `code` estable y registrado en el catálogo
- [ ] Auditoría en las acciones sensibles
- [ ] OpenAPI actualizado y validado contra las respuestas reales
- [ ] Interfaz responsive, con estados de carga, vacío y error
- [ ] Sin condicionales por rubro en el código
- [ ] Índices creados para toda consulta nueva, verificados con `explain()`
- [ ] Sin advertencias de lint ni caída de cobertura
- [ ] Migración escrita y probada, si aplica

## 5. Lo que no se hará "después"

Decisiones que deben estar desde el primer día porque su costo de introducción
crece de forma no lineal:

| Decisión | Costo si se posterga |
|---|---|
| `tenantId` en toda colección e índice | Migrar todos los datos y reindexar en producción |
| Dinero en enteros | Reprocesar todo el histórico financiero con errores acumulados irreparables |
| Kardex append-only | El historial anterior no es reconstruible: se pierde para siempre |
| Documentos financieros inmutables | Los cierres publicados dejan de ser confiables retroactivamente |
| Atributos dinámicos | Reescribir catálogo, formularios, filtros, validación e importación |
| Auditoría de acciones sensibles | Los hechos no registrados no se recuperan |
| Contexto de tenant implícito | Revisar cada consulta del sistema, una por una |
| Idempotencia en mutaciones financieras | Datos duplicados en producción, difíciles de distinguir de operaciones legítimas |
