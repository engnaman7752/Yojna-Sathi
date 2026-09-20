import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { completeSignIn } from "../auth/cognito";
import { pickPrimaryRole, saveSession, type Session } from "../auth/session";
import { BACKEND_URL } from "../api/client";

/**
 * The OAuth2 callback landing page.
 *
 * Cognito sent the browser here with a ?code=... in the URL after a
 * successful sign-in. This component:
 *
 * 1. Hands that code to oidc-client-ts, which exchanges it for a real access
 *    token + id token + refresh token by calling Cognito's /oauth2/token.
 * 2. Uses the access token to call OUR backend's GET /api/me - which is the
 *    single source of truth for who the user is and what role they have. The
 *    backend verifies the JWT before answering; we trust its answer, not the
 *    token's own claims (per PROJECT_BRIEF rule 1).
 * 3. Saves the resulting Session and redirects to /.
 *
 * Any failure lands the user back on / with an error - safer than trusting a
 * half-broken auth flow.
 */
export function CallbackPage({ onSignIn }: { onSignIn: (s: Session) => void }) {
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [error, setError] = useState<string>("");
  // React 18 StrictMode double-invokes effects in dev, but Cognito's
  // authorization code is single-use - the second call would fail with
  // invalid_grant. This ref makes sure completeSignIn only runs once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const user = await completeSignIn();
        if (!user?.access_token) throw new Error("Cognito did not return an access token.");

        const meRes = await fetch(`${BACKEND_URL}/api/me`, {
          headers: { Authorization: `Bearer ${user.access_token}` },
        });
        if (!meRes.ok) {
          throw new Error(`Backend rejected the token (${meRes.status}). ` +
            "Check that COGNITO_ISSUER_URI matches your user pool.");
        }
        const me = await meRes.json() as { sub: string; email?: string; name?: string; roles?: string[] };

        const session: Session = {
          token: user.access_token,
          displayRole: pickPrimaryRole(me.roles),
          displayName: me.name || me.email || "Signed in",
          email: me.email,
          sub: me.sub,
        };
        saveSession(session);
        onSignIn(session);
        setState("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setState("failed");
      }
    })();
  }, [onSignIn]);

  if (state === "done") return <Navigate to="/" replace />;

  return (
    <div className="sign-in-page">
      <div className="sign-in-container">
        <div className="glass-card" style={{ padding: "var(--sp-8)", textAlign: "center" }}>
          {state === "working" && (
            <>
              <div className="spinner" style={{ width: "3rem", height: "3rem", margin: "0 auto var(--sp-4)" }} />
              <h2>Finishing sign-in...</h2>
              <p style={{ color: "var(--text-muted)" }}>Verifying your session with the backend.</p>
            </>
          )}
          {state === "failed" && (
            <>
              <div style={{ fontSize: "3rem", marginBottom: "var(--sp-4)" }}>⚠️</div>
              <h2>Sign-in didn't complete</h2>
              <p style={{ color: "var(--danger)", marginTop: "var(--sp-4)" }}>{error}</p>
              <button className="btn btn-primary" style={{ marginTop: "var(--sp-6)" }} onClick={() => window.location.assign("/")}>
                Try again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
