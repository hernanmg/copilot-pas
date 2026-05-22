"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DEFAULT_TENANT_ID, readSession } from "@/lib/session";

type Policy = {
  id: string;
  policyNumber: string;
  status: string;
  customerId: string;
  insurerId?: string | null;
  startDate: string;
  endDate: string;
  currency?: string;
};

type PolicySummary = {
  activeTotal: number;
  renewingWithinWindow: number;
  windowDays: number;
  from: string;
  to: string;
};

type CustomerOpt = { id: string; fullName: string };
type InsurerOpt = { id: string; name: string; code?: string | null };

export default function PoliciesPage() {
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [rows, setRows] = useState<Policy[]>([]);
  const [summary, setSummary] = useState<PolicySummary | null>(null);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [insurers, setInsurers] = useState<InsurerOpt[]>([]);
  const [demoCustomerId, setDemoCustomerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pr, sr, cr, ir] = await Promise.all([
        apiFetch("/policies", undefined, tenantId),
        apiFetch("/policies/summary", undefined, tenantId),
        apiFetch("/customers", undefined, tenantId),
        apiFetch("/insurers", undefined, tenantId),
      ]);
      if (!pr.ok) throw new Error(await pr.text());
      if (!sr.ok) throw new Error(await sr.text());
      setRows((await pr.json()) as Policy[]);
      setSummary((await sr.json()) as PolicySummary);
      if (cr.ok) setCustomers((await cr.json()) as CustomerOpt[]);
      if (ir.ok) setInsurers((await ir.json()) as InsurerOpt[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
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

  async function createDemo() {
    if (!demoCustomerId.trim()) {
      setError("Elegí un cliente para la póliza demo.");
      return;
    }
    setError(null);
    try {
      const res = await apiFetch(
        "/policies/demo",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: demoCustomerId.trim() }),
        },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo crear la demo");
    }
  }

  async function patchPolicy(policyId: string, body: Record<string, unknown>) {
    setBusyId(policyId);
    setError(null);
    try {
      const res = await apiFetch(
        `/policies/${policyId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="dashboard-main space-y-8">
      <header className="border-b border-slate-800/80 pb-6">
        <p className="section-kicker">Ventas / cartera</p>
        <h1 className="section-title mt-2 text-3xl font-bold text-white md:text-4xl">Pólizas</h1>
        <p className="section-sub mt-3 max-w-2xl text-slate-400">
          Listado y alertas por fecha de fin (<code className="rounded bg-slate-800 px-1 text-xs">end_date</code>
          ). Alta rápida con póliza demo vinculada a un cliente.
        </p>
      </header>

      <div className="dashboard-section-panel max-w-lg space-y-3">
        <label className="kpi-label">Tenant ID</label>
        <input
          className="input-producer mt-1 w-full"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
        />
        <button
          type="button"
          onClick={() => load()}
          className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
        >
          Recargar
        </button>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="float-card p-5">
            <div className="kpi-label">Pólizas activas</div>
            <div className="kpi-value mt-2 text-slate-50">{summary.activeTotal}</div>
          </div>
          <div className="float-card border-amber-500/30 p-5 shadow-[0_0_40px_-12px_rgba(245,158,11,0.25)]">
            <div className="kpi-label">Renovación en {summary.windowDays} días</div>
            <div className="kpi-value mt-2 text-amber-100">{summary.renewingWithinWindow}</div>
            <p className="mt-1 text-xs text-slate-500">
              Ventana {summary.from} → {summary.to}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/35 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="dashboard-section-panel space-y-4">
        <h2 className="text-lg font-bold text-white">Alta demo</h2>
        <p className="text-sm text-slate-400">
          El backend valida que el <code className="rounded bg-slate-900 px-1 text-xs">customerId</code> exista en
          el tenant.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="kpi-label">Cliente</label>
            <select
              className="input-producer mt-1 w-full"
              value={demoCustomerId}
              onChange={(e) => setDemoCustomerId(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={createDemo}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Crear póliza demo (1 año)
          </button>
        </div>
      </div>

      <div className="dashboard-section-panel overflow-hidden p-0">
        <div className="border-b border-slate-800/80 px-6 py-4">
          <h2 className="text-lg font-bold text-white">Cartera</h2>
          <p className="mt-1 text-sm text-slate-500">{loading ? "Cargando…" : `${rows.length} registros`}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-950/60 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3">Número</th>
                <th className="px-5 py-3">Aseguradora</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Inicio</th>
                <th className="px-5 py-3">Fin</th>
                <th className="px-5 py-3">Cliente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40">
                  <td className="px-5 py-3 font-mono text-emerald-300/90">{p.policyNumber}</td>
                  <td className="px-5 py-3">
                    <select
                      className="input-producer max-w-[260px] py-1.5 text-xs"
                      disabled={busyId === p.id}
                      value={p.insurerId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        patchPolicy(p.id, { insurerId: v === "" ? null : v });
                      }}
                      title="Setear insurerId en póliza"
                    >
                      <option value="">— Sin aseguradora —</option>
                      {insurers.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                    {insurers.length === 0 ? (
                      <div className="mt-1 text-[11px] text-slate-500">
                        No hay aseguradoras. Crealas en{" "}
                        <Link href="/insurers" className="text-emerald-400 hover:text-emerald-300">
                          /insurers
                        </Link>
                        .
                      </div>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-slate-300">{p.status}</td>
                  <td className="px-5 py-3 text-slate-400">{p.startDate}</td>
                  <td className="px-5 py-3 text-slate-400">{p.endDate}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.customerId.slice(0, 8)}…</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    No hay pólizas. Creá clientes y una demo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p>
        <Link href="/" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
          ← Panel principal
        </Link>
      </p>
    </div>
  );
}
