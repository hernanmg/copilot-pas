"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearSession, readSession, writeSession, type StoredSession } from "../lib/session";

type AuthContextValue = {
  session: StoredSession | null;
  setSession: (s: StoredSession) => void;
  logout: () => void;
  ready: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PREFIXES = ["/login"];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function AppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSessionState] = useState<StoredSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readSession();
    setSessionState(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (isPublicPath(pathname)) return;
    if (!readSession()) {
      router.replace("/login");
    }
  }, [ready, pathname, router]);

  const setSession = useCallback((s: StoredSession) => {
    writeSession(s);
    setSessionState(s);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSessionState(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({ session, setSession, logout, ready }),
    [session, setSession, logout, ready],
  );

  if (!ready && !isPublicPath(pathname)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">
        Cargando sesión…
      </div>
    );
  }

  if (ready && !isPublicPath(pathname) && !readSession()) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">
        Redirigiendo al login…
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AppProviders");
  return ctx;
}
