export type Role = "CITIZEN" | "CSC_OPERATOR" | "DISTRICT_OFFICER" | "ADMIN";

export interface Session {
  token: string;
  /**
   * Shown in the UI only. Authorization is decided by the backend from
   * DynamoDB at decision time, never from this value or from a JWT claim, so
   * nothing here is trusted for anything that matters.
   */
  displayRole: Role;
  displayName: string;
}

const KEY = "yojana.session";

export function loadSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* private browsing; the session simply does not persist */
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
