# 04 — Multi-tenant, seguridad y auditoría

## 1. El riesgo central del producto

Con base compartida ([ADR-004](01-arquitectura.md#adr-004-base-compartida-con-discriminador-tenantid)),
**una sola consulta sin filtro de tenant expone los datos de otra empresa**. En
un sistema que vende a competidores del mismo rubro en la misma ciudad, esa
fuga no es un defecto técnico: es el fin del producto.

Por eso el aislamiento no se confía a la disciplina del programador. Se
implementa en **tres capas independientes**, de modo que un olvido en una sea
detenido por otra.

## 2. Aislamiento en tres capas

### Capa 1 — Contexto implícito (`AsyncLocalStorage`)

El `tenantId` **no se pasa como parámetro** por la cadena de llamadas: viaja en
el contexto de ejecución de la petición.

```js
// interfaces/http/middlewares/tenantContext.js  (concepto)
export const tenantContext = (req, res, next) => {
  const { tenantId, userId, permissions, branchIds, features } = req.auth;
  tenantStore.run(
    { tenantId, userId, permissions, branchIds, features, requestId: req.id },
    next
  );
};
```

Por qué así y no por parámetro: con un `tenantId` explícito en cada firma, basta
una función que olvide propagarlo —o un valor tomado del cuerpo de la
petición— para abrir la fuga. Con contexto implícito, el valor **solo** puede
provenir del token verificado, y ningún punto del código puede sustituirlo.

**Regla absoluta:** el `tenantId` se lee del token. Nunca del cuerpo, de la
*query string*, de un encabezado ni de un parámetro de ruta. Si una petición
incluye `tenantId`, se ignora; si contradice al del token, se registra como
intento de acceso indebido.

### Capa 2 — Repositorio base

Ningún caso de uso accede a un modelo de Mongoose directamente. Todo pasa por
un repositorio que obtiene el tenant del contexto y falla si no existe.

```js
class BaseRepository {
  #scoped(filter = {}) {
    const { tenantId } = tenantStore.get() ?? {};
    if (!tenantId) throw new InvariantViolation('MISSING_TENANT_CONTEXT');  // falla cerrado
    return { ...filter, tenantId, deletedAt: null };
  }
  findOne(filter, opts)  { return this.model.findOne(this.#scoped(filter), null, opts); }
  updateOne(filter, upd) { return this.model.updateOne(this.#scoped(filter), upd); }
  // ... toda operación pasa por #scoped
}
```

`MISSING_TENANT_CONTEXT` es un error de programación, no de usuario: responde
500, se registra con severidad crítica y hace fallar las pruebas. **Falla
cerrado**: la ausencia de contexto nunca se interpreta como "consultar todo".

Las operaciones legítimamente globales (jobs de plataforma, reportes agregados
del super-admin) usan un repositorio distinto y explícito
(`PlatformRepository`), con permiso de plataforma requerido. Que sea *otra
clase* hace visible la excepción en revisión de código.

### Capa 3 — Plugin global de Mongoose (defensa en profundidad)

Si alguien accede al modelo sin repositorio, el plugin lo detiene.

```js
// infrastructure/database/mongoose/plugins/tenantScope.js  (concepto)
export function tenantScope(schema) {
  schema.add({ tenantId: { type: ObjectId, required: true, index: true } });

  const READ_HOOKS = ['find','findOne','findOneAndUpdate','findOneAndDelete',
                      'count','countDocuments','updateOne','updateMany',
                      'deleteOne','deleteMany','distinct'];

  schema.pre(READ_HOOKS, function () {
    if (this.getOptions()?.skipTenantScope) return;       // requiere opt-in explícito y auditado
    const { tenantId } = tenantStore.get() ?? {};
    if (!tenantId) throw new Error('MISSING_TENANT_CONTEXT');
    this.where({ tenantId });
  });

  schema.pre('save', function () {
    const { tenantId } = tenantStore.get() ?? {};
    if (this.isNew) this.tenantId ??= tenantId;
    if (String(this.tenantId) !== String(tenantId)) throw new Error('TENANT_MISMATCH');
  });

  schema.pre('aggregate', function () {
    const { tenantId } = tenantStore.get() ?? {};
    this.pipeline().unshift({ $match: { tenantId } });      // fuerza el filtro como primera etapa
  });
}
```

Notas de implementación importantes:

- `aggregate` es el hueco que casi todos los sistemas multi-tenant olvidan: los reportes son agregaciones y ahí es donde ocurre la fuga silenciosa.
- El `$match` insertado al inicio del pipeline además **mejora** el rendimiento: filtra por índice antes de cualquier `$unwind` o `$lookup`.
- Los `$lookup` a otras colecciones deben incluir su propio filtro por tenant en el sub-pipeline: el plugin no puede alcanzarlos. Verificado por prueba de aislamiento.
- `skipTenantScope` existe solo para el `PlatformRepository` y su uso está limitado por lint a esa carpeta.

### Capa 4 (verificación) — Pruebas de aislamiento obligatorias en CI

```js
// tests/isolation/<recurso>.isolation.test.js  (patrón aplicado a TODO repositorio)
describe.each(REPOSITORIES)('aislamiento: %s', (Repo) => {
  it('no lee, no actualiza y no borra registros de otro tenant', async () => {
    const a = await seedTenant(); const b = await seedTenant();
    const rec = await runAs(b, () => Repo.create(validPayload()));

    await runAs(a, async () => {
      expect(await Repo.findById(rec.id)).toBeNull();
      expect(await Repo.list({})).toHaveLength(0);
      expect((await Repo.updateOne({ _id: rec.id }, { name: 'x' })).matchedCount).toBe(0);
      expect((await Repo.deleteOne({ _id: rec.id })).deletedCount).toBe(0);
      expect(await Repo.aggregateTotals()).toEqual(emptyTotals());
    });
  });

  it('falla si no hay contexto de tenant', async () => {
    await expect(Repo.list({})).rejects.toThrow('MISSING_TENANT_CONTEXT');
  });
});
```

Esta suite es **bloqueante**: sin ella verde, no hay despliegue. Es la única
garantía sostenible cuando el equipo crezca.

## 3. Autenticación

### 3.1 Esquema de tokens

| Token | Formato | Vida | Dónde vive | Contenido |
|---|---|---|---|---|
| **Access** | JWT firmado (HS256; RS256 si hay múltiples servicios) | 15 min | Memoria del cliente | `sub`, `tenantId`, `roleId`, `permissions[]`, `branchIds[]`, `features[]`, `jti`, `iat`, `exp` |
| **Refresh** | Cadena opaca aleatoria (256 bits) | 7 d (30 d con "recordarme") | Cookie `httpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/v1/auth` | Solo el hash SHA-256 se guarda en `refresh_tokens` |

Decisiones y su razón:

- **Access token corto** porque un JWT no se puede revocar: es la contraparte necesaria de no consultar la base en cada petición.
- **Refresh en cookie `httpOnly`**, no en `localStorage`: un XSS puede leer `localStorage` completo, pero no una cookie `httpOnly`. Es la diferencia entre una vulnerabilidad y una toma total de cuentas.
- **Permisos dentro del access token** para evitar una consulta por petición; el costo es hasta 15 minutos de retardo al cambiar permisos. Se mitiga con una lista de revocación por `jti` en caché para cambios sensibles (despido, cambio de rol crítico), consultada solo si la caché indica que el usuario tiene una revocación pendiente.
- **Rotación con detección de reutilización**: cada refresh emite uno nuevo e invalida el anterior. Si llega un refresh ya usado, se asume robo: se revoca **toda** la familia de sesiones del usuario y se notifica. Es la defensa estándar contra robo de refresh token.

### 3.2 Contraseñas

- Bcrypt, coste 12 (revisable). Nunca MD5/SHA para contraseñas.
- Política mínima: 8 caracteres, verificación contra lista de contraseñas filtradas comunes. No se exige rotación periódica forzada (fomenta contraseñas predecibles y notas adhesivas).
- Restablecimiento con token de un solo uso, 30 min de vigencia, invalidado al usarse, y **respuesta idéntica** exista o no el correo (evita enumeración de usuarios).
- El hash nunca sale del backend, ni en logs ni en respuestas. `select: false` en el esquema.

### 3.3 Defensas de acceso

| Amenaza | Defensa |
|---|---|
| Fuerza bruta | Límite por IP + por cuenta; bloqueo progresivo (1 min → 5 → 15) tras 5 intentos; CAPTCHA tras el bloqueo |
| Enumeración de usuarios | Mensaje y tiempo de respuesta uniformes en login y recuperación |
| Robo de sesión | Rotación de refresh, huella de dispositivo, alerta por IP nueva, cierre remoto de sesiones |
| Escalada de privilegios | Un usuario no puede asignarse permisos que no posee ni editar su propio rol |
| Escalada horizontal (IDOR) | Todo acceso pasa por el filtro de tenant; recurso ajeno responde 404 |
| Robo de credenciales de servicio | Secretos en gestor de secretos, no en `.env` de producción; rotación documentada |

### 3.4 Autenticación de dos factores (F5)

TOTP opcional, obligatorio para roles con permisos financieros si el tenant lo
activa. Códigos de recuperación de un solo uso. Diseñado desde ya en el modelo
de `users` (`mfa: { enabled, secret, backupCodes[] }`) para no migrar después.

## 4. Autorización: RBAC con permisos granulares

### 4.1 Estructura

El código pregunta por **permisos**, nunca por roles
([ADR-010](01-arquitectura.md#adr-010-rbac-con-permisos-granulares-no-roles-cableados)).

```
Permiso = "<recurso>:<acción>"

recursos: products, categories, stock, purchases, suppliers, customers,
          sales, credit, payments, invoices, reports, audit, users, roles,
          branches, settings, periods
acciones: read, create, update, delete, void, approve, export, adjust,
          reopen, manage
```

### 4.2 Catálogo de permisos

| Permiso | Habilita |
|---|---|
| `products:read` / `create` / `update` / `delete` | Catálogo |
| `products:cost:read` | **Ver costos y márgenes** (separado a propósito: un vendedor no debe verlos) |
| `stock:read` / `adjust` / `transfer` / `count` | Inventario. `adjust` es de alto riesgo |
| `purchases:read` / `create` / `approve` / `receive` / `void` | Compras |
| `sales:read` / `create` / `void` / `return` / `discount:override` | Ventas. `discount:override` permite superar el descuento máximo |
| `sales:credit` | Vender a crédito |
| `credit:read` / `limit:manage` / `writeoff` | Cartera. `writeoff` (incobrable) restringido |
| `payments:read` / `create` / `void` | Abonos |
| `invoices:read` / `issue` / `void` | Facturación |
| `reports:read` / `export` / `financial:read` | Reportes; `financial:read` para utilidades |
| `audit:read` | Consultar auditoría |
| `users:read` / `invite` / `update` / `deactivate` | Usuarios |
| `roles:manage` | Roles y permisos |
| `settings:manage` | Configuración de la empresa |
| `periods:close` / `periods:reopen` | Cierre mensual. `reopen` solo propietario |

### 4.3 Roles predefinidos (plantilla; cada tenant los edita)

| Rol | Alcance |
|---|---|
| `OWNER` | Todo, incluido `periods:reopen`, `roles:manage`, `settings:manage` |
| `MANAGER` | Operación completa y reportes financieros; sin reabrir períodos ni gestionar roles |
| `SELLER` | Ventas, clientes, consulta de catálogo **sin costos**; sin anular ni ajustar inventario |
| `CASHIER` | Ventas al contado y cobro de abonos; sin crédito ni anulaciones |
| `WAREHOUSE` | Inventario, recepciones, conteos, traslados; sin precios ni ventas |
| `ACCOUNTANT` | Lectura completa, reportes, exportación, cierre de períodos; sin operar |
| `AUDITOR` | Solo lectura, incluida auditoría; ninguna escritura |

### 4.4 Aplicación

```js
router.post('/sales',
  authenticate,                       // 401 si el token falta o es inválido
  tenantContext,                      // establece el contexto de ejecución
  requirePermission('sales:create'),  // 403
  requireFeature('CREDIT_SALES'),     // 403 si el plan no lo incluye (solo si type=CREDIT)
  requireBranchAccess(),              // 403 si la sucursal no está asignada al usuario
  validate(createSaleSchema),         // 422
  idempotency(),                      // 409 en reuso divergente
  asyncHandler(saleController.create)
);
```

Cuatro reglas de autorización:

1. **Denegar por defecto.** Una ruta sin `requirePermission` explícito es rechazada por una prueba automatizada que recorre el árbol de rutas. Olvidar el guard no debe traducirse en acceso abierto.
2. **Alcance por sucursal.** Un usuario de una sucursal no ve las ventas ni las existencias de otra, salvo permiso multi-sucursal.
3. **Autorización de campos.** Sin `products:cost:read`, el *presenter* omite `cost`, `margin` y `grossProfit`. No basta con ocultarlos en la UI: la API no debe emitirlos.
4. **La UI no autoriza.** Ocultar un botón mejora la experiencia; la decisión vive en el servidor.

### 4.5 Super-admin de plataforma

Usuario fuera de todo tenant, en `platform_users`, para administrar
suscripciones y dar soporte. Reglas:

- Autenticación separada, 2FA **obligatorio**, dominio/ruta administrativa distinta.
- No puede leer datos de negocio de un tenant salvo mediante **impersonación** con: consentimiento registrado del tenant, motivo obligatorio, duración limitada, sesión marcada y **auditoría visible para el propio cliente**.
- Toda acción de plataforma se registra en `platform_audit_logs`.

Esto es requisito de venta: los clientes preguntan quién puede ver sus datos, y
la respuesta debe ser demostrable.

## 5. Validación en capas

Cuatro niveles, cada uno con un propósito distinto (no es redundancia):

| Nivel | Herramienta | Valida | Propósito |
|---|---|---|---|
| Frontend | Zod + React Hook Form | Forma, obligatorios, formatos, reglas simples | Experiencia inmediata. **No es seguridad** |
| API | Zod en `interfaces/http/validators` | Tipos, rangos, longitudes, enumeraciones, `strict()` | Rechazar entrada malformada antes de tocar el dominio |
| Dominio | Entidades y value objects | Invariantes de negocio | Garantizar que no exista estado inválido |
| Base de datos | Esquema + índices únicos + `$jsonSchema` | Integridad estructural | Última línea; captura escrituras fuera de la aplicación |

Los esquemas Zod de atributos dinámicos se **generan** desde las
`AttributeDefinition` de la categoría, de modo que frontend y backend validan
contra la misma fuente y no pueden divergir.

`strict()` en todos los esquemas de entrada: un campo desconocido se rechaza en
lugar de ignorarse silenciosamente. Esto neutraliza la asignación masiva de
propiedades no previstas.

## 6. Auditoría

### 6.1 Qué se audita

**Siempre (severidad `HIGH`/`CRITICAL`):**
- Anulación de venta, factura o abono
- Ajuste de inventario, registro de pérdida y corrección de kardex
- Cambio de precio o de costo
- Modificación de límite de crédito y castigo de deuda incobrable
- Cierre y reapertura de período
- Cambios de usuarios, roles y permisos
- Cambios de configuración de la empresa
- Inicios de sesión fallidos y bloqueos
- Impersonación por soporte
- Exportación masiva de datos

**Registro estándar (`LOW`/`MEDIUM`):** creación y actualización de entidades
maestras y confirmación de documentos.

**No se audita** la lectura ordinaria (volumen inmanejable), salvo la lectura de
reportes financieros y exportaciones, que sí son eventos sensibles.

### 6.2 Cómo se implementa

Decorador sobre los casos de uso, **no** hooks de Mongoose ni Change Streams:

```js
// application/decorators/AuditedUseCase.js  (concepto)
class AuditedUseCase {
  constructor(inner, auditService, spec) { /* spec: action, entityType, severity, redact[] */ }
  async execute(cmd, ctx) {
    const before = this.spec.captureBefore ? await this.spec.captureBefore(cmd) : null;
    const result = await this.inner.execute(cmd, ctx);
    await this.audit.record({                    // fuera de la transacción de negocio
      action: this.spec.action,
      entity: this.spec.entityOf(result),
      changes: diff(before, this.spec.captureAfter?.(result), this.spec.redact),
      actor: ctx.actor, metadata: { reason: cmd.reason, requestId: ctx.requestId },
      severity: this.spec.severity,
    });
    return result;
  }
}
```

Por qué en la capa de aplicación:

- Registra la **intención de negocio** (`sale.void` con su motivo), no el hecho técnico (`update on sales`). Un log que dice "se actualizó el campo status" es inútil para investigar un faltante.
- Conoce al actor, el motivo y el `requestId` sin propagar el contexto HTTP hasta la base.
- Un fallo de auditoría no revierte la operación de negocio, pero se registra con severidad crítica y se alerta (una auditoría que falla en silencio es peor que no tenerla).

### 6.3 Garantías

1. **Append-only.** La colección no expone métodos de actualización ni de borrado; el usuario del sistema no tiene permiso `update`/`delete` sobre ella en MongoDB.
2. **Inmutabilidad demostrable** (F5): cadena de hashes por tenant (`hash(n) = sha256(hash(n-1) + payload)`) que permite detectar cualquier alteración retroactiva.
3. **Datos sensibles redactados** antes de persistir (contraseñas, tokens, adjuntos). Se guarda el hecho del cambio, no el valor secreto.
4. **Consultable por el cliente** desde la UI, filtrando por usuario, entidad, acción y rango de fechas — no es un log solo para el equipo técnico. Es, además, argumento de venta.
5. **Retención según el plan**, con eliminación registrada.

## 7. Endurecimiento de la API

| Control | Implementación |
|---|---|
| Encabezados de seguridad | Helmet: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, sin `X-Powered-By` |
| CORS | Lista blanca explícita de orígenes por entorno y por dominio de tenant; `credentials: true`. Nunca `*` |
| Límite de tasa | Global por IP; más estricto en `/auth`; por tenant según plan; por usuario en exportaciones |
| Tamaño de carga | `express.json({ limit: '100kb' })`; imágenes por `multipart` con límite propio |
| Inyección NoSQL | `express-mongo-sanitize` + validación Zod `strict` + prohibición de pasar objetos del cliente como filtros |
| Contaminación de parámetros | `hpp` |
| Subida de archivos | Multer con lista blanca de MIME **verificada por contenido** (no por extensión), límite de tamaño, nombre generado por el servidor, almacenamiento fuera de la raíz web, análisis antivirus en F5 |
| Descargas | URLs firmadas con expiración; nunca ruta directa al archivo |
| Dependencias | `npm audit` y análisis automatizado en CI; actualizaciones de seguridad priorizadas |
| Secretos | Variables validadas al arrancar (falla rápido si falta una); gestor de secretos en producción; `.env` nunca en el repositorio |
| TLS | Obligatorio; HTTP redirigido; HSTS con precarga |
| Detalles de error | Trazas y detalles internos jamás en respuestas de producción |

## 8. Multi-empresa avanzada (Enterprise, F6)

Preparado en el modelo desde el inicio para no migrar después:

- **Grupos de empresas**: `tenantGroups` permite que un usuario pertenezca a varias empresas con un solo acceso y cambie de empresa activa. El `tenantId` sigue siendo único por petición: se cambia mediante `POST /auth/switch-tenant`, que **emite un token nuevo**. Nunca se permite operar con dos tenants en la misma petición.
- **Reportes consolidados de grupo**: pipeline explícito con `$in` sobre los tenants del grupo, mediante `PlatformRepository` y permiso `group:reports:read`.
- **Base dedicada por tenant**: `TenantConnectionProvider` resuelve la conexión según el tenant, permitiendo mover un cliente Enterprise a su propio clúster sin cambiar repositorios ni casos de uso.
