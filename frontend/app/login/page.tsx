"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_BASE } from "@/lib/api";
import { DEFAULT_TENANT_ID } from "../../lib/session";
import { useAuth } from "../providers";

type LoginResponse = {
  accessToken: string;
  tenantId: string;
  user: { id: string; email: string; displayName: string; role: string };
};

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [email, setEmail] = useState("productor@demo.local");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenantId.trim(),
          email: email.trim(),
          password,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as LoginResponse;
      setSession({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
        user: data.user,
      });
      router.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/90">Acceso</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-slate-400">
          Consola del productor. Tras entrar, las llamadas al API envían{" "}
          <code className="rounded bg-slate-800 px-1 text-[11px]">Authorization</code> y{" "}
          <code className="rounded bg-slate-800 px-1 text-[11px]">x-tenant-id</code>.
        </p>
      </div>

      <form onSubmit={submit} className="card-surface space-y-4 p-6">
        <div>
          <label className="block text-[11px] font-medium uppercase text-slate-500">Tenant ID</label>
          <input
            className="input-producer mt-1 w-full font-mono text-xs"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase text-slate-500">Email</label>
          <input
            type="email"
            className="input-producer mt-1 w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase text-slate-500">Contraseña</label>
          <input
            type="password"
            className="input-producer mt-1 w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
        <p className="text-center text-xs text-slate-500">
          Usuario demo (DB nueva): <span className="text-slate-300">productor@demo.local</span> /{" "}
          <span className="text-slate-300">demo1234</span>
        </p>
      </form>

      <p className="text-center text-sm text-slate-500">
        <Link href="/" className="text-emerald-400 hover:text-emerald-300">
          Volver al inicio
        </Link>{" "}
        (solo si ya tenés sesión)
      </p>
    </div>
  );
}
