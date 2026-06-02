"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { DEFAULT_TENANT_ID, readSession } from '@/lib/session';

type IntakeView = {
  sessionId: string;
  step: number;
  done: boolean;
  title: string;
  questions: { key: string; label: string; placeholder?: string }[];
  state: Record<string, any>;
};

type Customer = { id: string; fullName: string };

export default function ClaimIntakePage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [view, setView] = useState<IntakeView | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = useMemo(() => !!view?.sessionId && !loading, [view?.sessionId, loading]);

  useEffect(() => {
    const s = readSession();
    if (s?.tenantId) setTenantId(s.tenantId);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/customers', undefined, tenantId);
        if (!res.ok) return;
        setCustomers((await res.json()) as Customer[]);
      } catch {
        // ignore
      }
    })();
  }, [tenantId]);

  async function createDemoPolicy() {
    if (!view?.state?.customerId) {
      setError('Primero seleccioná un customerId válido.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        '/policies/demo',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId: view.state.customerId }),
        },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      const policy = await res.json();
      const stepRes = await apiFetch(
        `/claims/intake/${view.sessionId}/step`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ policyId: policy.id }),
        },
        tenantId,
      );
      if (!stepRes.ok) throw new Error(await stepRes.text());
      const data = (await stepRes.json()) as IntakeView;
      setView(data);
      setForm({});
    } catch (e: any) {
      setError(e?.message ?? 'Error creando póliza demo');
    } finally {
      setLoading(false);
    }
  }

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        '/claims/intake/start',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as IntakeView;
      setView(data);
      setForm({});
    } catch (e: any) {
      setError(e?.message ?? 'Error iniciando wizard');
    } finally {
      setLoading(false);
    }
  }

  async function submitStep() {
    if (!view) return;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, any> = {};
      for (const q of view.questions) {
        const v = (form[q.key] ?? '').trim();
        if (v) payload[q.key] = v;
      }
      const res = await apiFetch(
        `/claims/intake/${view.sessionId}/step`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as IntakeView;
      setView(data);
      setForm({});
    } catch (e: any) {
      setError(e?.message ?? 'Error enviando paso');
    } finally {
      setLoading(false);
    }
  }

  async function complete() {
    if (!view) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/claims/intake/${view.sessionId}/complete`, { method: 'POST' }, tenantId);
      if (!res.ok) throw new Error(await res.text());
      const claim = await res.json();
      router.push('/claims');
    } catch (e: any) {
      setError(e?.message ?? 'Error completando');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Intake de siniestro</h1>
      <p className="text-sm text-slate-400 mb-6">
        Guarda el progreso en sesión (Redis) y al final crea un borrador de siniestro en base de datos.
      </p>

      <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/30 mb-4">
        <label className="block text-xs text-slate-400 mb-1">Tenant ID</label>
        <input
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />

        <div className="mt-3 flex gap-2">
          <button
            onClick={start}
            disabled={loading}
            className="rounded-md bg-emerald-500 text-slate-900 px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Iniciar wizard
          </button>
          {view && (
            <button
              onClick={() => setView(null)}
              disabled={loading}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm disabled:opacity-50"
            >
              Reiniciar
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-400">{error}</div>}

      {!view && (
        <div className="text-sm text-slate-400">
          Tip: necesitás un cliente y una póliza existentes. Podés crearlos desde el CRM o usar los datos demo cargados en la base.
        </div>
      )}

      {view && (
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 flex items-center justify-between">
            <div className="text-sm font-semibold">
              Paso {view.step}: {view.title}
            </div>
            <div className="text-xs text-slate-400 font-mono">{view.sessionId}</div>
          </div>
          <div className="p-4 bg-slate-950">
            {view.questions.length > 0 ? (
              <div className="space-y-3">
                {view.questions.map((q) => (
                  <div key={q.key}>
                    <label className="block text-xs text-slate-400 mb-1">{q.label}</label>
                    {view.step === 1 && q.key === 'customerId' ? (
                      <select
                        value={form[q.key] ?? ''}
                        onChange={(e) => setForm((p) => ({ ...p, [q.key]: e.target.value }))}
                        className="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      >
                        <option value="">Seleccioná un cliente…</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName} ({c.id.slice(0, 8)}…)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form[q.key] ?? ''}
                        onChange={(e) => setForm((p) => ({ ...p, [q.key]: e.target.value }))}
                        placeholder={q.placeholder}
                        className="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      />
                    )}
                  </div>
                ))}
                <button
                  onClick={submitStep}
                  disabled={!canSubmit}
                  className="rounded-md bg-emerald-500 text-slate-900 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Guardar y continuar
                </button>
                {view.step === 2 && (
                  <button
                    onClick={createDemoPolicy}
                    disabled={loading}
                    className="rounded-md bg-slate-800 px-4 py-2 text-sm disabled:opacity-50"
                    title="Crea una póliza demo válida para poder continuar el intake"
                  >
                    Crear póliza demo
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="text-sm text-slate-300 mb-3">Listo para crear borrador de siniestro.</div>
                <button
                  onClick={complete}
                  disabled={loading}
                  className="rounded-md bg-emerald-500 text-slate-900 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Crear borrador de siniestro
                </button>
              </div>
            )}

            <div className="mt-4 text-xs text-slate-500">
              Estado (debug): <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(view.state, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

