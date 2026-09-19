import { useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";
import { OperatorDashboard } from "./pages/OperatorDashboard";
import { OfficerSummary } from "./pages/OfficerSummary";
import { AdminPlaceholder } from "./pages/AdminPlaceholder";
import { clearSession, loadSession, saveSession, type Role, type Session } from "./auth/session";

const ROLES: Role[] = ["CITIZEN", "CSC_OPERATOR", "DISTRICT_OFFICER", "ADMIN"];

/**
 * Local development sign-in. It pastes a token the local issuer minted; it does
 * not create one, and the role chosen here changes only which links are shown.
 * Cognito replaces this in Phase 8.
 */
function DevSignIn({ onSignIn }: { onSignIn: (s: Session) => void }) {
  const [token, setToken] = useState("");
  const [role, setRole] = useState<Role>("CITIZEN");
  return (
    <main>
      <h1>Sign in</h1>
      <p>Paste a token from the local issuer. Your real permissions come from the backend, not from this choice.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (token.trim()) onSignIn({ token: token.trim(), displayRole: role, displayName: role });
        }}
      >
        <label htmlFor="token">Token</label>
        <input id="token" value={token} onChange={(e) => setToken(e.target.value)} />
        <label htmlFor="role">Show me the pages for</label>
        <select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button type="submit">Continue</button>
      </form>
    </main>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  if (!session) {
    return <DevSignIn onSignIn={(s) => { saveSession(s); setSession(s); }} />;
  }

  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Chat</Link>
        {session.displayRole === "CSC_OPERATOR" && <Link to="/operator">My households</Link>}
        {session.displayRole === "DISTRICT_OFFICER" && <Link to="/district">District</Link>}
        {session.displayRole === "ADMIN" && <Link to="/admin">Schemes</Link>}
        <button onClick={() => { clearSession(); setSession(null); }}>Sign out</button>
      </nav>
      <Routes>
        <Route path="/" element={<ChatPage token={session.token} />} />
        <Route path="/operator" element={<OperatorDashboard token={session.token} />} />
        <Route path="/district" element={<OfficerSummary token={session.token} />} />
        <Route path="/admin" element={<AdminPlaceholder />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
