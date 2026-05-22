"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DEFAULT_TENANT_ID, readSession } from "@/lib/session";

type ClaimDraft = {
  id: string;
  status: "DRAFT" | "CONVERTED" | "CANCELLED";
  customerId?: string | null;
  policyId?: string | null;
  sourceConversationId?: string | null;
  missingFields?: string[] | null;
  convertedClaimId?: string | null;
  updatedAt: string;
  createdAt: string;
};

function DraftsFallback() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-56 animate-pulse rounded-lg bg-slate-800" />
      <div className="card-surface h-64 animate-pulse bg-slate-900/50" />
    </div>
  );
}

export default function ClaimDraftsPage() {
  return (
    <Suspense fallback={<DraftsFallback />}>
      <ClaimDraftsInner />
    </Suspense>
  );
}

function ClaimDraftsInner() {
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [rows, setRows] = useState<ClaimDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlyPending, setOnlyPending] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/claims/drafts", undefined, tenantId);
      if (!res.ok) throw new Error(await res.text());
      setRows((await res.json()) as ClaimDraft[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando borradores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const s = readSession();
    if (s?.tenantId) setTenantId(s.tenantId);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!onlyPending) return rows;
    return rows.filter((d) => d.status === "DRAFT" && (d.missingFields ?? []).length > 0);
  }, [rows, onlyPending]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-sky-400/90">Operación</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">Borradores</h1>
          <p className="mt-1 text-sm text-slate-400">
            Borradores de siniestro pendientes de completar o ya convertidos.
          </p>
        </div>

        <div className="card-surface w-full max-w-sm shrink-0 p-4">
          <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">Tenant ID</label>
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="input-producer mt-1 w-full" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={load} className="text-sm text-emerald-400 hover:text-emerald-300">
              Recargar
            </button>
            <Link href="/claims" className="text-sm text-slate-400 hover:text-slate-200">
              ← Siniestros
            </Link>
            <Link href="/claims/intake/config" className="text-sm text-violet-300 hover:text-violet-200">
              Config. intake
            </Link>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
            Solo pendientes (DRAFT con faltantes)
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 px-4 py-3">
          <span className="text-sm font-semibold text-slate-200">
            {onlyPending ? "Pendientes" : "Todos"} · {filtered.length}
          </span>
          {loading && <span className="text-xs text-slate-500">Cargando…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-slate-800/80 bg-slate-950/40 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Faltantes</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Póliza</th>
                <th className="px-4 py-2">Conversación</th>
                <th className="px-4 py-2">Actualizado</th>
                <th className="px-4 py-2"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-2">
                    <span className="inline-flex rounded-md bg-slate-800/80 px-2 py-0.5 text-xs">{d.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    {(d.missingFields ?? []).length > 0 ? (
                      <span className="text-xs font-medium text-amber-300">
                        {(d.missingFields ?? []).length}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {d.customerId ? `${d.customerId.slice(0, 8)}…` : "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {d.policyId ? `${d.policyId.slice(0, 8)}…` : "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {d.sourceConversationId ? `${d.sourceConversationId.slice(0, 8)}…` : "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-400">{new Date(d.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <Link href={`/claims/drafts/${d.id}`} className="text-xs font-semibold text-sky-400 hover:text-sky-300">
                      Abrir
                    </Link>
                    {d.convertedClaimId ? (
                      <>
                        <span className="mx-2 text-slate-700">·</span>
                        <Link href={`/claims/${d.convertedClaimId}`} className="text-xs text-slate-300 hover:text-white">
                          Ver claim
                        </Link>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No hay borradores para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

