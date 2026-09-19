/// <reference types="vite/client" />
import { useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";
import { OperatorDashboard } from "./pages/OperatorDashboard";
import { OfficerSummary } from "./pages/OfficerSummary";
import { AdminDashboard } from "./pages/AdminDashboard";
import { clearSession, loadSession, saveSession, type Role, type Session } from "./auth/session";
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";

const OFFICIAL_ACCOUNTS: {
  role: Role; name: string; nameHi: string;
  desc: string; icon: string; badgeClass: string; iconClass: string;
}[] = [
    { role: "CSC_OPERATOR", name: "CSC Operator", nameHi: "सीएससी ऑपरेटर", desc: "File applications for citizens", icon: "🏢", badgeClass: "badge-csc", iconClass: "csc" },
    { role: "VILLAGE_OFFICER", name: "Village Officer (VDO)", nameHi: "ग्राम विकास अधिकारी", desc: "Level 1 Application Verification", icon: "🏘️", badgeClass: "badge-officer", iconClass: "officer" },
    { role: "BLOCK_OFFICER", name: "Block Officer (BDO)", nameHi: "खंड विकास अधिकारी", desc: "Level 2 Application Verification", icon: "🏫", badgeClass: "badge-officer", iconClass: "officer" },
    { role: "DISTRICT_OFFICER", name: "District Officer", nameHi: "जिला अधिकारी", desc: "Final Verification & Review", icon: "📋", badgeClass: "badge-officer", iconClass: "officer" },
    { role: "ADMIN", name: "System Admin", nameHi: "प्रशासक", desc: "Configure scheme rules", icon: "⚙️", badgeClass: "badge-admin", iconClass: "admin" },
  ];

function DevSignIn({ onSignIn }: { onSignIn: (s: Session) => void }) {
  const [loadingRole, setLoadingRole] = useState<Role | null>(null);

  const handleLogin = async (role: Role, name: string) => {
    setLoadingRole(role);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8081"}/api/dev/auth?role=${role}&name=${encodeURIComponent(name)}`
      );
      if (res.ok) {
        const data = await res.json();
        onSignIn({ token: data.token, displayRole: role, displayName: name, mock: false });
        return;
      }
    } catch {
      /* backend not reachable — fall through to a clearly-labelled demo session */
    }
    // No live backend to sign in against. The UI still lets you look around,
    // but it says so — a fake session that pretends to be real is exactly
    // the kind of thing this project is built to never do to a citizen.
    onSignIn({ token: `demo-${role}-${Date.now()}`, displayRole: role, displayName: name, mock: true });
    setLoadingRole(null);
  };

  return (
    <div className="sign-in-page">
      <div className="sign-in-container">
        {/* ── Header ── */}
        <header className="sign-in-header">
          <div className="sign-in-logo" aria-hidden="true" style={{ fontSize: '3rem' }}>🇮🇳</div>
          <h1>Yojana Saathi</h1>
          <p className="sign-in-subtitle">
            सरकारी योजनाओं की पात्रता जाँचें
          </p>
          <div className="sign-in-badges">
            <span className="badge badge-primary">🌐 Multilingual</span>
            <span className="badge badge-primary">🤖 AI Powered</span>
          </div>
        </header>

        {/* ── CITIZEN LOGIN (Primary) ── */}
        <div className="glass-card demo-card citizen-primary-card" style={{ cursor: 'default', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="citizen-primary-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="demo-card-icon citizen" style={{ width: 64, height: 64, fontSize: '2rem', margin: '0 auto var(--sp-4)' }}>👤</div>
            <h2>Citizen Sign In (नागरिक)</h2>
            <p style={{ marginBottom: 'var(--sp-6)' }}>Check your eligibility securely using Google SSO</p>

            <GoogleLogin
              onSuccess={(credentialResponse) => {
                if (credentialResponse.credential) {
                  const decoded = jwtDecode<{ email?: string, name?: string }>(credentialResponse.credential);
                  // Hackathon Role Trick: Gov.in -> OFFICER, otherwise CITIZEN
                  const isOfficer = decoded.email?.endsWith("@gov.in");
                  const assignedRole = isOfficer ? "VILLAGE_OFFICER" : "CITIZEN";
                  onSignIn({
                    token: credentialResponse.credential,
                    displayRole: assignedRole,
                    displayName: decoded.name || "Verified Citizen",
                    mock: false
                  });
                }
              }}
              onError={() => console.log('Google Login Failed')}
              useOneTap
            />
            {loadingRole === "CITIZEN" && <div className="spinner" style={{ position: 'absolute', top: 16, right: 16 }} />}
          </div>

          {/* Hackathon Demo Fallback since a fake ClientID will throw Google OAuth Error */}
          <details style={{ marginTop: 'var(--sp-4)', width: '100%', fontSize: '0.8rem' }}>
            <summary style={{ cursor: 'pointer', textAlign: 'center', opacity: 0.7 }}>Bypass SSO (Demo Mode)</summary>
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 'var(--sp-2)' }}
              onClick={() => handleLogin("CITIZEN", "Ramesh Kumar")}
              disabled={loadingRole !== null}
            >
              Start Chat Session
            </button>
          </details>
        </div>

        {/* ── STAFF LOGIN (Secondary, deliberately smaller and lower) ── */}
        <details className="advanced-toggle official-login-toggle" style={{ marginTop: 'var(--sp-8)' }}>
          <summary>🏢 Staff & department sign-in (CSC / District / Admin)</summary>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textAlign: 'center', marginTop: 'var(--sp-3)' }}>
            Most people should use the citizen option above.
          </p>
          <div className="demo-grid" style={{ marginTop: 'var(--sp-4)' }}>
            {OFFICIAL_ACCOUNTS.map((acct) => (
              <button
                key={acct.role}
                className="glass-card demo-card"
                onClick={() => handleLogin(acct.role, acct.name)}
                disabled={loadingRole !== null}
                style={{ padding: 'var(--sp-4)' }}
              >
                <div className="demo-card-top">
                  <span className="demo-name">{acct.name}</span>
                  <div className={`demo-card-icon ${acct.iconClass}`} style={{ marginBottom: 0, width: 28, height: 28, fontSize: '1rem' }}>{acct.icon}</div>
                </div>
                <p className="demo-desc" style={{ marginTop: 'var(--sp-1)' }}>{acct.desc}</p>
                {loadingRole === acct.role && <div className="spinner" style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16 }} />}
              </button>
            ))}
          </div>

        </details>
      </div>
    </div>
  );
}

function AppNav({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const isStaff = session.displayRole !== "CITIZEN";

  if (!isStaff) {
    return (
      <nav className="app-nav">
        <Link to="/" className="nav-brand">Yojana Saathi</Link>
        <Link to="/">💬 Chat</Link>
        <button className="nav-signout" onClick={onSignOut}>Sign out</button>
      </nav>
    );
  }

  return (
    <nav className="app-nav app-nav--staff">
      <Link to="/" className="nav-brand">
        Yojana Saathi <span className="staff-eyebrow">Staff Portal</span>
      </Link>
      {(session.displayRole === "CSC_OPERATOR" || session.displayRole === "VILLAGE_OFFICER" || session.displayRole === "BLOCK_OFFICER" || session.displayRole === "DISTRICT_OFFICER") && (
        <Link to="/operator">📑 Verification Pipeline</Link>
      )}
      {session.displayRole === "DISTRICT_OFFICER" && <Link to="/district">🏛️ District Stats</Link>}
      {session.displayRole === "ADMIN" && <Link to="/admin">⚙️ Schemes</Link>}
      <Link to="/" className="nav-citizen-link">💬 Citizen chat view</Link>
      <span className="nav-role-name">{session.displayName}</span>
      <button className="nav-signout" onClick={onSignOut}>Sign out</button>
    </nav>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  if (!session) {
    return <DevSignIn onSignIn={(s) => { saveSession(s); setSession(s); }} />;
  }

  const handleSignOut = () => { clearSession(); setSession(null); };

  return (
    <BrowserRouter>
      <AppNav session={session} onSignOut={handleSignOut} />
      {session.mock && (
        <div className="demo-mode-banner" role="status">
          ⚠️ Demo mode — no backend is connected, so this sign-in is not real. Chat and eligibility
          checks below won't return real results until the backend is running.
        </div>
      )}
      <Routes>
        <Route path="/" element={<ChatPage token={session.token} />} />
        <Route path="/operator" element={<OperatorDashboard token={session.token} />} />
        <Route path="/district" element={<OfficerSummary token={session.token} />} />
        <Route path="/admin" element={<AdminDashboard token={session.token} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
