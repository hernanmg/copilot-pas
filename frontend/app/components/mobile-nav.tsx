"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Solo vista &lt; lg: misma fuente de rutas que el sidebar, sin duplicar labels largos */
const links = [
  { href: "/", label: "Inicio" },
  { href: "/inbox", label: "Inbox" },
  { href: "/claims", label: "Siniestros" },
  { href: "/policies", label: "Pólizas" },
  { href: "/approvals", label: "Aprob." },
  { href: "/tasks", label: "Tareas" },
  { href: "/customers", label: "Clientes" },
  { href: "/agents", label: "Agentes" },
  { href: "/rag", label: "RAG" },
  { href: "/login", label: "Login" },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <header
      className="sticky top-0 z-30 border-b border-slate-700/60 bg-slate-950/95 shadow-lg shadow-black/20 backdrop-blur-xl lg:hidden"
      aria-label="Navegación móvil"
    >
      <div className="flex gap-1.5 overflow-x-auto px-3 py-3">
        {links.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={[
                "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold no-underline transition",
                active
                  ? "bg-emerald-500/25 text-white ring-2 ring-emerald-500/50"
                  : "border border-transparent bg-slate-900/80 text-slate-400 hover:border-slate-600 hover:text-white",
              ].join(" ")}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
