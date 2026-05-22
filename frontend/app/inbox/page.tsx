"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { DEFAULT_TENANT_ID, readSession } from "@/lib/session";

type Conversation = {
  id: string;
  channel: string;
  topic?: string;
  status: string;
  updatedAt: string;
  customer?: { id: string; fullName: string } | null;
};

type Message = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  senderType: "CUSTOMER" | "PRODUCER" | "AI";
  text?: string | null;
  createdAt: string;
};

type OrchestratorChatResponse = {
  traceId: string;
  intent: string;
  agent: string;
  draftMessages: string[];
  rag?: { chunks: { content: string; score: number; scope: string }[] };
};

type ActiveClaimDraft = {
  id: string;
  status: string;
  missingFields?: string[] | null;
};

type IntakeFeedback = {
  draftId: string;
  captured: boolean;
  fieldLabel?: string;
  missingFields: string[];
  promptedNext: boolean;
};

type PostMessageResponse = {
  message?: Message;
  intake?: IntakeFeedback | null;
};

type ClaimDraftSummary = {
  id: string;
  status: string;
  customerId?: string | null;
  sourceConversationId?: string | null;
};

function InboxFallback() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-800" />
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <div className="card-surface h-[480px] animate-pulse bg-slate-900/50" />
        <div className="card-surface h-[480px] animate-pulse bg-slate-900/50" />
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<InboxFallback />}>
      <InboxRouteGate />
    </Suspense>
  );
}

function InboxRouteGate() {
  const searchParams = useSearchParams();
  const routeKey =
    searchParams.get("conversationId") ?? searchParams.get("customerId") ?? "inbox-default";
  return <InboxInner key={routeKey} />;
}

function InboxInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newText, setNewText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<OrchestratorChatResponse | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [customers, setCustomers] = useState<{ id: string; fullName: string }[]>([]);
  const [draftBusy, setDraftBusy] = useState(false);
  const [customerLinkId, setCustomerLinkId] = useState("");
  const [activeDraft, setActiveDraft] = useState<ActiveClaimDraft | null>(null);
  const [intakeNotice, setIntakeNotice] = useState<string | null>(null);
  const bootstrappingChatRef = useRef(false);
  const urlConversationId = searchParams.get("conversationId");
  const urlCustomerId = searchParams.get("customerId");

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  async function loadActiveDraft(conversationId: string) {
    try {
      const res = await apiFetch(
        `/claims/drafts/by-conversation/${encodeURIComponent(conversationId)}`,
        undefined,
        tenantId,
      );
      if (!res.ok) {
        setActiveDraft(null);
        return;
      }
      const data = (await res.json()) as ActiveClaimDraft | null;
      setActiveDraft(data && data.status === "DRAFT" ? data : null);
    } catch {
      setActiveDraft(null);
    }
  }

  function applyIntakeFeedback(intake: IntakeFeedback | null | undefined) {
    if (!intake) return;
    setActiveDraft({
      id: intake.draftId,
      status: "DRAFT",
      missingFields: intake.missingFields,
    });
    if (intake.captured && intake.fieldLabel) {
      const pending = intake.missingFields.length;
      setIntakeNotice(
        pending > 0
          ? `Intake: guardamos «${intake.fieldLabel}». Faltan ${pending} campo(s).`
          : `Intake: guardamos «${intake.fieldLabel}». El borrador está listo para aprobar.`,
      );
      return;
    }
    if (intake.promptedNext) {
      setIntakeNotice("Intake: enviamos la siguiente pregunta al chat.");
    }
  }

  async function loadCustomers() {
    try {
      const res = await apiFetch("/customers", undefined, tenantId);
      if (!res.ok) return;
      setCustomers((await res.json()) as { id: string; fullName: string }[]);
    } catch {
      setCustomers([]);
    }
  }

  function pickDefaultConversation(
    data: Conversation[],
    preferred: string | null,
    previous: string | null,
  ): string | null {
    if (preferred && data.some((x) => x.id === preferred)) return preferred;
    if (previous && data.some((x) => x.id === previous)) return previous;
    const unassigned = data.filter((c) => !c.customer && c.status === "OPEN");
    if (unassigned.length > 0) return unassigned[0].id;
    return data[0]?.id ?? null;
  }

  function enrichConversation(conversation: Conversation, customerId?: string | null): Conversation {
    if (conversation.customer) return conversation;
    const id = customerId?.trim() || undefined;
    if (!id) return conversation;
    const customer = customers.find((c) => c.id === id);
    return customer ? { ...conversation, customer: { id: customer.id, fullName: customer.fullName } } : conversation;
  }

  async function fetchConversationsList(): Promise<Conversation[]> {
    const q = new URLSearchParams();
    if (statusFilter.trim()) q.set("status", statusFilter.trim());
    if (channelFilter.trim()) q.set("channel", channelFilter.trim());
    const qs = q.toString();
    const res = await apiFetch(`/conversations${qs ? `?${qs}` : ""}`, undefined, tenantId);
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as Conversation[];
  }

  function applyInboxSelection(conversationId: string, customerId?: string | null) {
    setSelectedId(conversationId);
    setCustomerLinkId(customerId?.trim() || "");
    const params = new URLSearchParams({ conversationId });
    if (customerId?.trim()) params.set("customerId", customerId.trim());
    router.replace(`/inbox?${params.toString()}`);
  }

  async function loadDraftSummaries(): Promise<ClaimDraftSummary[]> {
    try {
      const res = await apiFetch("/claims/drafts", undefined, tenantId);
      if (!res.ok) return [];
      const data = (await res.json()) as ClaimDraftSummary[];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async function resolveConversationForCustomer(
    customerId: string | null,
    options?: { forceNew?: boolean },
  ): Promise<{ conversationId: string; customerId: string | null }> {
    const normalizedCustomerId = customerId?.trim() || null;
    const list = await fetchConversationsList();
    setConversations(list);

    if (options?.forceNew) {
      const conversationId = await openConversationForCustomer(normalizedCustomerId, { forceNew: true, list });
      return { conversationId, customerId: normalizedCustomerId };
    }

    if (normalizedCustomerId) {
      const open = list.find((c) => c.status === "OPEN" && c.customer?.id === normalizedCustomerId);
      if (open) return { conversationId: open.id, customerId: normalizedCustomerId };

      const drafts = await loadDraftSummaries();
      const draft = drafts.find(
        (d) =>
          d.status === "DRAFT" &&
          d.customerId === normalizedCustomerId &&
          typeof d.sourceConversationId === "string" &&
          d.sourceConversationId.trim() !== "",
      );
      if (draft?.sourceConversationId) {
        const existing = list.find((c) => c.id === draft.sourceConversationId);
        if (!existing || existing.status === "CLOSED") {
          await patchConversation({ status: "OPEN" }, { silent: true, conversationId: draft.sourceConversationId });
          const refreshed = await fetchConversationsList();
          setConversations(refreshed);
        }
        return { conversationId: draft.sourceConversationId, customerId: normalizedCustomerId };
      }
    } else {
      const unassigned = list.find((c) => c.status === "OPEN" && !c.customer);
      if (unassigned) return { conversationId: unassigned.id, customerId: null };
    }

    const conversationId = await openConversationForCustomer(normalizedCustomerId, { forceNew: false, list });
    return { conversationId, customerId: normalizedCustomerId };
  }

  async function openConversationForCustomer(
    customerId: string | null,
    options?: { forceNew?: boolean; list?: Conversation[] },
  ): Promise<string> {
    const normalizedCustomerId = customerId?.trim() || null;
    const list = options?.list ?? conversations;
    if (!options?.forceNew) {
      if (normalizedCustomerId) {
        const existing = list.find((c) => c.status === "OPEN" && c.customer?.id === normalizedCustomerId);
        if (existing) return existing.id;
      } else {
        const unassigned = list.find((c) => c.status === "OPEN" && !c.customer);
        if (unassigned) return unassigned.id;
      }
    }

    const res = await apiFetch(
      "/conversations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: "Nuevo chat",
          channel: "whatsapp",
          ...(normalizedCustomerId ? { customerId: normalizedCustomerId } : {}),
        }),
      },
      tenantId,
    );
    if (!res.ok) throw new Error(await res.text());
    const created = enrichConversation((await res.json()) as Conversation, normalizedCustomerId);
    setConversations((prev) => [created, ...prev]);
    setMessages([]);
    return created.id;
  }

  async function switchCustomerChat(customerId: string | null) {
    const normalizedCustomerId = customerId?.trim() || null;

    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const resolved = await resolveConversationForCustomer(normalizedCustomerId);
      applyInboxSelection(resolved.conversationId, resolved.customerId);
      await loadMessages(resolved.conversationId);
      await loadActiveDraft(resolved.conversationId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cambiando de chat");
      setCustomerLinkId(selectedConversation?.customer?.id ?? urlCustomerId ?? "");
    } finally {
      setLoading(false);
    }
  }

  async function patchConversation(
    body: Record<string, unknown>,
    options?: { silent?: boolean; conversationId?: string },
  ) {
    const conversationId = options?.conversationId ?? selectedId;
    if (!conversationId) return;
    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await apiFetch(
        `/conversations/${conversationId}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      await loadConversations();
      if (selectedId === conversationId) await loadMessages(conversationId);
    } catch (e: unknown) {
      if (!options?.silent) {
        setError(e instanceof Error ? e.message : "Error actualizando conversación");
      }
      throw e;
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }

  async function loadConversations() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConversationsList();
      setConversations(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando conversaciones");
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(conversationId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/conversations/${conversationId}/messages`, undefined, tenantId);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Message[];
      setMessages(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando mensajes");
    } finally {
      setLoading(false);
    }
  }

  async function ensureConversation(): Promise<string> {
    if (selectedId) return selectedId;
    const res = await apiFetch(
      "/conversations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "Nuevo chat", channel: "whatsapp" }),
      },
      tenantId,
    );
    if (!res.ok) throw new Error(await res.text());
    const c = (await res.json()) as Conversation;
    setConversations((prev) => [c, ...prev]);
    setSelectedId(c.id);
    return c.id;
  }

  async function createNewConversation() {
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const resolved = await resolveConversationForCustomer(customerLinkId.trim() || null, { forceNew: true });
      applyInboxSelection(resolved.conversationId, resolved.customerId);
      await loadMessages(resolved.conversationId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creando chat");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    const text = newText.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    try {
      const conversationId = await ensureConversation();
      const res = await apiFetch(
        `/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction: "OUTBOUND", senderType: "PRODUCER", text }),
        },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      setNewText("");
      await loadMessages(conversationId);
      await loadConversations();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error enviando mensaje");
    } finally {
      setLoading(false);
    }
  }

  async function simulateInbound(text: string) {
    const t = text.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const conversationId = await ensureConversation();
      const res = await apiFetch(
        `/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction: "INBOUND", senderType: "CUSTOMER", text: t }),
        },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      const body = (await res.json()) as PostMessageResponse | Message;
      applyIntakeFeedback("intake" in body ? body.intake : null);
      await loadMessages(conversationId);
      await loadConversations();
      await loadActiveDraft(conversationId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error simulando inbound");
    } finally {
      setLoading(false);
    }
  }

  async function simulateOutbound(text: string) {
    const t = text.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const conversationId = await ensureConversation();
      const res = await apiFetch(
        `/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction: "OUTBOUND", senderType: "PRODUCER", text: t }),
        },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      setNewText("");
      await loadMessages(conversationId);
      await loadConversations();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error enviando mensaje");
    } finally {
      setLoading(false);
    }
  }

  async function suggestReply() {
    const lastInbound = [...messages].reverse().find((m) => m.direction === "INBOUND")?.text?.trim();
    const query = lastInbound || "Necesito una sugerencia de respuesta";
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const res = await apiFetch(
        "/orchestrator/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: query,
            channel: "WEB",
            customerId: selectedConversation?.customer?.id,
          }),
        },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      setSuggestion((await res.json()) as OrchestratorChatResponse);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error pidiendo sugerencia");
    } finally {
      setLoading(false);
    }
  }

  async function createClaimDraft() {
    if (!selectedId) return;
    setDraftBusy(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/claims/drafts/from-conversation/${selectedId}`,
        { method: "POST" },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      const draft = (await res.json()) as { id: string; customerId?: string | null };
      await loadActiveDraft(selectedId);
      const q = new URLSearchParams({ conversationId: selectedId });
      const linkedCustomerId =
        draft.customerId ?? (customerLinkId.trim() || selectedConversation?.customer?.id || "");
      if (linkedCustomerId) q.set("customerId", linkedCustomerId);
      router.push(`/claims/drafts/${draft.id}?${q.toString()}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creando borrador de siniestro");
    } finally {
      setDraftBusy(false);
    }
  }

  useEffect(() => {
    const s = readSession();
    if (s?.tenantId) setTenantId(s.tenantId);
  }, []);

  useEffect(() => {
    loadConversations();
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (!urlConversationId) return;
    setSelectedId(urlConversationId);
    if (urlCustomerId) setCustomerLinkId(urlCustomerId);
    void loadMessages(urlConversationId);
    void loadActiveDraft(urlConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConversationId, urlCustomerId, tenantId]);

  useEffect(() => {
    if (urlConversationId || conversations.length === 0 || selectedId) return;
    const fallback = pickDefaultConversation(conversations, null, null);
    if (fallback) setSelectedId(fallback);
  }, [urlConversationId, conversations, selectedId]);

  useEffect(() => {
    if (selectedConversation?.customer?.id) {
      setCustomerLinkId(selectedConversation.customer.id);
    }
  }, [selectedId, selectedConversation?.customer?.id]);

  useEffect(() => {
    if (searchParams.get("conversationId") || searchParams.get("newChat") !== "1" || !tenantId) return;
    if (bootstrappingChatRef.current) return;
    bootstrappingChatRef.current = true;
    const customerId = searchParams.get("customerId")?.trim() || null;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resolved = await resolveConversationForCustomer(customerId, { forceNew: true });
        if (cancelled) return;
        applyInboxSelection(resolved.conversationId, resolved.customerId);
        await loadMessages(resolved.conversationId);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error creando chat");
        }
      } finally {
        if (!cancelled) setLoading(false);
        bootstrappingChatRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
      bootstrappingChatRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, tenantId, customers.length]);

  useEffect(() => {
    if (!selectedId || selectedId === urlConversationId) return;
    setIntakeNotice(null);
    void loadMessages(selectedId);
    void loadActiveDraft(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, urlConversationId, tenantId]);

  useEffect(() => {
    if (!autoRefresh || !selectedId) return;
    const id = window.setInterval(() => {
      if (!selectedId) return;
      void loadMessages(selectedId);
      void loadConversations();
      void loadActiveDraft(selectedId);
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, selectedId, tenantId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/90">Canal</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">Inbox</h1>
          <p className="mt-1 text-sm text-slate-400">
            Conversaciones y mensajes en DB; sugerencias del orquestador. Podés abrir un chat desde
            el panel con{" "}
            <code className="rounded bg-slate-800 px-1 text-[11px]">?conversationId=</code>.
          </p>
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
          <button
            type="button"
            onClick={() => loadConversations()}
            className="mt-2 text-sm text-emerald-400 hover:text-emerald-300"
          >
            Recargar
          </button>
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto refresco (3s)
          </label>
        </div>
      </div>

      {intakeNotice && (
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          {intakeNotice}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(260px,320px)_1fr]">
        <div className="card-surface flex max-h-[min(560px,70vh)] flex-col overflow-hidden">
          <div className="border-b border-slate-800/80 px-3 py-2.5 text-sm font-semibold text-slate-200">
            Conversaciones
          </div>
          <div className="border-b border-slate-800/80 px-3 py-2 space-y-2 bg-slate-950/30">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase text-slate-500">Estado</label>
                <select
                  className="input-producer mt-0.5 w-full py-1.5 text-xs"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="OPEN">OPEN</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-500">Canal</label>
                <input
                  className="input-producer mt-0.5 w-full py-1.5 text-xs"
                  placeholder="whatsapp"
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadConversations()}
              className="w-full rounded-lg bg-slate-800 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              Aplicar filtros
            </button>
          </div>
          <button
            type="button"
            onClick={createNewConversation}
            className="border-b border-slate-800/80 bg-slate-950/40 px-3 py-2.5 text-left text-sm text-emerald-400 transition hover:bg-slate-800/50"
          >
            + Nuevo chat
          </button>
          <div className="flex-1 divide-y divide-slate-800/80 overflow-y-auto">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => applyInboxSelection(c.id, c.customer?.id ?? null)}
                className={[
                  "w-full px-3 py-2.5 text-left text-sm transition",
                  c.id === selectedId ? "bg-emerald-500/10 ring-1 ring-emerald-500/20" : "hover:bg-slate-800/40",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-slate-100">
                    {c.customer?.fullName ?? c.topic ?? "Sin título"}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{c.status}</span>
                </div>
                <div className="truncate font-mono text-[11px] text-slate-500">{c.id}</div>
              </button>
            ))}
            {conversations.length === 0 && (
              <div className="px-3 py-6 text-sm text-slate-500">No hay conversaciones.</div>
            )}
          </div>
        </div>

        <div className="card-surface flex max-h-[min(560px,70vh)] flex-col overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-slate-800/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm font-semibold text-slate-100">
              {selectedConversation?.customer?.fullName ??
                selectedConversation?.topic ??
                "Conversación"}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={createClaimDraft}
                disabled={!selectedId || loading || draftBusy}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                title="Crea un borrador de siniestro desde este chat"
              >
                Crear siniestro
              </button>
              <select
                className="input-producer max-w-[200px] py-1.5 text-xs"
                disabled={loading || !selectedId}
                value={customerLinkId}
                onChange={(e) => {
                  void switchCustomerChat(e.target.value === "" ? null : e.target.value);
                }}
              >
                <option value="">Sin cliente</option>
                {customers.map((cu) => (
                  <option key={cu.id} value={cu.id}>
                    {cu.fullName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => patchConversation({ status: "CLOSED" })}
                disabled={loading || !selectedId || selectedConversation?.status === "CLOSED"}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={suggestReply}
                disabled={loading || !selectedId}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                Sugerir respuesta
              </button>
              <button
                type="button"
                onClick={() => simulateInbound("Hola! Tengo una consulta…")}
                disabled={loading || !selectedId}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                title="Simula un mensaje entrante del cliente (dev)"
              >
                + Inbound
              </button>
            </div>
          </div>

          {activeDraft && (
            <div className="border-b border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-100">
              Borrador de siniestro activo:{" "}
              <Link href={`/claims/drafts/${activeDraft.id}`} className="font-semibold text-sky-300 hover:text-sky-200">
                abrir borrador
              </Link>
              {(activeDraft.missingFields ?? []).length > 0 ? (
                <span className="text-sky-200/80">
                  {" "}
                  · faltan {(activeDraft.missingFields ?? []).length} campo(s)
                </span>
              ) : (
                <span className="text-emerald-300"> · listo para aprobar</span>
              )}
            </div>
          )}

          <div className="flex-1 space-y-2 overflow-y-auto bg-slate-950/30 p-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={[
                  "max-w-[85%] rounded-xl border px-3 py-2 text-sm",
                  m.direction === "INBOUND"
                    ? "border-slate-800/80 bg-slate-900/50"
                    : "ml-auto border-emerald-900/50 bg-emerald-950/30",
                ].join(" ")}
              >
                <div className="mb-1 text-[11px] text-slate-500">
                  {m.senderType} · {new Date(m.createdAt).toLocaleString()}
                </div>
                <div className="whitespace-pre-wrap text-slate-200">{m.text ?? ""}</div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="text-sm text-slate-500">Sin mensajes todavía.</div>
            )}
          </div>

          <div className="border-t border-slate-800/80 bg-slate-950/40 p-3">
            <div className="flex gap-2">
              <input
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Escribir mensaje (productor)"
                className="input-producer flex-1"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={loading}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      </div>

      {suggestion && (
        <div className="card-surface overflow-hidden">
          <div className="border-b border-slate-800/80 px-3 py-2.5 text-sm font-semibold text-slate-200">
            Sugerencia ({suggestion.intent} · {suggestion.agent})
          </div>
          <div className="grid grid-cols-1 gap-4 bg-slate-950/20 p-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Borradores
              </div>
              <ul className="space-y-2">
                {suggestion.draftMessages.map((d, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-sm"
                  >
                    <div className="mb-2 text-slate-200">{d}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNewText(d)}
                        className="rounded-md bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
                      >
                        Usar
                      </button>
                      <button
                        type="button"
                        onClick={() => simulateOutbound(d)}
                        className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-slate-950"
                      >
                        Enviar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                RAG (chunks)
              </div>
              <ul className="space-y-2">
                {(suggestion.rag?.chunks ?? []).slice(0, 4).map((ch, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-xs"
                  >
                    <div className="mb-1 text-slate-400">
                      {ch.scope} · score {ch.score.toFixed(3)}
                    </div>
                    <div className="whitespace-pre-wrap text-slate-200">{ch.content.slice(0, 240)}…</div>
                  </li>
                ))}
                {(suggestion.rag?.chunks ?? []).length === 0 && (
                  <div className="text-sm text-slate-500">
                    No hay chunks. Indexá docs vía <code className="rounded bg-slate-800 px-1">/rag/index</code> y
                    configurá embeddings (OpenAI u Ollama).
                  </div>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
