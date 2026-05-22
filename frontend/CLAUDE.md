# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Dev server with hot reload (port 3000)
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # ESLint (next lint)
```

No test runner is configured.

## Environment

Create a `.env.local` file if needed:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

Defaults to `http://localhost:4000` if unset. The backend CLAUDE.md (`../backend/CLAUDE.md`) documents backend startup and env vars.

## Architecture

Next.js 14 (App Router) + TypeScript + Tailwind CSS frontend for an AI copilot product aimed at Argentine insurance brokers ("productores de seguros" / PAS). All pages are `"use client"` components.

### Request / Auth layer

`lib/api.ts` — `apiFetch(path, init?, tenantId?)` wraps `fetch` and automatically attaches:
- `x-tenant-id`: from session or `DEFAULT_TENANT_ID` (all-zeros UUID) — overridable per call
- `Authorization: Bearer <token>`: when a session exists

`lib/session.ts` — reads/writes a `StoredSession` (`{ accessToken, tenantId, user }`) to `sessionStorage` under key `copilot_seguros_session`. Returns `null` on SSR (window guard).

### App shell / auth guard

`app/providers.tsx` — `AppProviders` creates `AuthContext` and enforces auth: on mount it reads `sessionStorage`; if no session and path is not public (`/login`), it calls `router.replace("/login")`. Exports `useAuth()`.

`app/app-shell.tsx` — `AppShell` conditionally renders the sidebar and mobile nav. On `/login` it renders a bare centered layout with no navigation.

`app/layout.tsx` — root layout wraps everything in `<AppProviders><AppShell>`.

### Pages / routes

| Route | Purpose |
|---|---|
| `/` | Dashboard — KPIs, activity feed, quick links, clients & policies preview |
| `/login` | Auth form (demo credentials: `productor@demo.local` / `demo1234`) |
| `/inbox` | Conversations (WhatsApp/web threads) |
| `/claims` | Claims table with `?claimId=` highlight and `?needsReview=1` filter |
| `/claims/[id]` | Claim detail |
| `/claims/intake` | Multi-step intake wizard (state stored in Redis on the backend) |
| `/claims/drafts` | Draft claims |
| `/claims/intake/config` | Per-tenant intake field configuration |
| `/claims/drafts/[id]` | Draft detail |
| `/policies` | Policy portfolio |
| `/approvals` | Approval request queue |
| `/tasks` | Work tasks / SLA tracking |
| `/customers` | Customer CRM |
| `/insurers` | Insurer catalog (per tenant) |
| `/agents` | Orchestrator playground — calls `POST /orchestrator/chat` |
| `/rag` | RAG statistics and demo |

### Custom Tailwind utility classes

These utility classes are defined in `app/globals.css` (not in Tailwind config):

| Class | Use |
|---|---|
| `card-surface` | Standard dark card with border and backdrop blur |
| `float-card` | Elevated card with hover lift + emerald glow |
| `float-card-muted` | Variant without hover lift |
| `input-producer` | Standard dark input field |
| `kpi-value` / `kpi-label` / `kpi-hint` | KPI card typography |
| `quick-card` | Dashboard quick-link card |
| `dashboard-section-panel` | Section content wrapper |
| `section-title` / `section-kicker` / `section-sub` / `section-rule` | Section header typography |

### Multi-tenancy

Every API call requires `x-tenant-id`. Many pages expose a visible "Tenant ID" input that overrides the session value — this is intentional for producer-side multi-tenant switching. Always pass `tenantId` as the third argument to `apiFetch` when a page has this input; leave it `undefined` to fall back to the session value.

### Patterns to follow

- Pages that use `useSearchParams()` must be wrapped in `<Suspense>` to avoid Next.js build errors.
- Session is always read client-side in a `useEffect`; never call `readSession()` at module scope or during SSR.
- The sidebar nav groups are defined statically in `app/components/producer-sidebar.tsx` — add new routes there when adding pages.
