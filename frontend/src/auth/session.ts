export type Role = "CITIZEN" | "CSC_OPERATOR" | "VILLAGE_OFFICER" | "BLOCK_OFFICER" | "DISTRICT_OFFICER" | "ADMIN";

export interface Session {
  token: string;
  /**
   * Shown in the UI only. Authorization is decided by the backend from
   * DynamoDB at decision time, never from this value or from a JWT claim, so
   * nothing here is trusted for anything that matters.
   */
  displayRole: Role;
  displayName: string;
  /**
   * True when this session's token came from the local mock fallback rather
   * than a real response from the backend's /api/dev/auth endpoint (it was
   * unreachable, or returned an error). A mock session looks signed-in but
   * every real feature behind it — chat, eligibility checks, dashboards —
   * will fail, so the UI must say so rather than pretend everything works.
   */
  mock?: boolean;
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
