# CLAUDE.md — Workspace raíz: Copilot Seguros

Este archivo da contexto global del workspace a Claude Code. Los detalles técnicos de cada repo están en sus propios CLAUDE.md:
- Backend NestJS → `backend/CLAUDE.md`
- Frontend Next.js → `frontend/CLAUDE.md`

## Documentación de referencia

| Documento | Ubicación | Contenido |
|---|---|---|
| Manual de producto | `docs/` | Qué es la solución, módulos, flujos, escenarios de demo |
| Arquitectura | `docs/` | Capas, diagrama lógico, decisiones de diseño |
| Cómo ejecutar | `README.md` (raíz) | Instalación, variables de entorno, URLs de demo |
| API spec | Runtime: `http://localhost:4000/api-json` | Contratos de endpoints (Swagger/OpenAPI) |

Antes de proponer cambios de API o de consumo en el front, leer el spec en `/api-json`.

## Qué es el producto

**Copilot Seguros** es una consola de trabajo digital para PAS (productores asesores de seguros / agencias argentinas). Concentra en un solo lugar:
- Operación diaria: conversaciones, tareas, aprobaciones
- Cartera: clientes, pólizas, aseguradoras
- Siniestros: ingreso (intake), seguimiento, cierre
- Asistente IA: orquestador de intención + RAG sobre conocimiento propio del PAS

No es un core asegurador ni un sistema de emisión completo. Es la capa de experiencia del productor con piezas preparadas para integraciones futuras.

## Estructura del workspace

```
/
├── backend/          # NestJS 10 — API REST, lógica de negocio
├── frontend/         # Next.js 14 — consola web del productor
├── docs/             # Manual de producto + arquitectura
├── docker-compose.yml
└── README.md         # Instalación y comandos de arranque
```

## Cómo levantar el entorno completo

Ver `README.md` en la raíz para el detalle completo. Resumen rápido:

```bash
docker-compose up -d   # PostgreSQL (5433) + Redis (6380)
cd backend && npm run start:dev   # API en puerto 4000
cd frontend && npm run dev        # Web en puerto 3000
```

## Modelo de datos clave (multi-tenant)

- **Tenant** = una agencia / red de productores. Toda entidad lleva `tenantId` UUID.
- **Aseguradora** = catálogo dentro del tenant (no es un tenant). Un PAS trabaja con N aseguradoras.
- **Póliza** → referencia Cliente + Aseguradora
- **Siniestro** → referencia Póliza (la aseguradora se infiere por ahí)
- **Regla crítica:** nunca mezclar datos entre tenants. El `tenantId` debe propagarse explícitamente en toda operación — no existe contexto global de tenant.

## Contrato Front ↔ Back

| Aspecto | Detalle |
|---|---|
| Base URL | `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000`) |
| Autenticación | JWT Bearer en header `Authorization` |
| Multi-tenant | Header `x-tenant-id` en cada request |
| Formato de error | `{ statusCode, message, error }` |
| Spec completo | `GET http://localhost:4000/api-json` |

El frontend usa `lib/api.ts → apiFetch()` que adjunta automáticamente token y `x-tenant-id` desde sesión. Siempre usar `apiFetch` — nunca `fetch` directo.

La sesión del usuario se guarda en `sessionStorage` bajo la clave `copilot_seguros_session` con estructura `{ accessToken, tenantId, user }`.

## Estado actual del proyecto

**Funcional y demostratable.** El circuito completo (login → cartera → siniestros → asistente) puede recorrerse en una demo de 15-25 minutos con un PAS real.

### Módulos implementados
- Auth (JWT stateless, sin Passport)
- Tenants, Users, Producers
- Customers, Insurers, Policies
- Claims con intake flow (wizard Redis-backed, configurable por tenant)
- Conversations (threads + mensajes, intake automático desde chat)
- Orchestrator (clasificación de intención por keywords en español, sin LLM)
- RAG (pgvector + LangChain, proveedores OpenAI u Ollama)
- ProducerWorkflow (aprobaciones + tareas con SLA)

### Pendiente / deuda técnica conocida
- No hay tests configurados en ninguno de los dos repos (`@nestjs/testing` instalado pero sin scripts)
- JWT guard no está aplicado globalmente — los controllers aceptan `tenantId` desde body/query directamente (riesgo de seguridad a resolver antes de producción)
- El Orchestrator usa lookup de keywords estático, sin llamada LLM real todavía
- No hay WhatsApp Business API integrada aún (el modelo de conversaciones ya lo soporta)

## Visión y roadmap (sin compromiso de fecha)

- Identidad empresarial fuerte (SSO, roles finos, auditoría)
- Integración WhatsApp Business API en Conversations
- APIs por aseguradora (emisión, endosos, sincronización de siniestros)
- Renovaciones automáticas sugeridas desde Policies
- Reporting gerencial sobre base operativa
- LLM real en Orchestrator (reemplazar lookup de keywords)
- Control de versión de documentos en RAG (qué versión de condiciones se citó)

## Convenciones globales

- El idioma del negocio es **español rioplatense** (Argentina). Términos como "productor", "PAS", "siniestro", "póliza", "asegurado" son correctos y esperados.
- El idioma del código es **inglés** (nombres de variables, funciones, clases, comentarios en código).
- La documentación de producto (docs/, READMEs) está en español.
- Al sugerir nuevas features, considerar siempre el impacto en multi-tenancy.
- Al modificar endpoints, verificar contra el spec Swagger antes de cambiar el consumo en frontend.
