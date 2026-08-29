# Inventra — Sistema de Gestión Comercial Multiempresa

> **Documentación de diseño (fase previa a implementación).**
> Ningún archivo de este directorio contiene código de producción: son las
> decisiones de arquitectura que gobiernan el desarrollo posterior.

## Qué es

Plataforma web **multiempresa (multi-tenant)** para administrar la operación
comercial completa de una PyME de retail o distribución: catálogo e inventario
con trazabilidad, compras, proveedores, clientes, ventas al contado y al
crédito, cuenta corriente y abonos, facturación, reportes, cierre de período,
auditoría y configuración.

**No es un sistema para un rubro concreto.** El producto es horizontal y se
especializa por configuración mediante *plantillas de vertical* (joyería,
farmacia, ferretería, boutique, repuestos, ...). Ver
[00-vision-y-alcance.md](00-vision-y-alcance.md#3-estrategia-de-verticales).

> `Inventra` es un nombre de trabajo. El producto soporta *white-label*
> (marca, logo, colores y dominio por empresa), por lo que la marca comercial
> final no está acoplada al código. Ver
> [00-vision-y-alcance.md](00-vision-y-alcance.md#2-identidad-del-producto).

## Índice de documentos

| # | Documento | Contenido |
|---|-----------|-----------|
| 00 | [Visión y alcance](00-vision-y-alcance.md) | Producto, mercado, estrategia de verticales, ediciones comercializables, alcance por fase, glosario |
| 01 | [Arquitectura](01-arquitectura.md) | Clean Architecture, capas y dependencias, estructura de carpetas, inyección de dependencias, errores, logging, transacciones, ADRs |
| 02 | [Modelo de dominio](02-modelo-de-dominio.md) | Bounded contexts, agregados, entidades, invariantes, eventos de dominio, reglas de negocio |
| 03 | [Modelo de datos MongoDB](03-modelo-de-datos-mongodb.md) | Colecciones, esquemas, índices, estrategia de embedding vs referencia, dinero y decimales, atributos dinámicos |
| 04 | [Multi-tenant, seguridad y auditoría](04-multitenant-seguridad-auditoria.md) | Aislamiento en 3 capas, JWT y sesiones, RBAC granular, auditoría append-only, hardening |
| 05 | [Casos de uso e historias de usuario](05-casos-de-uso-e-historias.md) | Catálogo de casos de uso, historias con criterios de aceptación, matriz rol × permiso |
| 06 | [API REST](06-api-rest.md) | Convenciones, contrato de endpoints por módulo, paginación, errores RFC 7807, idempotencia, versionado |
| 07 | [Roadmap](07-roadmap.md) | Fases F0–F6, definición de MVP, criterios de salida, riesgos, estimación |

## Estado del desarrollo

El sistema son **dos proyectos independientes** que solo se comunican por HTTP:
`Inventario-backend` (esta API) e `Inventario-frontend` (la aplicación web).

| Fase | Estado |
|---|---|
| **F0 — Fundaciones** | **Completado** en ambos proyectos: aritmética monetaria exacta, aislamiento multi-tenant en tres capas, manejo central de errores, logging con redacción, endurecimiento HTTP; y en el frontend cliente Axios con refresco compartido, tema, `DataTable` y componentes base. |
| **F1 — MVP operativo** | **En curso.** Identidad y plantillas de vertical terminadas y verificadas contra MongoDB real: sesión completa, 44 permisos, 7 roles como datos editables. Siguiente: catálogo con atributos dinámicos. |
| F2 y posteriores | Pendiente |

Verificación al 2026-08-01: backend con 288 pruebas verdes (unitarias, de
arquitectura, de aislamiento y de extremo a extremo), frontend con 23; lint y
verificación de tipos limpios en los dos.

Lenguaje decidido: **JavaScript** (ESM) con JSDoc verificado y Zod en las
fronteras — ver [ADR-012](01-arquitectura.md#adr-012-javascript-con-jsdoc-y-validación-en-tiempo-de-ejecución).

## Orden de lectura recomendado

```
00 (qué y para quién)
 └─> 01 (cómo se estructura)
      └─> 02 (qué reglas gobiernan el negocio)
           └─> 03 (cómo persiste) + 04 (cómo se aísla y protege)
                └─> 05 (qué hace el usuario) ─> 06 (cómo se expone) ─> 07 (en qué orden se construye)
```

## Principios no negociables

1. **El dominio no depende de nada.** Ni de Express, ni de Mongoose, ni de HTTP.
2. **Un tenant nunca ve datos de otro.** Garantizado en tres capas independientes.
3. **Los documentos financieros son inmutables.** Se anulan o se compensan, no se editan ni se borran.
4. **El inventario solo cambia por movimientos registrados.** No hay escritura directa de existencias.
5. **Nada específico de un rubro vive en el código.** Vive en configuración del tenant.
6. **El dinero nunca es `Number` de punto flotante.**
7. **Toda acción sensible queda auditada** con actor, momento y diferencia aplicada.
