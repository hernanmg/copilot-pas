"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DEFAULT_TENANT_ID, readSession } from "@/lib/session";

type RagStats = {
  tenantId: string;
  totalDocuments: number;
  totalChunks: number;
  byScope: { scope: string; documents: number; chunks: number }[];
};

type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  scope: string;
  content: string;
  score: number;
  chunkIndex: number;
  documentTitle?: string;
  sourceRef?: string;
  embeddingModel: string;
};

const DEMO_DOC = {
  title: "FAQ demo — cobertura granizo",
  scope: "FAQ",
  sourceType: "MANUAL_NOTE",
  sourceRef: "demo-faq-granizo-2026",
  fullText: `Pregunta: ¿La póliza cubre daños por granizo en el vehículo?
Respuesta: Sí, la cobertura todo riesgo con cláusula de fenómenos naturales incluye granizo, siempre que el siniestro se denuncie dentro de las 72 horas y se aporten fotos del vehículo y del entorno.

Pregunta: ¿Qué documentación pide la aseguradora?
Respuesta: Fotos del daño, denuncia policial si hubo terceros, y el formulario de siniestro firmado por el titular.

Pregunta: ¿Hay franquicia?
Respuesta: En la póliza demo aplica una franquicia fija de ARS 50.000 para granizo, salvo que el productor haya negociado endoso sin franquicia.`,
};

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export default function RagAdminPage() {
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [stats, setStats] = useState<RagStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [indexNotice, setIndexNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("¿La póliza cubre granizo y qué documentación piden?");
  const [retrieving, setRetrieving] = useState(false);
  const [retrieveError, setRetrieveError] = useState<string | null>(null);
  const [chunks, setChunks] = useState<RetrievedChunk[]>([]);
  const [retrieveLatencyMs, setRetrieveLatencyMs] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/rag/stats", undefined, tenantId);
      if (!res.ok) throw new Error(await res.text());
      setStats((await res.json()) as RagStats);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
      setStats(null);
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

  async function indexDemo() {
    setIndexing(true);
    setIndexNotice(null);
    setRetrieveError(null);
    try {
      const res = await apiFetch(
        "/rag/index",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: DEMO_DOC.scope,
            sourceType: DEMO_DOC.sourceType,
            sourceRef: DEMO_DOC.sourceRef,
            title: DEMO_DOC.title,
            fullText: DEMO_DOC.fullText,
            embeddingModel: DEFAULT_EMBEDDING_MODEL,
          }),
        },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { documentId: string; chunkCount: number };
      setIndexNotice(`Documento indexado (${j.chunkCount} chunks). ID ${j.documentId}`);
      await load();
    } catch (e: unknown) {
      setIndexNotice(null);
      setRetrieveError(e instanceof Error ? e.message : "Error indexando demo");
    } finally {
      setIndexing(false);
    }
  }

  async function runRetrieve() {
    setRetrieving(true);
    setRetrieveError(null);
    setChunks([]);
    setRetrieveLatencyMs(null);
    try {
      const res = await apiFetch(
        "/rag/retrieve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: query.trim(),
            filters: { scopes: ["FAQ", "PLAYBOOK", "POLICY_DOCUMENT", "GENERIC_KB"] },
            topK: 5,
            embeddingModel: DEFAULT_EMBEDDING_MODEL,
            audit: { actorType: "USER", skipPersistence: true },
          }),
        },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { chunks: RetrievedChunk[]; latencyMs: number };
      setChunks(j.chunks ?? []);
      setRetrieveLatencyMs(j.latencyMs ?? null);
    } catch (e: unknown) {
      setRetrieveError(e instanceof Error ? e.message : "Error en retrieve");
    } finally {
      setRetrieving(false);
    }
  }

  return (
    <div className="dashboard-main space-y-8">
      <header className="border-b border-slate-800/80 pb-6">
        <p className="section-kicker">Calidad del copiloto</p>
        <h1 className="section-title mt-2 text-3xl font-bold text-white md:text-4xl">
          Conocimiento (RAG)
        </h1>
        <p className="section-sub mt-3 max-w-2xl text-slate-400">
          Estadísticas por scope en Postgres y panel demo para indexar un FAQ y probar recuperación semántica.
        </p>
      </header>

      <div className="dashboard-section-panel max-w-lg space-y-3">
        <label className="kpi-label">Tenant ID</label>
        <input
          className="input-producer mt-1 w-full font-mono text-sm"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
        />
        <button
          type="button"
          onClick={() => load()}
          className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
        >
          Recargar stats
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/45 bg-amber-950/35 px-4 py-3 text-sm text-amber-50">
          {error}{" "}
          <span className="text-slate-500">
            (¿Corriste <code className="rounded bg-black/30 px-1">002-rag-pgvector.sql</code>?)
          </span>
        </div>
      )}

      {stats && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-slate-500">Documentos</span>{" "}
              <span className="text-xl font-bold text-white">{stats.totalDocuments}</span>
            </div>
            <div>
              <span className="text-slate-500">Chunks</span>{" "}
              <span className="text-xl font-bold text-white">{stats.totalChunks}</span>
            </div>
          </div>

          <div className="dashboard-section-panel overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-slate-950/60 text-left text-xs font-bold uppercase text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Scope</th>
                    <th className="px-5 py-3">Documentos</th>
                    <th className="px-5 py-3">Chunks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {stats.byScope.map((r) => (
                    <tr key={r.scope}>
                      <td className="px-5 py-3 font-mono text-violet-200/90">{r.scope}</td>
                      <td className="px-5 py-3 text-slate-300">{r.documents}</td>
                      <td className="px-5 py-3 text-slate-300">{r.chunks}</td>
                    </tr>
                  ))}
                  {!loading && stats.byScope.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-10 text-center text-slate-500">
                        Sin datos indexados para este tenant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {loading && !stats && <p className="text-sm text-slate-500">Cargando…</p>}

      <div className="dashboard-section-panel space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Escenario demo</h2>
        <p className="text-sm text-slate-400">
          Indexá un FAQ de granizo y probá una consulta. Requiere embeddings configurados (
          <code className="rounded bg-slate-800 px-1 text-xs">OPENAI_API_KEY</code> u{" "}
          <code className="rounded bg-slate-800 px-1 text-xs">RAG_EMBEDDINGS_PROVIDER=OLLAMA</code>).
        </p>
        <pre className="max-h-48 overflow-auto rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 text-xs text-slate-300 whitespace-pre-wrap">
          {DEMO_DOC.fullText}
        </pre>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={indexDemo}
            disabled={indexing}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {indexing ? "Indexando…" : "Indexar FAQ demo"}
          </button>
        </div>
        {indexNotice && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {indexNotice}
          </div>
        )}

        <div className="space-y-2 pt-2">
          <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Consulta de prueba
          </label>
          <textarea
            className="input-producer min-h-[88px] w-full resize-y"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            onClick={runRetrieve}
            disabled={retrieving || !query.trim()}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          >
            {retrieving ? "Recuperando…" : "Probar retrieve"}
          </button>
        </div>

        {retrieveError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {retrieveError}
          </div>
        )}

        {retrieveLatencyMs !== null && (
          <p className="text-xs text-slate-500">Latencia retrieve: {retrieveLatencyMs} ms</p>
        )}

        {chunks.length > 0 && (
          <div className="space-y-3">
            {chunks.map((c) => (
              <article
                key={c.chunkId}
                className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono text-violet-300/90">{c.scope}</span>
                  <span>score {c.score.toFixed(3)}</span>
                  {c.documentTitle ? <span>{c.documentTitle}</span> : null}
                </div>
                <p className="whitespace-pre-wrap text-slate-200">{c.content}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <p className="flex flex-wrap gap-4">
        <Link href="/agents" className="text-sm font-semibold text-violet-400 hover:text-violet-300">
          ← Agentes / orquestador
        </Link>
        <Link href="/" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
          Panel principal
        </Link>
      </p>
    </div>
  );
}

