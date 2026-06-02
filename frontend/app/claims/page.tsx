"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { DEFAULT_TENANT_ID, readSession } from "@/lib/session";

type Claim = {
  id: string;
  type: string;
  status: string;
  customerId: string;
  policyId: string;
  eventDatetime?: string;
  eventLocation?: string;
  requiresHumanReview?: boolean;
  createdAt: string;
};

function ClaimsFallback() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-56 animate-pulse rounded-lg bg-slate-800" />
      <div className="card-surface h-64 animate-pulse bg-slate-900/50" />
    </div>
  );
}

export default function ClaimsPage() {
  return (
    <Suspense fallback={<ClaimsFallback />}>
      <ClaimsInner />
    </Suspense>
  );
}

function ClaimsInner() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("claimId");
  const needsReviewOnly = searchParams.get("needsReview") === "1";
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/claims", undefined, tenantId);
      if (!res.ok) throw new Error(await res.text());
      setClaims((await res.json()) as Claim[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando siniestros");
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
    if (!needsReviewOnly) return claims;
    return claims.filter((c) => c.requiresHumanReview === true);
  }, [claims, needsReviewOnly]);

  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      const el = rowRefs.current[highlightId];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [highlightId, filtered]);

  const reviewCount = useMemo(
    () => claims.filter((c) => c.requiresHumanReview === true).length,
    [claims],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-sky-400/90">Operación</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Siniestros
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Listado para el productor. Podés profundizar desde el panel con{" "}
            <code className="rounded bg-slate-800 px-1 text-[11px]">?claimId=</code> o filtrar revisión
            humana.
          </p>
          {needsReviewOnly && (
            <p className="mt-2 text-xs text-amber-200/90">
              Filtro activo: solo casos marcados para revisión ({filtered.length}).
              <Link href="/claims" className="ml-2 text-emerald-400 hover:text-emerald-300">
                Ver todos
              </Link>
            </p>
          )}
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
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button type="button" onClick={load} className="text-sm text-emerald-400 hover:text-emerald-300">
              Recargar
            </button>
            <Link href="/claims/intake" className="text-sm text-sky-400 hover:text-sky-300">
              Iniciar intake
            </Link>
            <Link href="/claims/drafts" className="text-sm text-slate-300 hover:text-white">
              Borradores
            </Link>
            <Link href="/claims/intake/config" className="text-sm text-violet-300 hover:text-violet-200">
              Config. intake
            </Link>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Con revisión pendiente:{" "}
            <span className="tabular-nums text-slate-300">{reviewCount}</span>
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="card-surface overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-800/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-semibold text-slate-200">
            {needsReviewOnly ? "Siniestros — revisión humana" : "Últimos siniestros"}
          </span>
          {loading && <span className="text-xs text-slate-500">Cargando…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-800/80 bg-slate-950/40 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Revisión</th>
                <th className="px-4 py-2">Fecha evento</th>
                <th className="px-4 py-2">Lugar</th>
                <th className="px-4 py-2">ID siniestro</th>
                <th className="px-4 py-2"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((c) => {
                const isHi = highlightId === c.id;
                return (
                  <tr
                    key={c.id}
                    id={`claim-row-${c.id}`}
                    ref={(el) => {
                      rowRefs.current[c.id] = el;
                    }}
                    className={[
                      "transition",
                      isHi
                        ? "bg-amber-500/15 ring-1 ring-amber-500/40 ring-inset"
                        : "hover:bg-slate-800/30",
                    ].join(" ")}
                  >
                    <td className="px-4 py-2">
                      <span className="inline-flex rounded-md bg-slate-800/80 px-2 py-0.5 text-xs">
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-200">{c.type}</td>
                    <td className="px-4 py-2">
                      {c.requiresHumanReview ? (
                        <span className="text-xs font-medium text-amber-300">Sí</span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {c.eventDatetime ? new Date(c.eventDatetime).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{c.eventLocation ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{c.id}</td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/claims/${c.id}`}
                        className="text-xs font-semibold text-sky-400 hover:text-sky-300"
                      >
                        Detalle
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    {needsReviewOnly
                      ? "No hay siniestros pendientes de revisión."
                      : "No hay siniestros todavía. Probá iniciar un intake."}
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
