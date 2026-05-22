"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MobileNav } from "./components/mobile-nav";
import { ProducerSidebar } from "./components/producer-sidebar";

/**
 * En `/login` no mostramos sidebar ni nav móvil: pantalla solo de acceso.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return (
      <div className="flex min-h-screen flex-1 flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/90">
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-10 md:px-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1">
      <ProducerSidebar />
      <div className="producer-main-column flex min-h-screen min-w-0 flex-1 flex-col border-l border-slate-700/40 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/90 shadow-[inset_1px_0_0_rgba(255,255,255,0.04)]">
        <MobileNav />
        <main className="dashboard-main mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6 md:py-10">{children}</main>
      </div>
    </div>
  );
}
