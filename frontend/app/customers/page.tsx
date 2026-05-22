"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DEFAULT_TENANT_ID, readSession } from "@/lib/session";

type CustomerRow = {
  id: string;
  fullName?: string;
  documentType?: string | null;
  documentNumber?: string | null;
  email?: string | null;
  phoneWhatsapp?: string | null;
  createdAt?: string;
};

type FormState = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phoneWhatsapp: string;
};

const emptyForm = (): FormState => ({
  fullName: "",
  documentType: "",
  documentNumber: "",
  email: "",
  phoneWhatsapp: "",
});

function rowToForm(c: CustomerRow): FormState {
  return {
    fullName: c.fullName || "",
    documentType: c.documentType || "",
    documentNumber: c.documentNumber || "",
    email: c.email || "",
    phoneWhatsapp: c.phoneWhatsapp || "",
  };
}

function matchesSearch(c: CustomerRow, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const fields = [
    c.fullName,
    c.email,
    c.phoneWhatsapp,
    c.documentNumber,
    c.documentType,
    c.id,
  ];
  return fields.some((f) => (f || "").toLowerCase().includes(s));
}

export default function CustomersPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<{
    mode: "create" | "edit";
    id?: string;
    form: FormState;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/customers", undefined, tenantId);
      if (!res.ok) throw new Error(await res.text());
      setRows(((await res.json()) as CustomerRow[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando clientes");
      setRows([]);
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

  const filtered = useMemo(
    () => rows.filter((c) => matchesSearch(c, query)),
    [rows, query],
  );

  function openCreate() {
    setError(null);
    setModal({ mode: "create", form: emptyForm() });
  }

  function openEdit(c: CustomerRow) {
    setError(null);
    setModal({ mode: "edit", id: c.id, form: rowToForm(c) });
  }

  async function submitModal() {
    if (!modal) return;
    const { fullName, documentType, documentNumber, email, phoneWhatsapp } = modal.form;
    if (!fullName.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (modal.mode === "create") {
        const res = await apiFetch(
          "/customers",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fullName: fullName.trim(),
              documentType: documentType.trim() || undefined,
              documentNumber: documentNumber.trim() || undefined,
              email: email.trim() || undefined,
              phoneWhatsapp: phoneWhatsapp.trim() || undefined,
            }),
          },
          tenantId,
        );
        if (!res.ok) throw new Error(await res.text());
        const created = (await res.json()) as CustomerRow;
        const convRes = await apiFetch(
          "/conversations",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: "Nuevo chat",
              channel: "whatsapp",
              customerId: created.id,
            }),
          },
          tenantId,
        );
        if (!convRes.ok) throw new Error(await convRes.text());
        const conversation = (await convRes.json()) as { id: string };
        setModal(null);
        await load();
        router.push(`/inbox?conversationId=${encodeURIComponent(conversation.id)}`);
        return;
      } else if (modal.id) {
        const res = await apiFetch(
          `/customers/${modal.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fullName: fullName.trim(),
              documentType: documentType.trim(),
              documentNumber: documentNumber.trim(),
              email: email.trim(),
              phoneWhatsapp: phoneWhatsapp.trim(),
            }),
          },
          tenantId,
        );
        if (!res.ok) throw new Error(await res.text());
      }
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function removeCustomer(c: CustomerRow) {
    const ok = window.confirm(
      `¿Eliminar a ${c.fullName || "este cliente"}? Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    setError(null);
    try {
      const res = await apiFetch(`/customers/${c.id}`, { method: "DELETE" }, tenantId);
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  return (
    <div className="dashboard-main space-y-8">
      <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="section-kicker">CRM</p>
          <h1 className="section-title mt-2 text-3xl font-bold text-white md:text-4xl">Clientes</h1>
          <p className="section-sub mt-3 max-w-xl">
            Cartera del tenant. Alta, edición y baja. El listado respeta{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px]">x-tenant-id</code>.
          </p>
        </div>
        <div className="card-surface w-full max-w-sm shrink-0 p-4">
          <label className="kpi-label">Tenant ID</label>
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="input-producer mt-2 w-full"
          />
          <button
            type="button"
            onClick={() => load()}
            className="mt-3 text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            Recargar lista
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="card-surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-800/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              ⌕
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="input-producer w-full pl-9"
              aria-label="Buscar clientes"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-500">
              {loading ? (
                "Cargando…"
              ) : (
                <>
                  <span className="tabular-nums font-semibold text-slate-200">{filtered.length}</span>{" "}
                  de <span className="tabular-nums">{rows.length}</span>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500"
            >
              + Nuevo cliente
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-slate-800/80 bg-slate-950/50 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((c) => (
                <tr key={c.id} className="transition hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-semibold text-slate-100">{c.fullName || "—"}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {[c.documentType, c.documentNumber].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    <div className="space-y-0.5">
                      {c.email && <div>{c.email}</div>}
                      {c.phoneWhatsapp && (
                        <div className="font-mono text-xs text-slate-500">{c.phoneWhatsapp}</div>
                      )}
                      {!c.email && !c.phoneWhatsapp && "—"}
                    </div>
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-slate-500">
                    {c.id}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCustomer(c)}
                        className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    No hay clientes que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-sm">
        <Link href="/" className="font-medium text-emerald-400 hover:text-emerald-300">
          ← Volver al panel
        </Link>
      </p>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-modal-title"
        >
          <div className="card-surface max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-2xl">
            <h2 id="customer-modal-title" className="text-lg font-bold text-white">
              {modal.mode === "create" ? "Nuevo cliente" : "Editar cliente"}
            </h2>
            <div className="mt-6 space-y-4">
              <div>
                <label className="kpi-label">Nombre completo *</label>
                <input
                  className="input-producer mt-1 w-full"
                  value={modal.form.fullName}
                  onChange={(e) =>
                    setModal((m) =>
                      m ? { ...m, form: { ...m.form, fullName: e.target.value } } : m,
                    )
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="kpi-label">Tipo doc.</label>
                  <input
                    className="input-producer mt-1 w-full"
                    value={modal.form.documentType}
                    onChange={(e) =>
                      setModal((m) =>
                        m ? { ...m, form: { ...m.form, documentType: e.target.value } } : m,
                      )
                    }
                    placeholder="DNI, CUIT…"
                  />
                </div>
                <div>
                  <label className="kpi-label">Número</label>
                  <input
                    className="input-producer mt-1 w-full"
                    value={modal.form.documentNumber}
                    onChange={(e) =>
                      setModal((m) =>
                        m ? { ...m, form: { ...m.form, documentNumber: e.target.value } } : m,
                      )
                    }
                  />
                </div>
              </div>
              <div>
                <label className="kpi-label">Email</label>
                <input
                  type="email"
                  className="input-producer mt-1 w-full"
                  value={modal.form.email}
                  onChange={(e) =>
                    setModal((m) => (m ? { ...m, form: { ...m.form, email: e.target.value } } : m))
                  }
                />
              </div>
              <div>
                <label className="kpi-label">WhatsApp</label>
                <input
                  className="input-producer mt-1 w-full"
                  value={modal.form.phoneWhatsapp}
                  onChange={(e) =>
                    setModal((m) =>
                      m ? { ...m, form: { ...m.form, phoneWhatsapp: e.target.value } } : m,
                    )
                  }
                  placeholder="+54…"
                />
              </div>
            </div>
            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={submitModal}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? "Guardando…" : modal.mode === "create" ? "Crear" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
