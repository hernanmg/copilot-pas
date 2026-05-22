export const SESSION_KEY = "copilot_seguros_session";
export const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

export type StoredSession = {
  accessToken: string;
  tenantId: string;
  user: SessionUser;
};

export function readSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as StoredSession;
    if (!j?.accessToken || !j?.tenantId || !j?.user?.id) return null;
    return j;
  } catch {
    return null;
  }
}

export function writeSession(s: StoredSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
