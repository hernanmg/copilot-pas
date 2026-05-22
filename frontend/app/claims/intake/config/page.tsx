"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DEFAULT_TENANT_ID, readSession } from "@/lib/session";

const FIELD_KEYS = [
  "customerId",
  "policyId",
  "type",
  "eventDatetime",
  "eventLocation",
  "narrative",
] as const;

type FieldKey = (typeof FIELD_KEYS)[number];

type IntakeField = {
  key: FieldKey;
  label: string;
  placeholder?: string;
  required?: boolean;
};

const DEFAULT_FIELDS: IntakeField[] = [
  { key: "customerId", label: "Cliente", placeholder: "UUID del cliente", required: true },
  { key: "policyId", label: "Póliza", placeholder: "UUID de la póliza", required: true },
  { key: "type", label: "Tipo", placeholder: "AUTO / HOGAR / VIDA / OTRO", required: true },
  {
    key: "eventDatetime",
    label: "Fecha y hora",
    placeholder: "2026-04-29T10:30:00-03:00",
    required: true,
  },
  {
    key: "eventLocation",
    label: "Lugar",
    placeholder: "Ciudad / barrio / dirección aproximada",
    required: true,
  },
  { key: "narrative", label: "Relato", placeholder: "Contá en pocas líneas el hecho", required: true },
];

export default function ClaimIntakeConfigPage() {
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [fields, setFields] = useState<IntakeField[]>(DEFAULT_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch("/claims/intake/config", undefined, tenantId);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { fields: IntakeField[] };
      if (Array.isArray(data.fields) && data.fields.length > 0) {
        setFields(data.fields);
      } else {
        setFields(DEFAULT_FIELDS);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando configuración");
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

  function updateField(index: number, patch: Partial<IntakeField>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function moveField(index: number, delta: number) {
    setFields((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = fields.map((f) => ({
        key: f.key,
        label: f.label.trim(),
        placeholder: f.placeholder?.trim() || undefined,
        required: f.required !== false,
      }));
      const res = await apiFetch(
        "/claims/intake/config",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: payload }),
        },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { fields: IntakeField[] };
      setFields(data.fields);
      setNotice("Configuración guardada para este tenant.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando configuración");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-sky-400/90">Operación</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Configuración de intake
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Define qué campos exige el borrador de siniestro y el orden de las preguntas guiadas por chat.
          </p>
        </div>
        <div className="card-surface w-full max-w-sm shrink-0 p-4">
          <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Tenant ID
          </label>
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="input-producer mt-1 w-full" />
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => load()} className="text-sm text-emerald-400 hover:text-emerald-300">
              Recargar
            </button>
            <Link href="/claims" className="text-sm text-slate-400 hover:text-slate-200">
              ← Siniestros
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <div className="card-surface space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-200">Campos del intake</h2>
            <button
              type="button"
              onClick={() => setFields(DEFAULT_FIELDS)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Restaurar valores demo
            </button>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={`${field.key}-${index}`}
                className="grid gap-3 rounded-xl border border-slate-800/80 bg-slate-950/30 p-4 md:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] uppercase text-slate-500">Campo</label>
                    <select
                      className="input-producer mt-1 w-full py-2 text-sm"
                      value={field.key}
                      onChange={(e) => updateField(index, { key: e.target.value as FieldKey })}
                    >
                      {FIELD_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase text-slate-500">Etiqueta</label>
                    <input
                      className="input-producer mt-1 w-full"
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] uppercase text-slate-500">Placeholder / ayuda</label>
                    <input
                      className="input-producer mt-1 w-full"
                      value={field.placeholder ?? ""}
                      onChange={(e) => updateField(index, { placeholder: e.target.value })}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={field.required !== false}
                      onChange={(e) => updateField(index, { required: e.target.checked })}
                    />
                    Requerido para aprobar el borrador
                  </label>
                </div>
                <div className="flex flex-row items-start gap-2 md:flex-col">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveField(index, -1)}
                    className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === fields.length - 1}
                    onClick={() => moveField(index, 1)}
                    className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 disabled:opacity-40"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      )}
    </div>
  );
}
