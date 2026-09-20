import { signIn } from "../auth/cognito";

/**
 * Public sign-in page. Every unauthenticated visit lands here.
 *
 * There is no username/password form on our side any more. Clicking the
 * button redirects the browser to Cognito's Hosted UI, which handles sign-up,
 * sign-in, forgot-password, email verification, and (in a later session)
 * social federation with Google. When the user is done there, Cognito
 * redirects back to /callback with a one-time authorization code.
 */
export function SignInPage() {
  return (
    <div className="sign-in-page">
      <div className="sign-in-container">
        <header className="sign-in-header">
          <div className="sign-in-logo" aria-hidden="true" style={{ fontSize: "3rem" }}>🇮🇳</div>
          <h1>Yojana Saathi</h1>
          <p className="sign-in-subtitle">सरकारी योजनाओं की पात्रता जाँचें</p>
          <div className="sign-in-badges">
            <span className="badge badge-primary">🔒 Secure Login</span>
            <span className="badge badge-primary">🌐 Multilingual</span>
          </div>
        </header>

        <div className="glass-card citizen-primary-card" style={{ textAlign: "center", padding: "var(--sp-8)" }}>
          <div className="demo-card-icon citizen" style={{ width: 64, height: 64, fontSize: "2rem", margin: "0 auto var(--sp-4)" }}>👤</div>
          <h2 style={{ marginBottom: "var(--sp-2)" }}>Sign in to continue</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--sp-6)" }}>
            Citizens, CSC operators, and officers all sign in through the same
            secure page. Your role decides what you can do once you're in.
          </p>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => signIn().catch(e => alert(String(e)))}>
            Sign in with Cognito
          </button>
          <p style={{ marginTop: "var(--sp-4)", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
            New here? You can sign up on the same page.
          </p>
        </div>

        <p style={{ textAlign: "center", marginTop: "var(--sp-6)", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
          Authentication provided by Amazon Cognito. Yojana Saathi never sees your password.
        </p>
      </div>
    </div>
  );
}
