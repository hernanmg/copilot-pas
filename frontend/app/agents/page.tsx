"use client";

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { DEFAULT_TENANT_ID, readSession } from '@/lib/session';

const TEMPLATE_STORAGE_KEY = 'copilot-seguros-agent-templates';

type MsgTemplate = { id: string; name: string; text: string };

function readTemplates(): MsgTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const j = JSON.parse(raw) as MsgTemplate[];
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function writeTemplates(items: MsgTemplate[]) {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(items));
}

type OrchestratorChatResponse = {
  traceId: string;
  tenantId: string;
  channel: 'WEB' | 'WHATSAPP';
  intent: string;
  agent: string;
  draftMessages: string[];
  suggestedNextQuestions: string[];
};

export default function AgentsPage() {
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [message, setMessage] = useState('Necesito cotizar un seguro de auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrchestratorChatResponse | null>(null);
  const [templates, setTemplates] = useState<MsgTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    const s = readSession();
    if (s?.tenantId) setTenantId(s.tenantId);
  }, []);

  useEffect(() => {
    setTemplates(readTemplates());
  }, []);

  const canSend = useMemo(() => tenantId.trim().length > 0 && message.trim().length > 0, [tenantId, message]);

  function persistTemplates(next: MsgTemplate[]) {
    writeTemplates(next);
    setTemplates(next);
  }

  function saveCurrentAsTemplate() {
    const name = templateName.trim() || `Plantilla ${templates.length + 1}`;
    const text = message.trim();
    if (!text) return;
    const item: MsgTemplate = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      text,
    };
    persistTemplates([item, ...templates.filter((t) => t.text !== text)]);
    setTemplateName('');
  }

  function removeTemplate(id: string) {
    persistTemplates(templates.filter((t) => t.id !== id));
  }

  async function send() {
    if (!canSend) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        '/orchestrator/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, channel: 'WEB' }),
        },
        tenantId,
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as OrchestratorChatResponse;
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? 'Error llamando al orquestador');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-violet-400/90">Orquestador</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Playground de Agentes
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Llama a <code className="rounded bg-slate-800 px-1 text-[11px]">POST /orchestrator/chat</code> para
          probar intención, agente y borradores.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        <div className="card-surface p-5">
          <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Tenant ID
          </label>
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="input-producer mt-1 w-full"
            placeholder="00000000-0000-0000-0000-000000000000"
          />

          <label className="mt-4 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Mensaje
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="input-producer mt-1 w-full min-h-[100px] resize-y"
            placeholder="Escribí una consulta (venta/siniestro/póliza/soporte)"
          />

          <div className="mt-5 rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Plantillas locales (localStorage)
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="input-producer flex-1 py-2 text-sm"
                placeholder="Nombre al guardar"
              />
              <button
                type="button"
                onClick={saveCurrentAsTemplate}
                disabled={!message.trim()}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-40"
              >
                Guardar mensaje actual
              </button>
            </div>
            {templates.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {templates.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/60 bg-slate-900/50 px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => setMessage(t.text)}
                      className="text-left text-sm font-medium text-emerald-300 hover:text-emerald-200"
                    >
                      {t.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTemplate(t.id)}
                      className="text-xs text-slate-500 hover:text-rose-400"
                    >
                      Borrar
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Todavía no hay plantillas guardadas en este navegador.</p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={send}
              disabled={!canSend || loading}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Enviando…" : "Enviar al orquestador"}
            </button>
            {error && <span className="text-sm text-red-400">{error}</span>}
          </div>
        </div>

        {result && (
          <div className="card-surface overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-800/80 bg-slate-950/40 px-4 py-3 text-sm">
              <span className="text-slate-500">trace</span>
              <span className="font-mono text-xs text-slate-300">{result.traceId}</span>
              <span className="text-slate-500">intent</span>
              <span className="rounded-md bg-slate-800 px-2 py-0.5">{result.intent}</span>
              <span className="text-slate-500">agent</span>
              <span className="rounded-md bg-slate-800 px-2 py-0.5">{result.agent}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              <div>
                <h2 className="mb-2 text-sm font-semibold text-slate-200">Borradores (WhatsApp)</h2>
                <ul className="space-y-2">
                  {result.draftMessages.map((m, idx) => (
                    <li
                      key={idx}
                      className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 text-sm text-slate-200"
                    >
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="mb-2 text-sm font-semibold text-slate-200">Preguntas sugeridas</h2>
                <ul className="space-y-2">
                  {result.suggestedNextQuestions.map((q, idx) => (
                    <li
                      key={idx}
                      className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 text-sm text-slate-300"
                    >
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

