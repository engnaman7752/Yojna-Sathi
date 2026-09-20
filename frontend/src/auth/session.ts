/**
 * The signed-in user, as this app understands them.
 *
 * `token` is the raw Cognito access token to send as `Authorization: Bearer`
 * on every backend call. `role` and `email` come from GET /api/me, which the
 * BACKEND derives from the JWT it verified - never from decoding the token
 * on the client. Route guards read from here; nothing in this object is
 * writable state the user can tamper with (localStorage is written only from
 * the /callback handler and cleared on sign-out).
 */
export type Role =
  | "CITIZEN"
  | "CSC_OPERATOR"
  | "VILLAGE_OFFICER"
  | "BLOCK_OFFICER"
  | "DISTRICT_OFFICER"
  | "ADMIN";

export interface Session {
  token: string;
  displayRole: Role;
  displayName: string;
  email?: string;
  sub: string;
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
    /* private browsing; session simply doesn't persist */
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// A citizen is the default role for anyone Cognito authenticated but who
// hasn't been placed in any group - self-signup users, until an admin
// promotes them. Never assume a higher role from absence of data.
export function pickPrimaryRole(roles: string[] | undefined): Role {
  if (!roles || roles.length === 0) return "CITIZEN";
  const precedence: Role[] = ["ADMIN", "DISTRICT_OFFICER", "BLOCK_OFFICER", "VILLAGE_OFFICER", "CSC_OPERATOR", "CITIZEN"];
  for (const r of precedence) {
    if (roles.includes(r)) return r;
  }
  return "CITIZEN";
}
