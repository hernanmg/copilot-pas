# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev        # Watch mode (hot reload)
npm run start            # Production start (requires prior build)
npm run build            # Compile TypeScript → dist/

# Quality
npm run lint             # ESLint on src/**/*.ts
npm run format           # Prettier write

# Database migrations
npm run migration:run    # Run pending TypeORM migrations
```

No test runner is configured yet (`@nestjs/testing` is installed but no test scripts exist).

## Architecture

NestJS 10 backend exposing REST APIs for an AI copilot product aimed at Argentine insurance brokers ("productores de seguros"). All data is **multi-tenant**: every entity carries a `tenantId` UUID that must be propagated explicitly — there is no global tenant context object.

### Infrastructure

| Layer | Tech | Config |
|---|---|---|
| HTTP | NestJS / Express | Port 4000 (`PORT` env) |
| ORM | TypeORM 0.3 | `synchronize: false` — always use migrations |
| DB | PostgreSQL + pgvector | Port 5433 by default |
| Cache / sessions | Redis via ioredis | Port 6380 by default |

`RedisModule` is `@Global()`, so inject it with the `REDIS` symbol token everywhere (`@Inject(REDIS)`).

TypeORM is configured with `autoLoadEntities: true`. Every entity added to a feature module via `TypeOrmModule.forFeature([...])` is automatically picked up.

### Module map

```
AppModule
├── Auth          — JWT login/me  (custom jwt.util.ts, no Passport)
├── Tenants       — tenant registry
├── Users         — bcrypt passwords, role
├── Producers     — producer (broker) accounts
├── Customers     — insured persons, per tenant
├── Insurers      — insurance companies, per tenant
├── Policies      — policy lifecycle (ACTIVE / CANCELLED / EXPIRED…)
├── Claims        — full siniestro lifecycle + intake flow (see below)
├── Conversations — WhatsApp/web chat threads + messages
├── Orchestrator  — intent routing + RAG dispatch (no LLM call yet)
├── RAG           — pgvector embedding index + retrieval (LangChain)
└── ProducerWorkflow — approval requests + work tasks
```

### Auth

Stateless JWT. `auth.service.ts` calls `jwt.util.ts` (custom `signAccessToken` / `verifyAccessToken`). Set `JWT_SECRET` in env; the default is a dev placeholder. Token payload: `{ sub: userId, tid: tenantId }`. TTL is 7 days.

Controllers currently accept `tenantId` from the request body/query directly (no JWT guard middleware enforced globally yet).

### RAG module

`IRagService` (defined in `rag/contracts/rag.contracts.ts`) is the interface; `RagService` implements it. It is registered as `RAG_SERVICE` (Symbol token) and injected into `OrchestratorService`.

Two embedding providers are supported at runtime via env var:
- `RAG_EMBEDDINGS_PROVIDER=OPENAI` (default) — needs `OPENAI_API_KEY`
- `RAG_EMBEDDINGS_PROVIDER=OLLAMA` — needs `OLLAMA_BASE_URL` + `OLLAMA_EMBED_MODEL`

RAG talks directly to Postgres via a `pg.Pool` (not TypeORM) because it needs to use the `<=>` cosine distance operator on `vector` columns (`pgvector` extension must be enabled in the DB).

DB tables used by RAG: `rag_documents`, `rag_chunks`, `rag_index_events`, `rag_retrieval_logs`.

### Claims / intake flow

The intake flow is a multi-step wizard stored in Redis (key: `claim_intake:{tenantId}:{sessionId}`, TTL 24 h). The required fields and their order are configurable per tenant via `claim_intake_config` table; the service falls back to `DEFAULT_INTAKE_FIELDS` if none is configured.

Chat-driven intake: when an INBOUND CUSTOMER message is saved to a conversation, `ConversationsService.addMessage` automatically calls `ClaimsService.processInboundMessageIntake`, which tries to parse and capture the next missing draft field.

`ClaimDraft` → `Claim` promotion is done via `ClaimsService.approveDraft` after all required fields pass validation.

### Orchestrator

`OrchestratorService.chat` performs keyword-based Spanish intent classification (no LLM call). It returns `draftMessages` and `suggestedNextQuestions` from a static lookup table keyed by agent type. RAG retrieval is triggered only for `policy_analysis` and `support` intents.

## Key environment variables

```
PORT                     # HTTP port (default 4000)
DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
REDIS_HOST / REDIS_PORT  # default localhost:6380
JWT_SECRET
OPENAI_API_KEY           # required if RAG_EMBEDDINGS_PROVIDER=OPENAI
RAG_EMBEDDINGS_PROVIDER  # OPENAI (default) | OLLAMA
OLLAMA_BASE_URL          # e.g. http://localhost:11434
OLLAMA_EMBED_MODEL       # e.g. mxbai-embed-large
RAG_EMBEDDING_MODEL      # OpenAI model name (default text-embedding-3-small)
RAG_EMBEDDING_DIMENSIONS # vector dimensions (default 1536)
```

Config is loaded from `.env.local` then `.env` (`.env.local` wins).
