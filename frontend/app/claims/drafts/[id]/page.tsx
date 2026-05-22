"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DEFAULT_TENANT_ID, readSession } from "@/lib/session";

type ClaimDraft = {
  id: string;
  tenantId: string;
  sourceConversationId?: string | null;
  customerId?: string | null;
  policyId?: string | null;
  type?: string | null;
  eventDatetime?: string | null;
  eventLocation?: string | null;
  narrative?: string | null;
  status: "DRAFT" | "CONVERTED" | "CANCELLED";
  missingFields?: string[] | null;
  convertedClaimId?: string | null;
  createdAt: string;
  updatedAt: string;
};

type CustomerOpt = { id: string; fullName: string };
type PolicyOpt = {
  id: string;
  policyNumber: string;
  status: string;
  customerId: string;
  endDate: string;
  insurer?: { id: string; name: string; code?: string | null } | null;
};

const TYPES = ["AUTO", "HOGAR", "VIDA", "OTRO"] as const;

/** Postgres UUID / cualquier variante hex común en seeds demo */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  if (!s || !UUID_RE.test(s)) return undefined;
  return s;
}

function formatEventDatetimeForInput(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.trim();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoEventDatetime(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function normalizeDraftFromApi(d: ClaimDraft): ClaimDraft {
  return { ...d, eventDatetime: formatEventDatetimeForInput(d.eventDatetime) };
}

/**
 * Primero sólo ACTIVE (menos datos). Si no hay ninguna, o hay policyId que no aparece en la lista ACTIVE, pide listado completo.
 */
async function fetchPoliciesForCustomerLazy(
  tenantId: string,
  customerId: string,
  policyIdHint?: string | null,
): Promise<PolicyOpt[]> {
  const enc = encodeURIComponent(customerId.trim());
  const activeRes = await apiFetch(`/policies?customerId=${enc}&status=ACTIVE`, undefined, tenantId);
  let list: PolicyOpt[] = [];
  if (activeRes.ok) {
    try {
      const j = await activeRes.json();
      list = Array.isArray(j) ? (j as PolicyOpt[]) : [];
    } catch {
      list = [];
    }
  }
  const needFull =
    list.length === 0 ||
    (!!policyIdHint && String(policyIdHint).trim() !== "" && !list.some((p) => p.id === policyIdHint));
  if (needFull) {
    const fullRes = await apiFetch(`/policies?customerId=${enc}`, undefined, tenantId);
    if (fullRes.ok) {
      try {
        const j = await fullRes.json();
        if (Array.isArray(j)) list = j as PolicyOpt[];
      } catch {
        /* keep previous */
      }
    }
  }
  return list;
}

export default function ClaimDraftPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [draft, setDraft] = useState<ClaimDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [policies, setPolicies] = useState<PolicyOpt[]>([]);
  const [policiesMode, setPoliciesMode] = useState<"ACTIVE_ONLY" | "ALL">("ACTIVE_ONLY");
  const [chatBusy, setChatBusy] = useState(false);
  const formDirtyRef = useRef(false);

  const missing = useMemo(() => (draft?.missingFields ?? []).filter(Boolean), [draft?.missingFields]);
  const activePolicies = useMemo(() => policies.filter((p) => p.status === "ACTIVE"), [policies]);
  const selectedPolicy = useMemo(
    () => policies.find((p) => p.id === (draft?.policyId ?? "").trim()) ?? null,
    [policies, draft?.policyId],
  );
  const approvalBlockedReason = useMemo(() => {
    if (!draft || draft.status !== "DRAFT") return null;
    const customerId = (draft.customerId ?? "").trim();
    const policyId = uuidField(draft.policyId);
    if (customerId && !policyId && activePolicies.length > 1) {
      return "El cliente tiene varias pólizas activas; elegí cuál aplica antes de aprobar.";
    }
    if (policyId && selectedPolicy && selectedPolicy.status !== "ACTIVE") {
      return "La póliza seleccionada no está ACTIVE; no se puede crear el siniestro.";
    }
    return null;
  }, [draft, activePolicies.length, selectedPolicy]);
  const canApprove = useMemo(
    () => draft?.status === "DRAFT" && !busy && missing.length === 0 && !approvalBlockedReason,
    [draft?.status, busy, missing.length, approvalBlockedReason],
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [dr, cr] = await Promise.all([
        apiFetch(`/claims/drafts/${id}`, undefined, tenantId),
        apiFetch("/customers", undefined, tenantId),
      ]);
      if (!dr.ok) throw new Error(await dr.text());
      const loaded = normalizeDraftFromApi((await dr.json()) as ClaimDraft);
      setDraft((prev) => {
        if (!prev || !formDirtyRef.current) return loaded;
        return {
          ...loaded,
          eventDatetime: prev.eventDatetime ?? loaded.eventDatetime,
          eventLocation: prev.eventLocation ?? loaded.eventLocation,
          narrative: prev.narrative ?? loaded.narrative,
          type: prev.type ?? loaded.type,
          customerId: prev.customerId ?? loaded.customerId,
          policyId: prev.policyId ?? loaded.policyId,
        };
      });
      if (cr.ok) setCustomers((await cr.json()) as CustomerOpt[]);
      if (loaded.customerId) {
        setPolicies(await fetchPoliciesForCustomerLazy(tenantId, loaded.customerId, loaded.policyId));
        setPoliciesMode("ACTIVE_ONLY");
      } else {
        setPolicies([]);
        setPoliciesMode("ACTIVE_ONLY");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando borrador");
      setDraft(null);
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

  useEffect(() => {
    if (!id || draft?.status !== "DRAFT" || !draft.sourceConversationId) return;
    const timer = window.setInterval(() => {
      void load();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [id, draft?.status, draft?.sourceConversationId, load]);

  async function patch(body: Record<string, unknown>) {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/claims/drafts/${id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      const saved = normalizeDraftFromApi((await res.json()) as ClaimDraft);
      setDraft(saved);
      formDirtyRef.current = false;
      if ("customerId" in body) {
        const cid = typeof saved.customerId === "string" ? saved.customerId.trim() : "";
        if (cid) {
          setPolicies(await fetchPoliciesForCustomerLazy(tenantId, cid, saved.policyId));
          setPoliciesMode("ACTIVE_ONLY");
        } else {
          setPolicies([]);
          setPoliciesMode("ACTIVE_ONLY");
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando borrador");
    } finally {
      setBusy(false);
    }
  }

  async function showAllPolicies() {
    if (!draft?.customerId) return;
    const cid = draft.customerId.trim();
    if (!cid) return;
    setBusy(true);
    setError(null);
    try {
      const enc = encodeURIComponent(cid);
      const res = await apiFetch(`/policies?customerId=${enc}`, undefined, tenantId);
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      setPolicies(Array.isArray(j) ? (j as PolicyOpt[]) : []);
      setPoliciesMode("ALL");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando pólizas");
    } finally {
      setBusy(false);
    }
  }

  async function showActiveOnlyPolicies() {
    if (!draft?.customerId) return;
    const cid = draft.customerId.trim();
    if (!cid) return;
    setBusy(true);
    setError(null);
    try {
      setPolicies(await fetchPoliciesForCustomerLazy(tenantId, cid, draft.policyId));
      setPoliciesMode("ACTIVE_ONLY");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando pólizas");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!id) return;
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      // Asegura persistir lo que el usuario tipeó aunque no haya hecho blur.
      const patchBody: Record<string, unknown> = {};
      const cid = uuidField(draft.customerId);
      const pid = uuidField(draft.policyId);
      if (cid) patchBody.customerId = cid;
      if (pid) patchBody.policyId = pid;
      const typ = (draft.type ?? "").trim();
      if (typ) patchBody.type = typ;
      const edt = toIsoEventDatetime(draft.eventDatetime);
      if (edt) patchBody.eventDatetime = edt;
      const eloc = (draft.eventLocation ?? "").trim();
      if (eloc) patchBody.eventLocation = eloc;
      const nar = (draft.narrative ?? "").trim();
      if (nar) patchBody.narrative = nar;

      const pr = await apiFetch(
        `/claims/drafts/${id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patchBody) },
        tenantId,
      );
      if (!pr.ok) throw new Error(await pr.text());
      const updated = normalizeDraftFromApi((await pr.json()) as ClaimDraft);
      setDraft(updated);

      const res = await apiFetch(`/claims/drafts/${id}/approve`, { method: "POST" }, tenantId);
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { claim: { id: string }; draft: ClaimDraft };
      setDraft(j.draft);
      router.push(`/claims/${j.claim.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error aprobando borrador");
    } finally {
      setBusy(false);
    }
  }

  async function promptNextByChat() {
    if (!id) return;
    setChatBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/claims/drafts/${id}/intake/prompt-next`, { method: "POST" }, tenantId);
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error enviando pregunta al chat");
    } finally {
      setChatBusy(false);
    }
  }

  const backToConversationHref = useMemo(() => {
    const cid = draft?.sourceConversationId ?? searchParams.get("conversationId");
    if (!cid) return "/inbox";
    const q = new URLSearchParams({ conversationId: cid });
    if (draft?.customerId) q.set("customerId", draft.customerId);
    return `/inbox?${q.toString()}`;
  }, [draft?.sourceConversationId, draft?.customerId, searchParams]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-sky-400/90">Operación</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Borrador de siniestro
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">{id || "—"}</p>
        </div>
        <div className="card-surface w-full max-w-sm shrink-0 p-4">
          <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Tenant ID
          </label>
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="input-producer mt-1 w-full" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => load()} className="text-sm text-emerald-400 hover:text-emerald-300">
              Recargar
            </button>
            <Link href={backToConversationHref} className="text-sm text-slate-400 hover:text-slate-200">
              ← Volver a Inbox
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      {loading && !draft && <div className="text-sm text-slate-500">Cargando…</div>}

      {draft && (
        <>
          {draft.status !== "DRAFT" && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Estado del borrador: <span className="font-semibold">{draft.status}</span>
              {draft.convertedClaimId ? (
                <>
                  {" "}
                  ·{" "}
                  <Link href={`/claims/${draft.convertedClaimId}`} className="text-sky-300 hover:text-sky-200">
                    Ver siniestro
                  </Link>
                </>
              ) : null}
            </div>
          )}

          {missing.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Faltan campos para aprobar: <span className="font-mono text-xs">{missing.join(", ")}</span>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card-surface space-y-4 p-5">
              <h2 className="text-sm font-semibold text-slate-200">Datos del siniestro</h2>

              <div>
                <label className="block text-[11px] uppercase text-slate-500">Cliente</label>
                <select
                  className="input-producer mt-1 w-full py-2 text-sm"
                  value={(draft.customerId ?? "").trim()}
                  disabled={busy || draft.status !== "DRAFT"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((p) => (p ? { ...p, customerId: v || null } : p));
                    // backend intenta autocompletar policyId si hay 1 ACTIVE
                    patch({ customerId: v || undefined });
                  }}
                >
                  <option value="">— Seleccionar… —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
                <div className="mt-1 font-mono text-[11px] text-slate-500">{draft.customerId ?? "—"}</div>
              </div>

              <div>
                <label className="block text-[11px] uppercase text-slate-500">Póliza</label>
                <select
                  className="input-producer mt-1 w-full py-2 text-sm"
                  value={(draft.policyId ?? "").trim()}
                  disabled={busy || draft.status !== "DRAFT" || !(draft.customerId ?? "").trim()}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((p) => (p ? { ...p, policyId: v || null } : p));
                    patch({ policyId: v || undefined });
                  }}
                >
                  <option value="">
                    {draft.customerId ? "— Seleccionar… —" : "Primero elegí un cliente"}
                  </option>
                  {policies.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.status !== "ACTIVE"}>
                      {p.policyNumber}
                      {p.insurer?.name ? ` · ${p.insurer.name}` : ""}
                      {` · ${p.status} · fin ${p.endDate}`}
                    </option>
                  ))}
                </select>
                <div className="mt-1 font-mono text-[11px] text-slate-500">{draft.policyId ?? "—"}</div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {policiesMode !== "ALL" ? (
                    <button
                      type="button"
                      disabled={busy || !(draft.customerId ?? "").trim()}
                      onClick={showAllPolicies}
                      className="text-xs font-semibold text-sky-400 hover:text-sky-300 disabled:opacity-50"
                    >
                      Mostrar todas las pólizas
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || !(draft.customerId ?? "").trim()}
                      onClick={showActiveOnlyPolicies}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50"
                    >
                      Volver a pólizas activas
                    </button>
                  )}
                  <span className="text-[11px] text-slate-500">
                    {policiesMode === "ALL" ? "Mostrando: todas" : "Mostrando: solo ACTIVE"}
                  </span>
                </div>
                {draft.customerId && activePolicies.length > 1 && !(draft.policyId ?? "").trim() && (
                  <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    Este cliente tiene {activePolicies.length} pólizas activas. Elegí la que corresponde al hecho.
                  </div>
                )}
                {draft.customerId && policiesMode === "ALL" && policies.some((p) => p.status !== "ACTIVE") && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    Las pólizas no <span className="font-semibold text-slate-300">ACTIVE</span> aparecen abajo y están{" "}
                    <span className="font-semibold text-slate-300">deshabilitadas</span>.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] uppercase text-slate-500">Tipo</label>
                  <select
                    className="input-producer mt-1 w-full py-2 text-sm"
                    value={draft.type ?? ""}
                    onChange={(e) => {
                      const v = e.target.value || null;
                      setDraft((p) => (p ? { ...p, type: v } : p));
                      patch({ type: v || undefined });
                    }}
                    disabled={busy || draft.status !== "DRAFT"}
                  >
                    <option value="">—</option>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase text-slate-500">Fecha y hora</label>
                  <input
                    type="datetime-local"
                    className="input-producer mt-1 w-full"
                    value={draft.eventDatetime ?? ""}
                    onChange={(e) => {
                      formDirtyRef.current = true;
                      setDraft((p) => (p ? { ...p, eventDatetime: e.target.value } : p));
                    }}
                    disabled={busy || draft.status !== "DRAFT"}
                    onBlur={() => patch({ eventDatetime: toIsoEventDatetime(draft.eventDatetime) })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase text-slate-500">Lugar</label>
                <input
                  className="input-producer mt-1 w-full"
                  value={draft.eventLocation ?? ""}
                  onChange={(e) => {
                    formDirtyRef.current = true;
                    setDraft((p) => (p ? { ...p, eventLocation: e.target.value } : p));
                  }}
                  disabled={busy || draft.status !== "DRAFT"}
                  placeholder="Ciudad / barrio / dirección"
                  onBlur={() => patch({ eventLocation: (draft.eventLocation ?? "").trim() || undefined })}
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase text-slate-500">Relato</label>
                <textarea
                  className="input-producer mt-1 w-full min-h-[140px] resize-y"
                  value={draft.narrative ?? ""}
                  onChange={(e) => {
                    formDirtyRef.current = true;
                    setDraft((p) => (p ? { ...p, narrative: e.target.value } : p));
                  }}
                  disabled={busy || draft.status !== "DRAFT"}
                  placeholder="Qué pasó…"
                  onBlur={() => patch({ narrative: (draft.narrative ?? "").trim() || undefined })}
                />
              </div>
            </div>

            <div className="card-surface space-y-4 p-5">
              <h2 className="text-sm font-semibold text-slate-200">Acciones</h2>
              <div className="space-y-2 text-sm text-slate-400">
                <div>
                  Estado: <span className="text-slate-200">{draft.status}</span>
                </div>
                <div className="font-mono text-xs">
                  Source conversation: {draft.sourceConversationId ?? "—"}
                </div>
              </div>

              <button
                type="button"
                disabled={!canApprove}
                onClick={approve}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Aprobar y crear siniestro
              </button>

              {!canApprove && approvalBlockedReason && (
                <p className="text-xs text-amber-200/90">{approvalBlockedReason}</p>
              )}

              {!canApprove && draft.status === "DRAFT" && !approvalBlockedReason && (
                <p className="text-xs text-slate-500">
                  Para aprobar, completá los campos requeridos (según configuración del tenant).
                </p>
              )}

              <div className="pt-2">
                {draft.sourceConversationId && missing.length > 0 && (
                  <p className="mb-2 text-xs text-slate-500">
                    Las respuestas del cliente en el chat vinculado completan este borrador y disparan la siguiente
                    pregunta automáticamente.
                  </p>
                )}
                <button
                  type="button"
                  disabled={chatBusy || !draft.sourceConversationId || missing.length === 0}
                  onClick={promptNextByChat}
                  className="w-full rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                  title="Envía al chat la próxima pregunta del intake según configuración"
                >
                  Pedir siguiente dato por chat
                </button>
                {!draft.sourceConversationId && (
                  <p className="mt-2 text-xs text-slate-500">Este borrador no está vinculado a una conversación.</p>
                )}
                {missing.length === 0 && (
                  <p className="mt-2 text-xs text-slate-500">No hay campos requeridos pendientes.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

