/// <reference types="vite/client" />
import { useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";
import { OperatorDashboard } from "./pages/OperatorDashboard";
import { OfficerSummary } from "./pages/OfficerSummary";
import { AdminDashboard } from "./pages/AdminDashboard";
import { SignInPage } from "./pages/SignInPage";
import { CallbackPage } from "./pages/CallbackPage";
import { clearSession, loadSession, type Role, type Session } from "./auth/session";
import { signOut } from "./auth/cognito";

/**
 * Frontend routing + session shell.
 *
 * Auth model (Phase 3): the only way to get a Session is through Cognito's
 * Hosted UI. There is no dev sign-in on this app any more; every path except
 * / and /callback requires a valid session, and route guards additionally
 * check the user's role (as reported by GET /api/me, which the BACKEND
 * derives from the verified JWT).
 *
 * Route guards are a UX layer, not a security layer - the backend also
 * enforces role on every write endpoint. Editing localStorage to fake a
 * higher role only fools the UI; the actual request still fails 403.
 */

function RequireAuth({ session, children }: { session: Session | null; children: React.ReactNode }) {
  const location = useLocation();
  if (!session) return <Navigate to="/" replace state={{ from: location }} />;
  return <>{children}</>;
}

function RequireRole({
  session,
  allowed,
  children,
}: {
  session: Session | null;
  allowed: Role[];
  children: React.ReactNode;
}) {
  if (!session) return <Navigate to="/" replace />;
  if (!allowed.includes(session.displayRole)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppNav({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const isStaff = session.displayRole !== "CITIZEN";
  if (!isStaff) {
    return (
      <nav className="app-nav">
        <Link to="/" className="nav-brand">Yojana Saathi</Link>
        <Link to="/">💬 Chat</Link>
        <span className="nav-role-name" style={{ marginLeft: "auto", marginRight: "var(--sp-2)", color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>
          {session.displayName}
        </span>
        <button className="nav-signout" onClick={onSignOut}>Sign out</button>
      </nav>
    );
  }
  return (
    <nav className="app-nav app-nav--staff">
      <Link to="/" className="nav-brand">
        Yojana Saathi <span className="staff-eyebrow">Staff Portal</span>
      </Link>
      {(session.displayRole === "CSC_OPERATOR" ||
        session.displayRole === "VILLAGE_OFFICER" ||
        session.displayRole === "BLOCK_OFFICER" ||
        session.displayRole === "DISTRICT_OFFICER" ||
        session.displayRole === "ADMIN") && <Link to="/operator">📂 Applications</Link>}
      {(session.displayRole === "DISTRICT_OFFICER" || session.displayRole === "ADMIN") && (
        <Link to="/district">🏛️ District</Link>
      )}
      {session.displayRole === "ADMIN" && <Link to="/admin">⚙️ Schemes</Link>}
      <Link to="/" className="nav-citizen-link">💬 Citizen view</Link>
      <span className="nav-role-name">{session.displayName} · {session.displayRole}</span>
      <button className="nav-signout" onClick={onSignOut}>Sign out</button>
    </nav>
  );
}

function AuthenticatedShell({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  return (
    <>
      <AppNav session={session} onSignOut={onSignOut} />
      <Routes>
        <Route path="/" element={<ChatPage token={session.token} />} />
        <Route
          path="/operator"
          element={
            <RequireRole session={session} allowed={["CSC_OPERATOR", "VILLAGE_OFFICER", "BLOCK_OFFICER", "DISTRICT_OFFICER", "ADMIN"]}>
              <OperatorDashboard token={session.token} />
            </RequireRole>
          }
        />
        <Route
          path="/district"
          element={
            <RequireRole session={session} allowed={["DISTRICT_OFFICER", "ADMIN"]}>
              <OfficerSummary token={session.token} />
            </RequireRole>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireRole session={session} allowed={["ADMIN"]}>
              <AdminDashboard token={session.token} />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  const handleSignOut = () => {
    clearSession();
    setSession(null);
    void signOut(); // redirects to Cognito's /logout, which redirects back to /
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* /callback is public - it runs before there's a session. */}
        <Route path="/callback" element={<CallbackPage onSignIn={setSession} />} />
        {/* Everything else needs a session. */}
        <Route
          path="/*"
          element={
            session ? (
              <AuthenticatedShell session={session} onSignOut={handleSignOut} />
            ) : (
              <SignInPage />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

// Keep RequireAuth exported for future explicit uses; unused today.
export { RequireAuth };
