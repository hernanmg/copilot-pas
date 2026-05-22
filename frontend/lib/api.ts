import { DEFAULT_TENANT_ID, readSession } from "./session";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

/**
 * Llamada al API con `x-tenant-id` y `Authorization` si hay sesión.
 * Si pasás `tenantId`, reemplaza el tenant de la sesión (útil cuando el usuario edita el campo en pantalla).
 */
export async function apiFetch(
  path: string,
  init?: RequestInit,
  tenantId?: string | null,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const s = typeof window !== "undefined" ? readSession() : null;
  const tid =
    tenantId !== undefined && tenantId !== null && tenantId.trim() !== ""
      ? tenantId.trim()
      : (s?.tenantId ?? DEFAULT_TENANT_ID);
  headers.set("x-tenant-id", tid);
  if (s?.accessToken) {
    headers.set("Authorization", `Bearer ${s.accessToken}`);
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}
