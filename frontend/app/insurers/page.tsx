"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DEFAULT_TENANT_ID, readSession } from "@/lib/session";

type Insurer = {
  id: string;
  tenantId: string;
  name: string;
  code?: string | null;
  apiBaseUrl?: string | null;
  createdAt: string;
};

export default function InsurersPage() {
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [rows, setRows] = useState<Insurer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");

  const canCreate = useMemo(() => name.trim().length > 1, [name]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/insurers", undefined, tenantId);
      if (!res.ok) throw new Error(await res.text());
      setRows((await res.json()) as Insurer[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    const s = readSession();
    if (s?.tenantId) setTenantId(s.tenantId);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!canCreate) return;
    setError(null);
    try {
      const res = await apiFetch(
        "/insurers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            code: code.trim() || undefined,
            apiBaseUrl: apiBaseUrl.trim() || undefined,
          }),
        },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      setName("");
      setCode("");
      setApiBaseUrl("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo crear");
    }
  }

  return (
    <div className="dashboard-main space-y-8">
      <header className="border-b border-slate-800/80 pb-6">
        <p className="section-kicker">Fundaciones</p>
        <h1 className="section-title mt-2 text-3xl font-bold text-white md:text-4xl">Aseguradoras</h1>
        <p className="section-sub mt-3 max-w-2xl text-slate-400">
          Catálogo por tenant (PAS). Endpoint{" "}
          <code className="rounded bg-slate-800 px-1 text-xs">GET/POST /insurers</code>.
        </p>
      </header>

      <div className="dashboard-section-panel max-w-lg space-y-3">
        <label className="kpi-label">Tenant ID</label>
        <input
          className="input-producer mt-1 w-full"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
        />
        <button type="button" onClick={() => load()} className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
          Recargar
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/35 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="dashboard-section-panel space-y-4">
        <h2 className="text-lg font-bold text-white">Alta</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="kpi-label">Nombre</label>
            <input className="input-producer mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="kpi-label">Código</label>
            <input className="input-producer mt-1 w-full" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SANCOR" />
          </div>
          <div className="sm:col-span-3">
            <label className="kpi-label">API base URL (opcional)</label>
            <input
              className="input-producer mt-1 w-full"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://api.aseguradora.com"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={!canCreate}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Crear aseguradora
        </button>
      </div>

      <div className="dashboard-section-panel overflow-hidden p-0">
        <div className="border-b border-slate-800/80 px-6 py-4">
          <h2 className="text-lg font-bold text-white">Listado</h2>
          <p className="mt-1 text-sm text-slate-500">{loading ? "Cargando…" : `${rows.length} registros`}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-950/60 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3">Nombre</th>
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">API</th>
                <th className="px-5 py-3">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/40">
                  <td className="px-5 py-3 font-semibold text-slate-100">{r.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">{r.code ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-400">{r.apiBaseUrl ?? "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{r.id}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-slate-500">
                    No hay aseguradoras creadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="flex flex-wrap gap-4">
        <Link href="/policies" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
          ← Pólizas
        </Link>
        <Link href="/" className="text-sm font-semibold text-slate-400 hover:text-slate-200">
          Panel principal
        </Link>
      </p>
    </div>
  );
}

