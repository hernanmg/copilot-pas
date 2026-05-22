"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DEFAULT_TENANT_ID, readSession } from "@/lib/session";

const STATUSES = ["DRAFT", "SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED", "CLOSED"] as const;

type ClaimEventRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type ClaimDetail = {
  claim: {
    id: string;
    type: string;
    status: string;
    customerId: string;
    policyId: string;
    eventDatetime?: string;
    eventLocation?: string;
    narrative?: string;
    requiresHumanReview?: boolean;
    createdAt: string;
  };
  events: ClaimEventRow[];
  policy: {
    id: string;
    policyNumber: string;
    status: string;
    startDate: string;
    endDate: string;
    insurerId?: string | null;
  } | null;
  insurer: { id: string; name: string; code?: string | null } | null;
  customer: {
    id: string;
    fullName: string;
    email?: string | null;
    phoneWhatsapp?: string | null;
  } | null;
};

export default function ClaimDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [data, setData] = useState<ClaimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusPick, setStatusPick] = useState<string>("");
  const [reviewFlag, setReviewFlag] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/claims/${id}/detail`, undefined, tenantId);
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as ClaimDetail;
      setData(j);
      setStatusPick(j.claim.status);
      setReviewFlag(!!j.claim.requiresHumanReview);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  useEffect(() => {
    const s = readSession();
    if (s?.tenantId) setTenantId(s.tenantId);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function applyPatch(body: Record<string, unknown>) {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/claims/${id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  const c = data?.claim;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-sky-400/90">Operación</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Siniestro
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">{id || "—"}</p>
        </div>
        <div className="card-surface w-full max-w-sm shrink-0 p-4">
          <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Tenant ID
          </label>
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="input-producer mt-1 w-full"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => load()}
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              Recargar
            </button>
            <Link href="/claims" className="text-sm text-slate-400 hover:text-slate-200">
              ← Listado
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !c && <div className="text-sm text-slate-500">Cargando…</div>}

      {c && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card-surface space-y-4 p-5">
              <h2 className="text-sm font-semibold text-slate-200">Datos</h2>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] uppercase text-slate-500">Tipo</dt>
                  <dd className="text-slate-100">{c.type}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-slate-500">Estado actual</dt>
                  <dd className="text-slate-100">{c.status}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[11px] uppercase text-slate-500">Relato</dt>
                  <dd className="whitespace-pre-wrap text-slate-300">{c.narrative ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-slate-500">Fecha del hecho</dt>
                  <dd className="text-slate-300">
                    {c.eventDatetime ? new Date(c.eventDatetime).toLocaleString() : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-slate-500">Lugar</dt>
                  <dd className="text-slate-300">{c.eventLocation ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-slate-500">Póliza</dt>
                  <dd className="space-y-1">
                    <div className="font-mono text-xs text-slate-400">{c.policyId}</div>
                    {data?.policy ? (
                      <div className="text-xs text-slate-400">
                        <span className="font-mono text-emerald-300/90">{data.policy.policyNumber}</span>{" "}
                        <span className="text-slate-500">·</span> {data.policy.status}{" "}
                        <span className="text-slate-500">·</span> {data.policy.startDate} → {data.policy.endDate}
                      </div>
                    ) : null}
                    {data?.insurer ? (
                      <div className="text-xs text-slate-300">
                        Aseguradora: <span className="font-semibold text-slate-100">{data.insurer.name}</span>
                        {data.insurer.code ? <span className="text-slate-500"> ({data.insurer.code})</span> : null}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">Aseguradora: —</div>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="card-surface space-y-4 p-5">
              <h2 className="text-sm font-semibold text-slate-200">Cliente</h2>
              {data?.customer ? (
                <div className="text-sm">
                  <div className="font-semibold text-white">{data.customer.fullName}</div>
                  <div className="mt-1 text-slate-400">{data.customer.email ?? "—"}</div>
                  <div className="text-slate-400">{data.customer.phoneWhatsapp ?? ""}</div>
                  <Link
                    href={`/customers`}
                    className="mt-3 inline-block text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    Ir a clientes
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Sin cliente vinculado en CRM.</p>
              )}
            </div>
          </div>

          <div className="card-surface space-y-4 p-5">
            <h2 className="text-sm font-semibold text-slate-200">Acciones de estado</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] uppercase text-slate-500">Nuevo estado</label>
                <select
                  className="input-producer mt-1 py-2 text-sm"
                  value={statusPick}
                  onChange={(e) => setStatusPick(e.target.value)}
                  disabled={busy}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={busy || statusPick === c.status}
                onClick={() => applyPatch({ status: statusPick })}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Actualizar estado
              </button>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={reviewFlag}
                onChange={(e) => setReviewFlag(e.target.checked)}
                disabled={busy}
              />
              Requiere revisión humana
            </label>
            <button
              type="button"
              disabled={busy || reviewFlag === !!c.requiresHumanReview}
              onClick={() => applyPatch({ requiresHumanReview: reviewFlag })}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              Guardar bandera de revisión
            </button>
          </div>

          <div className="card-surface overflow-hidden">
            <div className="border-b border-slate-800/80 px-4 py-3 text-sm font-semibold text-slate-200">
              Timeline
            </div>
            <ul className="divide-y divide-slate-800/80">
              {(data?.events ?? []).map((ev) => (
                <li key={ev.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-emerald-300/95">{ev.type}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(ev.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-950/60 p-2 font-mono text-[11px] text-slate-400">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                </li>
              ))}
              {(data?.events ?? []).length === 0 && (
                <li className="px-4 py-8 text-center text-slate-500">Sin eventos todavía.</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
