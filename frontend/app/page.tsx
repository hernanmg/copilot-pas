"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { API_BASE, apiFetch } from "@/lib/api";
import { DEFAULT_TENANT_ID, readSession } from "@/lib/session";

type ConversationRow = {
  id: string;
  status?: string;
  channel?: string;
  topic?: string | null;
  updatedAt?: string;
  createdAt?: string;
};

type ClaimRow = {
  id: string;
  status?: string;
  type?: string;
  externalClaimNumber?: string | null;
  requiresHumanReview?: boolean;
  updatedAt?: string;
  createdAt?: string;
};

type CustomerRow = {
  id: string;
  fullName?: string;
  phoneWhatsapp?: string | null;
  email?: string | null;
};

type PolicyRow = {
  id: string;
  policyNumber?: string;
  status?: string;
  endDate?: string;
};

type ProducerMetrics = {
  pendingApprovals: number;
  slaOverdue: number;
  openTasks: number;
};

type PolicySummary = {
  activeTotal: number;
  renewingWithinWindow: number;
  windowDays: number;
};

type ActivityItem =
  | { kind: "chat"; id: string; label: string; sub: string; at: Date }
  | { kind: "claim"; id: string; label: string; sub: string; at: Date };

function parseDate(s?: string): Date {
  if (!s) return new Date(0);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function formatRelative(d: Date): string {
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  return `hace ${days} d`;
}

function SectionBlock(props: {
  kicker: string;
  title: string;
  subtitle?: string;
  /** false = sin caja contenedora (para listas que ya traen su propia tarjeta) */
  panel?: boolean;
  children: ReactNode;
}) {
  const showPanel = props.panel !== false;
  return (
    <section className="scroll-mt-28 space-y-8">
      <header className="border-b border-slate-800/80 pb-6">
        <p className="section-kicker">{props.kicker}</p>
        <h2 className="section-title mt-2 text-2xl md:text-3xl">{props.title}</h2>
        {props.subtitle ? (
          <p className="section-sub mt-3 max-w-3xl text-base text-slate-300">{props.subtitle}</p>
        ) : null}
        <div className="section-rule mt-5 w-full max-w-xs" />
      </header>
      {showPanel ? <div className="dashboard-section-panel">{props.children}</div> : props.children}
    </section>
  );
}

export default function HomePage() {
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ProducerMetrics | null>(null);
  const [metricsOk, setMetricsOk] = useState(false);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [policySummary, setPolicySummary] = useState<PolicySummary | null>(null);

  useEffect(() => {
    const s = readSession();
    if (s?.tenantId) setTenantId(s.tenantId);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [cRes, convRes, clRes, polRes, polSumRes, mRes] = await Promise.all([
          apiFetch("/customers", undefined, tenantId),
          apiFetch("/conversations", undefined, tenantId),
          apiFetch("/claims", undefined, tenantId),
          apiFetch("/policies", undefined, tenantId),
          apiFetch("/policies/summary", undefined, tenantId),
          apiFetch("/producer/metrics", undefined, tenantId),
        ]);

        if (!cRes.ok) throw new Error(`Clientes: ${cRes.status}`);
        if (!convRes.ok) throw new Error(`Conversaciones: ${convRes.status}`);
        if (!clRes.ok) throw new Error(`Siniestros: ${clRes.status}`);
        if (!polRes.ok) throw new Error(`Pólizas: ${polRes.status}`);

        const [cJson, convJson, clJson, polJson] = await Promise.all([
          cRes.json(),
          convRes.json(),
          clRes.json(),
          polRes.json(),
        ]);
        setCustomers((Array.isArray(cJson) ? cJson : []) as CustomerRow[]);
        setConversations((Array.isArray(convJson) ? convJson : []) as ConversationRow[]);
        setClaims((Array.isArray(clJson) ? clJson : []) as ClaimRow[]);
        setPolicies((Array.isArray(polJson) ? polJson : []) as PolicyRow[]);

        if (polSumRes.ok) {
          const ps = (await polSumRes.json()) as PolicySummary;
          setPolicySummary({
            activeTotal: Number(ps.activeTotal) || 0,
            renewingWithinWindow: Number(ps.renewingWithinWindow) || 0,
            windowDays: Number(ps.windowDays) || 30,
          });
        } else {
          setPolicySummary(null);
        }

        if (mRes.ok) {
          const mj = (await mRes.json()) as ProducerMetrics;
          setMetrics({
            pendingApprovals: Number(mj.pendingApprovals) || 0,
            slaOverdue: Number(mj.slaOverdue) || 0,
            openTasks: Number(mj.openTasks) || 0,
          });
          setMetricsOk(true);
        } else {
          setMetrics({ pendingApprovals: 0, slaOverdue: 0, openTasks: 0 });
          setMetricsOk(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar el panel");
        setCustomers([]);
        setConversations([]);
        setClaims([]);
        setPolicies([]);
        setPolicySummary(null);
        setMetrics(null);
        setMetricsOk(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId]);

  const kpis = useMemo(() => {
    const openChats = conversations.filter((c) => (c.status || "").toUpperCase() === "OPEN").length;
    const draftClaims = claims.filter((c) => (c.status || "").toUpperCase() === "DRAFT").length;
    const humanReview = claims.filter((c) => c.requiresHumanReview === true).length;
    return {
      customers: customers.length,
      openChats,
      totalClaims: claims.length,
      draftClaims,
      policies: policies.length,
      humanReview,
    };
  }, [customers, conversations, claims, policies]);

  const activity = useMemo(() => {
    const items: ActivityItem[] = [];
    for (const c of conversations) {
      const at = parseDate(c.updatedAt || c.createdAt);
      items.push({
        kind: "chat",
        id: c.id,
        label: c.topic?.trim() || `Chat ${c.channel || "—"}`,
        sub: (c.status || "—").toUpperCase(),
        at,
      });
    }
    for (const cl of claims) {
      const at = parseDate(cl.updatedAt || cl.createdAt);
      items.push({
        kind: "claim",
        id: cl.id,
        label: cl.type || "Siniestro",
        sub: `${cl.status || "—"}${cl.externalClaimNumber ? ` · ${cl.externalClaimNumber}` : ""}`,
        at,
      });
    }
    items.sort((a, b) => b.at.getTime() - a.at.getTime());
    return items.slice(0, 8);
  }, [conversations, claims]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("es", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const m = metrics ?? { pendingApprovals: 0, slaOverdue: 0, openTasks: 0 };

  return (
    <div className="dashboard-main space-y-14 md:space-y-16">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">Consola del productor</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">{greeting}</h1>
          <p className="mt-3 text-base capitalize text-slate-300">{dateLabel}</p>
        </div>
        <div className="float-card float-card-muted max-w-md shrink-0 p-5 text-sm text-slate-300">
          <div className="kpi-label text-slate-500">Entorno</div>
          <div className="mt-2 font-mono text-[13px] text-emerald-200/90">{API_BASE}</div>
          <div className="mt-3 border-t border-slate-700/50 pt-3 font-mono text-[11px] text-slate-500">
            tenant {tenantId}
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-500/45 bg-rose-950/40 px-5 py-4 text-sm text-rose-100 shadow-lg shadow-rose-900/20">
          <span className="font-semibold">Error al cargar datos:</span> {error}
        </div>
      )}

      {!metricsOk && !error && !loading && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/35 px-5 py-4 text-sm text-amber-50">
          <span className="font-semibold">Métricas operativas:</span> no se pudo leer{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">GET /producer/metrics</code>.
          Ejecutá{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
            backend/db/init/003-producer-workflow.sql
          </code>{" "}
          en Postgres y reiniciá el API.
        </div>
      )}

      <SectionBlock
        kicker="Salud del negocio"
        title="Indicadores en vivo"
        subtitle="Clientes, canales, cartera, revisiones de siniestros y colas operativas (aprobaciones y SLA) alimentadas por el backend."
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          <KpiCardFloat
            title="Clientes"
            value={loading ? "—" : kpis.customers}
            hint="Cartera CRM"
            href="/customers"
          />
          <KpiCardFloat
            title="Chats abiertos"
            value={loading ? "—" : kpis.openChats}
            hint="Inbox activo"
            href="/inbox"
          />
          <KpiCardFloat
            title="Siniestros"
            value={loading ? "—" : kpis.totalClaims}
            hint={`${kpis.draftClaims} en borrador`}
            href="/claims"
          />
          <KpiCardFloat
            title="Pólizas"
            value={loading ? "—" : kpis.policies}
            hint="Listado en panel"
            href="/policies"
          />
          <KpiCardFloat
            title={`Renovaciones (${policySummary?.windowDays ?? 30}d)`}
            value={loading ? "—" : policySummary?.renewingWithinWindow ?? "—"}
            hint="Activas próximas a vencer"
            href="/policies"
            tone={
              typeof policySummary?.renewingWithinWindow === "number" &&
              policySummary.renewingWithinWindow > 0
                ? "danger"
                : "default"
            }
          />
          <KpiCardFloat
            title="Revisión humana"
            value={loading ? "—" : kpis.humanReview}
            hint="Claims marcados"
            href="/claims?needsReview=1"
          />
          <KpiCardFloat
            title="Aprobaciones"
            value={loading ? "—" : m.pendingApprovals}
            hint="Cola comercial"
            href="/approvals"
          />
          <KpiCardFloat
            title="SLA vencido"
            value={loading ? "—" : m.slaOverdue}
            hint="Tareas fuera de fecha"
            href="/tasks?overdue=1"
            tone={m.slaOverdue > 0 ? "danger" : "default"}
          />
          <KpiCardFloat
            title="Tareas abiertas"
            value={loading ? "—" : m.openTasks}
            hint="OPEN + en curso"
            href="/tasks"
          />
        </div>
      </SectionBlock>

      <SectionBlock
        kicker="Acceso rápido"
        title="Operación diaria"
        subtitle="Saltá a las herramientas que usa el PAS en producción."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            href="/inbox"
            title="Inbox"
            desc="Bandeja tipo WhatsApp y borradores"
            accent="emerald"
          />
          <QuickLink href="/claims" title="Siniestros" desc="Intake y tablero" accent="sky" />
          <QuickLink href="/approvals" title="Aprobaciones" desc="Cotizaciones y endosos" accent="amber" />
          <QuickLink href="/tasks" title="Tareas / SLA" desc="Seguimiento con vencimiento" accent="rose" />
          <QuickLink href="/customers" title="Clientes" desc="Búsqueda en cartera" accent="teal" />
          <QuickLink href="/policies" title="Pólizas" desc="Cartera y renovaciones" accent="emerald" />
          <QuickLink href="/agents" title="Agentes" desc="Orquestador" accent="violet" />
          <QuickLink href="/rag" title="Conocimiento" desc="Estadísticas RAG" accent="violet" />
          <QuickLink href="/claims/intake" title="Nuevo intake" desc="Wizard guiado" accent="cyan" />
        </div>
      </SectionBlock>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionBlock
            kicker="Últimos movimientos"
            title="Actividad reciente"
            subtitle="Chats y siniestros ordenados por última actualización. Clic para abrir el detalle."
            panel={false}
          >
            <div className="card-surface divide-y divide-slate-800/90 overflow-hidden shadow-xl">
              {loading && (
                <div className="space-y-4 p-5">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex animate-pulse gap-4">
                      <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-800" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-4 w-[75%] rounded bg-slate-800" />
                        <div className="h-3 w-[50%] rounded bg-slate-800/70" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!loading && activity.length === 0 && (
                <p className="p-6 text-sm text-slate-400">No hay actividad reciente.</p>
              )}
              {!loading &&
                activity.map((item) => (
                  <Link
                    key={`${item.kind}-${item.id}`}
                    href={
                      item.kind === "chat"
                        ? `/inbox?conversationId=${encodeURIComponent(item.id)}`
                        : `/claims/${encodeURIComponent(item.id)}`
                    }
                    className="flex items-start gap-4 p-5 transition hover:bg-slate-800/50"
                  >
                    <span
                      className={[
                        "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-inner",
                        item.kind === "chat"
                          ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-500/35"
                          : "bg-sky-500/25 text-sky-200 ring-1 ring-sky-500/35",
                      ].join(" ")}
                    >
                      {item.kind === "chat" ? "Msg" : "Sin"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white">{item.label}</div>
                      <div className="mt-0.5 text-sm text-slate-400">{item.sub}</div>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-slate-500">
                      {formatRelative(item.at)}
                    </span>
                  </Link>
                ))}
            </div>
          </SectionBlock>
        </section>

        <aside className="lg:pt-6">
          <div className="card-surface sticky top-24 space-y-4 p-6">
            <h3 className="text-base font-bold text-white">Seguimiento</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              Las métricas de <strong className="text-slate-200">aprobaciones</strong> y{" "}
              <strong className="text-slate-200">SLA</strong> vienen de tablas en Postgres (
              <code className="rounded bg-slate-800 px-1 text-[11px]">approval_requests</code>,{" "}
              <code className="rounded bg-slate-800 px-1 text-[11px]">tasks</code>) expuestas por el
              API Nest.
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span> Pipeline comercial (próx.: reporting)
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span> Alertas de renovación
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section id="clientes" className="card-surface scroll-mt-24 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">Clientes recientes</h3>
              <p className="mt-1 text-sm text-slate-400">Vista compacta; el detalle está en Clientes.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-300">
                {customers.length} total
              </span>
              <Link
                href="/customers"
                className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
              >
                Ver cartera →
              </Link>
            </div>
          </div>
          {!loading && customers.length === 0 && (
            <p className="mt-6 text-sm text-slate-500">No hay clientes cargados.</p>
          )}
          <ul className="mt-6 divide-y divide-slate-800/90">
            {customers.slice(0, 6).map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0"
              >
                <span className="font-semibold text-slate-100">{c.fullName || "Sin nombre"}</span>
                <span className="font-mono text-[11px] text-slate-500">{c.id.slice(0, 8)}…</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="polizas" className="card-surface scroll-mt-24 p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-white">Pólizas</h3>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {policies.length} en cartera
            </span>
          </div>
          {!loading && policies.length === 0 && (
            <p className="mt-6 text-sm text-slate-500">
              Creá una póliza demo desde el intake o el endpoint de demo del backend.
            </p>
          )}
          <ul className="mt-6 divide-y divide-slate-800/90">
            {policies.slice(0, 6).map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"
              >
                <span className="font-mono text-sm font-semibold text-emerald-300/95">
                  {p.policyNumber || "—"}
                </span>
                <span className="text-sm text-slate-400">
                  {(p.status || "—").toUpperCase()}
                  {p.endDate ? ` · vence ${p.endDate}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <HelpSection />
    </div>
  );
}

function KpiCardFloat(props: {
  title: string;
  value: string | number;
  hint: string;
  href: string;
  tone?: "default" | "danger";
}) {
  const danger = props.tone === "danger" && typeof props.value === "number" && props.value > 0;
  const inner = (
    <>
      <div className="kpi-label">{props.title}</div>
      <div className={`kpi-value mt-3 ${danger ? "text-rose-200" : ""}`}>{props.value}</div>
      <div className="kpi-hint">{props.hint}</div>
    </>
  );
  const shell = [
    "float-card relative z-[1] flex flex-col",
    danger ? "border-rose-500/45 shadow-[0_0_40px_-12px_rgba(244,63,94,0.35)]" : "",
  ].join(" ");
  return (
    <Link href={props.href} className={shell}>
      {inner}
    </Link>
  );
}

function QuickLink(props: {
  href: string;
  title: string;
  desc: string;
  accent: "emerald" | "sky" | "violet" | "amber" | "teal" | "rose" | "cyan";
}) {
  const glow = {
    emerald: "from-emerald-500/25",
    sky: "from-sky-500/25",
    violet: "from-violet-500/25",
    amber: "from-amber-500/25",
    teal: "from-teal-500/25",
    rose: "from-rose-500/25",
    cyan: "from-cyan-500/25",
  }[props.accent];
  return (
    <Link
      href={props.href}
      className={`quick-card group relative isolate overflow-hidden bg-gradient-to-br ${glow} to-slate-950/90`}
    >
      <span className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5 blur-2xl transition group-hover:bg-white/10" />
      <div className="relative z-[1] font-semibold text-white">{props.title}</div>
      <div className="relative z-[1] mt-1 text-sm text-slate-400 group-hover:text-slate-300">
        {props.desc}
      </div>
    </Link>
  );
}

const HELP_NAV_SECTIONS = [
  {
    label: "Inicio",
    desc: "El panel de control de tu operación: KPIs en vivo, actividad reciente y accesos directos a cada herramienta.",
    when: "Para arrancar el día y ver de un vistazo qué está pasando en tu agencia.",
  },
  {
    label: "Inbox",
    desc: "Bandeja de conversaciones con clientes por WhatsApp y otros canales. Podés responder, revisar el historial y gestionar cada hilo desde acá.",
    when: "Cuando un cliente te escribe o querés hacer seguimiento de una consulta en curso.",
  },
  {
    label: "Clientes",
    desc: "Tu cartera CRM: ficha de cada asegurado con datos de contacto, pólizas asociadas y búsqueda rápida por nombre o teléfono.",
    when: "Para buscar, agregar o actualizar información de un cliente.",
  },
  {
    label: "Pólizas",
    desc: "Listado de todas las pólizas activas, vencidas y próximas a renovar, con número de póliza, estado y fecha de vencimiento.",
    when: "Para revisar la cartera, detectar renovaciones que se vienen o consultar el estado de una póliza específica.",
  },
  {
    label: "Aseguradoras",
    desc: "Catálogo de las compañías con las que operás. Desde acá registrás y actualizás cada aseguradora de tu agencia.",
    when: "Al incorporar una nueva compañía o actualizar sus datos.",
  },
  {
    label: "Siniestros",
    desc: "Registro y seguimiento de siniestros. Incluye un wizard de carga paso a paso para no omitir ningún dato importante.",
    when: "Cuando un cliente reporta un siniestro o necesitás ver el estado de uno que está en trámite.",
  },
  {
    label: "Tareas",
    desc: "Lista de tareas con fechas límite (SLA). Cada tarea tiene responsable, vencimiento y estado de avance.",
    when: "Para organizar gestiones pendientes y asegurarte de que no se venzan plazos.",
  },
  {
    label: "Aprobaciones",
    desc: "Cola de solicitudes que necesitan tu aprobación: cotizaciones, endosos y otras gestiones comerciales.",
    when: "Cuando el sistema o tu equipo generan una solicitud que requiere tu visto bueno.",
  },
  {
    label: "Agentes",
    desc: "Asistente con inteligencia artificial que entiende consultas en español. Podés hacerle preguntas o pedirle que clasifique una intención.",
    when: "Para probar el asistente o consultar cómo procesa pedidos de clientes.",
  },
  {
    label: "Conocimiento",
    desc: "Base de conocimiento de tu agencia (RAG). Subí condiciones generales, circulares o documentos propios para que el asistente los use al responder.",
    when: "Para alimentar al asistente con información específica de tu agencia o de las compañías con las que trabajás.",
  },
] as const;

const HELP_STEPS = [
  {
    title: "Cargá tus aseguradoras",
    desc: "Entrá a Aseguradoras y registrá las compañías con las que operás. Es el primer paso porque pólizas y siniestros las necesitan.",
  },
  {
    title: "Cargá tus clientes",
    desc: "En Clientes, creá la ficha de cada asegurado con nombre, teléfono y email. Después los vas a vincular a sus pólizas.",
  },
  {
    title: "Registrá las pólizas",
    desc: "En Pólizas, asociá cada póliza a un cliente y a una aseguradora. Desde acá vas a poder ver renovaciones próximas de un vistazo.",
  },
  {
    title: "Cuando llegue un siniestro, usá el intake",
    desc: "En Siniestros → Nuevo intake, el wizard te guía paso a paso para cargar toda la información sin saltarte campos importantes.",
  },
  {
    title: "Revisá el Inicio todos los días",
    desc: "El panel te muestra aprobaciones pendientes, tareas por vencer y renovaciones próximas. Es tu punto de partida para la jornada.",
  },
] as const;

function HelpSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="border-t border-slate-800/60 pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/60 px-6 py-4 text-left transition hover:border-slate-600/60 hover:bg-slate-800/50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-600/50 bg-slate-800/80 text-base font-bold text-emerald-300">
          ?
        </span>
        <span className="flex-1 text-base font-semibold text-slate-200">¿Cómo usar la consola?</span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="mt-4 space-y-6">
          <div className="card-surface p-6">
            <p className="section-kicker">Para qué sirve</p>
            <h3 className="section-title mt-1 text-xl">Qué es Copilot Seguros</h3>
            <p className="section-sub mt-3 max-w-3xl text-base leading-relaxed">
              Copilot Seguros es tu consola de trabajo como productor o agencia. Desde acá manejás
              toda la operación diaria: atendés mensajes de clientes, cargás y seguís siniestros,
              controlás la cartera de pólizas y renovaciones, gestionás aprobaciones y organizás
              tareas con fecha límite — todo en un solo lugar, sin tener que saltar entre sistemas.
            </p>
          </div>

          <div className="card-surface p-6">
            <p className="section-kicker">Guía del menú</p>
            <h3 className="section-title mt-1 text-xl">¿Para qué sirve cada sección?</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {HELP_NAV_SECTIONS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                    <span className="font-semibold text-white">{s.label}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.desc}</p>
                  <p className="mt-1.5 text-xs text-slate-500">
                    <span className="font-medium text-slate-400">Cuándo usarla:</span> {s.when}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card-surface p-6">
            <p className="section-kicker">Por dónde empezar</p>
            <h3 className="section-title mt-1 text-xl">Flujo típico de uso</h3>
            <ol className="mt-5 space-y-5">
              {HELP_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-sm font-bold text-emerald-300">
                    {i + 1}
                  </span>
                  <div className="pt-0.5">
                    <div className="font-semibold text-slate-100">{step.title}</div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
