"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { DEFAULT_TENANT_ID, readSession } from "@/lib/session";

type TaskRow = {
  id: string;
  type: string;
  status: string;
  title: string;
  dueAt?: string | null;
  assigneeUserId?: string | null;
};

type TeamUser = { id: string; displayName: string; email: string; role: string };

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function localInputToIso(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function TasksInner() {
  const searchParams = useSearchParams();
  const overdueOnly = searchParams.get("overdue") === "1";
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { due: string; typ: string }>>({});

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = overdueOnly ? "?overdue=1" : "";
      const res = await apiFetch(`/producer/tasks${q}`, undefined, tenantId);
      if (!res.ok) throw new Error(await res.text());
      setRows((await res.json()) as TaskRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, overdueOnly]);

  const loadTeam = useCallback(async () => {
    try {
      const res = await apiFetch("/producer/assignable-users", undefined, tenantId);
      if (!res.ok) return;
      setTeam((await res.json()) as TeamUser[]);
    } catch {
      setTeam([]);
    }
  }, [tenantId]);

  useEffect(() => {
    const s = readSession();
    if (s?.tenantId) setTenantId(s.tenantId);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const next: Record<string, { due: string; typ: string }> = {};
    for (const r of rows) {
      next[r.id] = { due: toLocalInput(r.dueAt), typ: r.type };
    }
    setEdits(next);
  }, [rows]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  async function patchTask(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await apiFetch(
        `/producer/tasks/${id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        tenantId,
      );
      if (!res.ok) throw new Error(await res.text());
      await loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="dashboard-main space-y-10">
      <header className="border-b border-slate-800/80 pb-8">
        <p className="section-kicker">Operación</p>
        <h1 className="section-title mt-2 text-3xl font-bold text-white md:text-4xl">Tareas y SLA</h1>
        <p className="section-sub mt-4 max-w-3xl text-base">
          Asignación, cierre, vencimiento y tipo vía{" "}
          <code className="rounded-lg bg-slate-800 px-2 py-0.5 text-[13px] text-emerald-200/90">
            PATCH /producer/tasks/:id
          </code>{" "}
          <code className="text-slate-500">{"{ assigneeUserId, status, dueAt, type }"}</code>.
        </p>
        <div className="section-rule mt-6 max-w-xs" />
        {overdueOnly && (
          <p className="mt-6 text-sm font-medium text-amber-100">
            Solo vencidas.{" "}
            <Link href="/tasks" className="font-semibold text-emerald-400 hover:text-emerald-300">
              Ver todas las abiertas
            </Link>
          </p>
        )}
      </header>

      <div className="dashboard-section-panel max-w-lg">
        <label className="kpi-label">Tenant ID</label>
        <input
          className="input-producer mt-2 w-full"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
        />
        <p className="mt-3 text-xs text-slate-500">
          Usuarios para el combo:{" "}
          <code className="rounded bg-slate-900 px-1 text-[11px]">GET /producer/assignable-users</code>
          {team.length === 0 ? " (vacío: creá usuarios con POST /users)" : ` (${team.length})`}
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/50 bg-amber-950/40 px-5 py-4 text-sm text-amber-100">
          {error}
        </div>
      )}

      <div className="dashboard-section-panel overflow-hidden p-0">
        <div className="border-b border-slate-700/60 px-6 py-5">
          <h2 className="text-lg font-bold text-white">
            {overdueOnly ? "Tareas con SLA vencido" : "Tareas abiertas"}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {loading ? "Cargando…" : `${rows.length} ítems`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-950/60 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-4">Estado</th>
                <th className="px-5 py-4">Tipo</th>
                <th className="px-5 py-4">Título</th>
                <th className="px-5 py-4">Vence</th>
                <th className="px-5 py-4">Editar</th>
                <th className="px-5 py-4 text-right">Asignación y cierre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/90">
              {rows.map((r) => {
                const due = r.dueAt ? new Date(r.dueAt) : null;
                const isPast = due && due.getTime() < Date.now();
                return (
                  <tr key={r.id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-slate-700/80 px-2.5 py-1 text-xs font-semibold text-slate-100">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-100">{r.type}</td>
                    <td className="px-5 py-4 text-slate-300">{r.title}</td>
                    <td className="px-5 py-4">
                      {due ? (
                        <span className={isPast ? "font-medium text-rose-300" : "text-slate-400"}>
                          {due.toLocaleString()}
                          {isPast && (
                            <span className="ml-2 rounded-md bg-rose-500/25 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-100">
                              SLA
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex min-w-[220px] flex-col gap-2">
                        <input
                          type="datetime-local"
                          className="input-producer py-1.5 text-[11px]"
                          value={edits[r.id]?.due ?? ""}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [r.id]: { due: e.target.value, typ: prev[r.id]?.typ ?? r.type },
                            }))
                          }
                        />
                        <input
                          className="input-producer py-1.5 text-[11px]"
                          placeholder="tipo"
                          value={edits[r.id]?.typ ?? r.type}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [r.id]: { due: prev[r.id]?.due ?? toLocalInput(r.dueAt), typ: e.target.value },
                            }))
                          }
                        />
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => {
                            const e0 = edits[r.id];
                            const dueIso = localInputToIso(e0?.due ?? "");
                            patchTask(r.id, {
                              dueAt: dueIso,
                              type: (e0?.typ ?? r.type).trim() || r.type,
                            });
                          }}
                          className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                        >
                          Guardar venc. / tipo
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                        <select
                          className="input-producer max-w-[200px] py-1.5 text-xs"
                          disabled={busyId === r.id}
                          value={r.assigneeUserId ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            patchTask(r.id, { assigneeUserId: v === "" ? null : v });
                          }}
                        >
                          <option value="">Sin asignar</option>
                          {team.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.displayName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => patchTask(r.id, { status: "DONE" })}
                          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
                        >
                          Completar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-slate-500">
                    No hay tareas en esta vista.
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

function Fallback() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 w-72 rounded-xl bg-slate-800" />
      <div className="h-48 rounded-2xl bg-slate-800/60" />
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <TasksInner />
    </Suspense>
  );
}
