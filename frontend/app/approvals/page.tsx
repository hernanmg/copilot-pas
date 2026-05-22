"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DEFAULT_TENANT_ID, readSession } from "@/lib/session";

type Row = {
  id: string;
  kind: string;
  status: string;
  title: string;
  reference?: string | null;
  createdAt?: string;
};

export default function ApprovalsPage() {
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/producer/approvals", undefined, tenantId);
      if (!res.ok) throw new Error(await res.text());
      setRows((await res.json()) as Row[]);
    } catch (e) {
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

  async function decide(id: string, status: "APPROVED" | "REJECTED") {
    setBusyId(id);
    setError(null);
    try {
      const res = await apiFetch(
        `/producer/approvals/${id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al actualizar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="dashboard-main space-y-10">
      <header className="border-b border-slate-800/80 pb-8">
        <p className="section-kicker">Workflow</p>
        <h1 className="section-title mt-2 text-3xl font-bold text-white md:text-4xl">Aprobaciones</h1>
        <p className="section-sub mt-4 max-w-3xl text-base">
          Decidí cotizaciones y endosos con{" "}
          <code className="rounded-lg bg-slate-800 px-2 py-0.5 text-[13px] text-emerald-200/90">
            PATCH /producer/approvals/:id
          </code>{" "}
          <code className="text-slate-500">{"{ status }"}</code>.
        </p>
        <div className="section-rule mt-6 max-w-xs" />
      </header>

      <div className="dashboard-section-panel max-w-lg">
        <label className="kpi-label">Tenant ID</label>
        <input
          className="input-producer mt-2 w-full"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/50 bg-amber-950/40 px-5 py-4 text-sm text-amber-100">
          {error}
          <p className="mt-2 text-xs text-amber-200/90">
            Si falta la tabla, ejecutá{" "}
            <code className="rounded bg-black/30 px-1">backend/db/init/003-producer-workflow.sql</code>.
          </p>
        </div>
      )}

      <div className="dashboard-section-panel overflow-hidden p-0">
        <div className="border-b border-slate-700/60 px-6 py-5">
          <h2 className="text-lg font-bold text-white">Cola</h2>
          <p className="mt-1 text-sm text-slate-400">
            {loading ? "Cargando…" : `${rows.length} registros`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-slate-950/60 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Título</th>
                <th className="px-6 py-4">Ref.</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/90">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/40">
                  <td className="px-6 py-4">
                    <span
                      className={[
                        "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                        r.status === "PENDING"
                          ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/45"
                          : r.status === "APPROVED"
                            ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/40"
                            : "bg-slate-700/70 text-slate-200",
                      ].join(" ")}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-100">{r.kind}</td>
                  <td className="px-6 py-4 text-slate-200">{r.title}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{r.reference ?? "—"}</td>
                  <td className="px-6 py-4 text-right">
                    {r.status === "PENDING" ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => decide(r.id, "APPROVED")}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => decide(r.id, "REJECTED")}
                          className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-slate-500">
                    No hay aprobaciones cargadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center">
        <Link href="/" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
          ← Panel principal
        </Link>
      </p>
    </div>
  );
}
