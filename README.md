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

## Antes de la demo

Estos pasos cargan el conocimiento demo en el índice RAG y precalientan los modelos Ollama en RAM para evitar latencia de carga durante la demo en vivo.

### Prerrequisitos

- Backend y Postgres corriendo (Docker o local)
- Ollama instalado y corriendo (`ollama serve`)
- Modelos descargados:
  ```bash
  ollama pull llama3.2          # modelo LLM (classify + generate)
  ollama pull mxbai-embed-large # modelo de embeddings
  ```

### 1 · Indexar documentos demo (una vez por DB nueva)

```bash
cd backend
npm run seed:rag
```

Indexa 3 documentos en el knowledge base del tenant demo:
- **FAQ granizo** — preguntas frecuentes sobre cobertura de granizo en hogar (`FAQ`)
- **Condiciones generales auto · Sancor** — términos de la póliza de automotor (`INSURER_CONDITIONS`)
- **Playbook siniestro granizo** — guía interna del productor para gestionar el trámite (`PLAYBOOK`)

El script lee `.env` o `.env.local` y usa las credenciales demo por defecto (`productor@demo.local` / `demo1234`). Tardará ~2–5 minutos dependiendo de la GPU/CPU de Ollama.

### 2 · Precalentar modelos (2–3 minutos antes de cada demo)

```bash
cd backend
npm run warmup
```

Envía una consulta al orquestador y un documento corto al RAG para forzar la carga de `llama3.2` y `mxbai-embed-large` en RAM. Una vez completado el warmup, el primer mensaje del chat tarda < 5 segundos en lugar de 30–90 segundos.

### Variables de entorno para los scripts

Las variables se leen automáticamente de `backend/.env.local` o `backend/.env`. Se pueden sobrescribir desde la shell:

```bash
BASE_URL=http://mi-servidor:4000 npm run seed:rag
DEMO_EMAIL=otro@tenant.com DEMO_PASSWORD=pass123 npm run warmup
```

---

## Desarrollo local (sin Docker)

- **Backend**: `cd backend && npm install && npm run start:dev` (Postgres y Redis accesibles según `.env`).  
- **Frontend**: `cd frontend && npm install && npm run dev` — definí `NEXT_PUBLIC_API_BASE_URL` si el API no está en `http://localhost:4000`.


## Eliminar y Levantar toda la base de vuelta

Los comandos exactos, en orden:

# 1 — Bajar solo el contenedor de Postgres (deja Redis y lo demás intacto)
docker stop copilot_seguros_db
s (requiere que el contenedor esté detenido)
docker rm copilot_seguros_db
docker volume rm copilot-seguros_copilot_db_data

# 3 — Volver a levantar; Docker crea el volumen vacío y ejecuta todos
#     los scripts de backend/db/init/ en orden alfabético automáticamente
docker compose up -d copilot_db

---
cker Compose antepone el nombre del directorio raíz al nombre declarado en docker-compose.yml. El directorio es Copilot-Seguros pero Docker lo normaliza a minúsculas sin guion → copilot-seguros, así que el volumen real es copilot-seguros_copilot_db_data.

Si no estás seguro del nombre exacto, verificalo antes del rm:

docker volume ls | findstr copilot

---
Flujo completo si querés bajar todo el stack y levantar limpio:

docker compose down
docker volume rm copilot-seguros_copilot_db_data
docker compose up -d

docker compose down detiene y elimina todos los contenedores pero no borra los volúmenes (por diseño); por eso el volume rm es explícito.

---
Verificación post-arranque — esperá el healthcheck de Postgres (~10 s) y luecorrieron:

docker exec copilot_seguros_db psql -U copilot -d copilot_seguros -c "\dt"

Deberías ver las tablas (tenants, users, customers, claims, rag_chunks, etc.

cd backend && npm run seed:rag

## Feedback con un PAS

Convéniente: una sesión de 30–45 minutos recorriendo **Inicio → Clientes → Aseguradoras → Póliza demo → Siniestro (detalle) → Inbox**. Anotá fricciones (“no entiendo X”, “falta Y”, “Z debería ser automático”); con eso se prioriza el siguiente sprint.

## Licencia / estado

Proyecto en evolución; el login y el token son **MVP** para demos, no reemplazan un proveedor de identidad corporativo.

