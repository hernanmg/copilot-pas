# Copilot Seguros — consola del productor (demo)

Aplicación para que un **PAS** (productor / agencia) pruebe flujos de **inbox**, **siniestros**, **pólizas**, **tareas**, **clientes**, **aseguradoras** y **RAG**, con backend NestJS y frontend Next.js.

**Manual de producto / visión de módulos (menos técnico):** [`docs/MANUAL-PRODUCTO-Y-ARQUITECTURA.md`](docs/MANUAL-PRODUCTO-Y-ARQUITECTURA.md).

## Arranque rápido (Docker)

Desde la raíz del repo:

```bash
docker compose up --build
```

- **Frontend**: http://localhost:3000  
- **API**: http://localhost:4000  
- **Postgres**: puerto host `5433` (usuario `copilot`, base `copilot_seguros`)

La primera vez que se crea el volumen de Postgres se ejecutan los scripts en `backend/db/init/` (incluye tenant demo y usuario demo de login).

## Login (demo)

1. Abrí http://localhost:3000/login  
2. Valores por defecto en DB **nueva** (tras `docker compose` con volumen fresco):
   - **Tenant ID**: `00000000-0000-0000-0000-000000000000`
   - **Email**: `productor@demo.local`
   - **Contraseña**: `demo1234`

Si tu base ya existía **antes** del script `004-seed-demo-user.sql`, podés crear un usuario con `POST /users` (ver OpenAPI / colección) o ejecutar el SQL a mano en Postgres.

Tras el login, el navegador guarda la sesión en `sessionStorage` y las pantallas envían:

- `Authorization: Bearer <token>`
- `x-tenant-id: <tenant del usuario>`

Variable opcional en el API: `JWT_SECRET` (en producción obligatoria; en local hay default solo para desarrollo).

## Manual de usuario (qué hace cada parte)

| Sección | Qué es | Cómo usarlo |
|--------|--------|-------------|
| **Inicio** | Panel con KPIs, actividad y accesos | Tras login, resume clientes, chats, siniestros, pólizas, métricas de productor. |
| **Inbox** | Conversaciones tipo bandeja | Filtros por estado/canal; asignar cliente; cerrar chat; mensajes y sugerencia del orquestador. |
| **Siniestros** | Listado y detalle | Listado con enlace **Detalle**; en el detalle: timeline, estado y revisión humana. **Intake**: wizard para crear borrador. |
| **Pólizas** | Cartera y renovaciones | Resumen de renovaciones próximas; alta demo; **asignar aseguradora** por fila (PATCH). |
| **Aseguradoras** | Catálogo por PAS (tenant) | Alta de compañías; luego se enlazan desde Pólizas. |
| **Clientes** | CRM mínimo | Alta, edición, búsqueda, baja. |
| **Tareas** | SLA y asignación | Asignar usuario, completar, editar vencimiento y tipo. |
| **Aprobaciones** | Cola comercial | Aprobar / rechazar ítems pendientes. |
| **Agentes** | Playground del orquestador | Mensaje a `POST /orchestrator/chat`; plantillas guardadas en el navegador (`localStorage`). |
| **Conocimiento (RAG)** | Stats por scope | Lectura de índice; indexación vía API si tenés embeddings configurados. |

## Desarrollo local (sin Docker)

- **Backend**: `cd backend && npm install && npm run start:dev` (Postgres y Redis accesibles según `.env`).  
- **Frontend**: `cd frontend && npm install && npm run dev` — definí `NEXT_PUBLIC_API_BASE_URL` si el API no está en `http://localhost:4000`.

## Feedback con un PAS

Convéniente: una sesión de 30–45 minutos recorriendo **Inicio → Clientes → Aseguradoras → Póliza demo → Siniestro (detalle) → Inbox**. Anotá fricciones (“no entiendo X”, “falta Y”, “Z debería ser automático”); con eso se prioriza el siguiente sprint.

## Licencia / estado

Proyecto en evolución; el login y el token son **MVP** para demos, no reemplazan un proveedor de identidad corporativo.
