"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../providers";

type Item = { href: string; label: string; desc: string };

const groups: { title: string; items: Item[] }[] = [
  {
    title: "Principal",
    items: [
      { href: "/", label: "Inicio", desc: "Resumen y KPIs" },
      { href: "/inbox", label: "Inbox", desc: "Mensajes" },
    ],
  },
  {
    title: "Operación",
    items: [
      { href: "/claims", label: "Siniestros", desc: "Intake y tablero" },
      { href: "/policies", label: "Pólizas", desc: "Cartera y renovaciones" },
      { href: "/approvals", label: "Aprobaciones", desc: "Cotiz. / endosos" },
      { href: "/tasks", label: "Tareas", desc: "SLA y asignación" },
      { href: "/customers", label: "Clientes", desc: "Cartera" },
      { href: "/insurers", label: "Aseguradoras", desc: "Catálogo por tenant" },
    ],
  },
  {
    title: "Herramientas",
    items: [
      { href: "/agents", label: "Agentes", desc: "Orquestador" },
      { href: "/rag", label: "Conocimiento", desc: "RAG y demo" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function linkClass(active: boolean) {
  return [
    "producer-nav-link group flex w-full min-w-0 items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left no-underline transition",
    active
      ? "border-emerald-500/40 bg-emerald-500/10 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_8px_30px_-10px_rgba(16,185,129,0.25)]"
      : "text-slate-200 hover:border-slate-600/50 hover:bg-slate-800/50",
  ].join(" ");
}

export function ProducerSidebar() {
  const pathname = usePathname();
  const { session, logout } = useAuth();

  return (
    <aside
      className="producer-shell-sidebar relative z-20 hidden w-72 shrink-0 flex-col border-r border-slate-700/50 bg-slate-950/90 shadow-[4px_0_24px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:flex"
      aria-label="Navegación del productor"
    >
      <div className="border-b border-slate-800/80 px-4 py-5">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-base font-bold text-slate-950 shadow-lg"
            aria-hidden
          >
            CP
          </span>
          <div className="min-w-0">
            <div className="truncate text-base font-bold leading-tight text-white">Copilot Seguros</div>
            <div className="mt-0.5 truncate text-xs text-slate-500">Consola del productor</div>
          </div>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
              {group.title}
            </p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0" role="list">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href} className="block">
                    <Link href={item.href} className={linkClass(active)}>
                      <span
                        className={[
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          active ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" : "bg-slate-600 group-hover:bg-slate-400",
                        ].join(" ")}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold leading-snug">{item.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 group-hover:text-slate-400">
                          {item.desc}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800/80 px-4 py-4 text-[11px] leading-relaxed text-slate-500">
        {session ? (
          <div className="mb-3 space-y-1 text-slate-400">
            <div className="truncate font-medium text-slate-200">{session.user.displayName}</div>
            <div className="truncate text-[10px] text-slate-500">{session.user.email}</div>
            <button
              type="button"
              onClick={logout}
              className="mt-2 w-full rounded-lg border border-slate-700/80 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800/60"
            >
              Cerrar sesión
            </button>
          </div>
        ) : (
          <div className="mb-3">
            <Link
              href="/login"
              className="block w-full rounded-lg bg-emerald-600/90 py-2 text-center text-xs font-semibold text-slate-950 hover:bg-emerald-500"
            >
              Iniciar sesión
            </Link>
          </div>
        )}
        Multi-tenant · métricas{" "}
        <code className="rounded bg-slate-900 px-1 py-0.5 text-[10px] text-slate-600">/producer/metrics</code>
      </div>
    </aside>
  );
}
