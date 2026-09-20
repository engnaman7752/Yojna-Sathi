import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, AI_SERVICE_URL, request } from "../api/client";
import { loadSession } from "../auth/session";
import { SchemeEditor, emptyForm, formFromJson, formToJson, type SchemeForm } from "../components/SchemeEditor";

/**
 * Scheme administration with maker-checker (Session 5) + AI PDF auto-draft
 * + non-technical form editor (Session 6).
 *
 * Two ways to create a draft:
 * 1. Upload a scheme PDF - ai-service reads it, Gemini extracts a JSON
 *    matching the vocabulary. That JSON is loaded straight into the form
 *    editor so a non-tech admin can review with dropdowns, not JsonLogic.
 * 2. Blank draft - opens the empty form editor.
 *
 * Either way the draft goes into DynamoDB with the current user as `drafter`.
 * Another admin then Publishes (Rule 2: same admin cannot publish).
 */

type Status = "DRAFT" | "PUBLISHED" | "REJECTED";

interface SchemeVersion {
  schemeId: string;
  version: number;
  name: string;
  state: string;
  status: Status;
  drafter: string;
  editors: string[];
  publishedBy?: string | null;
  updatedAt: string;
  publishedAt?: string | null;
  body: string;
}

interface PendingUser {
  pk: string;
  email: string;
  name: string;
  role: string;
  district: string;
  status: string;
  dateRequested: string;
}

export function AdminDashboard({ token }: { token: string }) {
  const me = loadSession()?.sub ?? "";
  const [rows, setRows] = useState<SchemeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ form: SchemeForm; sourcePdf?: string; droppedConditions?: number } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [extractStatus, setExtractStatus] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"SCHEMES" | "USERS">("SCHEMES");
  const [users, setUsers] = useState<PendingUser[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await request<SchemeVersion[]>("/api/admin/schemes", { token });
      setRows(data);
      if (activeTab === "USERS") {
        const userData = await request<PendingUser[]>("/api/admin/users", { token });
        setUsers(userData);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.friendly : "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, [token, activeTab]);

  useEffect(() => { void load(); }, [load]);

  const approveUser = async (email: string) => {
    setBusyKey(`approve-${email}`);
    try {
      await request(`/api/admin/users/${email}/approve`, { method: "PATCH", body: {}, token });
      alert("User Approved successfully (Demo Mock Hook)");
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.friendly : "Could not approve user");
    } finally {
      setBusyKey(null);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please upload a .pdf file.");
      return;
    }
    setExtractStatus(`Reading "${file.name}" and drafting scheme with AI... 30–60 seconds for a real document.`);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${AI_SERVICE_URL}/admin/extract`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Extraction failed (${res.status}): ${text}`);
      }
      const draft = await res.json();
      const { form, dropped } = formFromJson(draft);
      setEditing({ form, sourcePdf: file.name, droppedConditions: dropped });
      setExtractStatus(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setExtractStatus(null);
      setError(`AI extraction failed. ${msg}. Check the ai-service is running on ${AI_SERVICE_URL} and GEMINI_API_KEY is set in ai-service/.env.`);
    }
  };

  const saveDraft = async () => {
    if (!editing) return;
    if (!editing.form.schemeId.trim() || !editing.form.name.trim()) {
      alert("Scheme ID and Name are required."); return;
    }
    if (editing.form.conditions.length === 0) {
      if (!confirm("This scheme has NO eligibility conditions — every citizen will pass. Save anyway?")) return;
    }
    setBusyKey("save");
    try {
      const body = formToJson(editing.form);
      await request("/api/admin/schemes", { method: "POST", body, token });
      setEditing(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.friendly : (e as Error).message);
    } finally {
      setBusyKey(null);
    }
  };

  const publish = async (row: SchemeVersion) => {
    const key = `pub-${row.schemeId}-${row.version}`;
    setBusyKey(key);
    try {
      await request(`/api/admin/schemes/${row.schemeId}/versions/${row.version}/publish`,
        { method: "POST", body: {}, token });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.friendly : "Publish failed.");
    } finally {
      setBusyKey(null);
    }
  };

  const reject = async (row: SchemeVersion) => {
    if (!confirm(`Reject ${row.schemeId} v${row.version}? This can't be undone.`)) return;
    const key = `rej-${row.schemeId}-${row.version}`;
    setBusyKey(key);
    try {
      await request(`/api/admin/schemes/${row.schemeId}/versions/${row.version}/reject`,
        { method: "POST", body: {}, token });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.friendly : "Reject failed.");
    } finally {
      setBusyKey(null);
    }
  };

  const openEdit = (row: SchemeVersion) => {
    try {
      const parsed = JSON.parse(row.body);
      const { form, dropped } = formFromJson(parsed);
      setEditing({ form, droppedConditions: dropped });
    } catch {
      alert("Could not parse this scheme's body — it may be corrupt in the database.");
    }
  };

  const canPublish = (row: SchemeVersion) =>
    row.status === "DRAFT" && row.drafter !== me && !(row.editors || []).includes(me);

  const sortedRows = useMemo(() => {
    const rank: Record<Status, number> = { DRAFT: 0, PUBLISHED: 1, REJECTED: 2 };
    return [...rows].sort((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      if (a.schemeId !== b.schemeId) return a.schemeId.localeCompare(b.schemeId);
      return b.version - a.version;
    });
  }, [rows]);

  const badge = (s: Status) => {
    if (s === "DRAFT") return <span className="badge" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>📝 Draft</span>;
    if (s === "PUBLISHED") return <span className="badge badge-citizen">✅ Published</span>;
    return <span className="badge badge-admin">❌ Rejected</span>;
  };

  return (
    <main className="page-container">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--sp-3)" }}>
        <div>
          <h1 className="page-title">⚙️ Administration</h1>
          <p className="page-subtitle">Manage Schemes and User Registrations</p>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <div className="tab-group" style={{ display: 'flex', gap: '8px', background: 'var(--bg-card)', padding: '4px', borderRadius: '8px', marginRight: 'var(--sp-4)' }}>
            <button className={`btn ${activeTab === "SCHEMES" ? "btn-primary" : "btn-secondary"}`} style={{ padding: '0.4rem 1rem' }} onClick={() => setActiveTab("SCHEMES")}>Schemes</button>
            <button className={`btn ${activeTab === "USERS" ? "btn-primary" : "btn-secondary"}`} style={{ padding: '0.4rem 1rem' }} onClick={() => setActiveTab("USERS")}>User Approvals</button>
          </div>
          {activeTab === "SCHEMES" && (
            <>
              <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
                ✨ AI Auto-Draft from PDF
                <input type="file" accept="application/pdf" style={{ display: "none" }}
                  onChange={handlePdfUpload} disabled={extractStatus !== null} />
              </label>
              <button className="btn btn-primary" onClick={() => setEditing({ form: emptyForm() })}>
                + New Blank Scheme
              </button>
            </>
          )}
        </div>
      </div>

      {activeTab === "USERS" ? (
        <div className="data-table-wrapper glass-card">
          {loading ? (
            <div className="loading-state"><div className="spinner" style={{ width: "2rem", height: "2rem" }} /><p>Loading users...</p></div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Registrant</th><th>Role Requested</th><th>District</th><th>Date</th><th>Action</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.email}>
                    <td><strong>{u.name}</strong><br />{u.email}</td>
                    <td><span className="badge">{u.role}</span></td>
                    <td>{u.district}</td>
                    <td>{new Date(u.dateRequested).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-primary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }} onClick={() => approveUser(u.email)} disabled={busyKey === `approve-${u.email}`}>
                        {busyKey === `approve-${u.email}` ? "Approving..." : "✅ Approve"}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "var(--sp-8)" }}>No pending registrations found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <>

          {extractStatus && (
            <div className="alert" style={{ marginBottom: "var(--sp-4)", background: "var(--warning-bg)", color: "var(--warning)", display: "flex", gap: "var(--sp-3)", alignItems: "center" }}>
              <div className="spinner" style={{ width: 20, height: 20, borderTopColor: "currentColor" }} />
              <div>{extractStatus}</div>
            </div>
          )}
          {error && <div className="alert alert-danger" style={{ marginBottom: "var(--sp-4)" }}>⚠️ {error}</div>}

          {editing && (
            <div className="glass-card" style={{ padding: "var(--sp-6)", marginBottom: "var(--sp-6)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--sp-4)" }}>
                <div>
                  <h2 style={{ margin: 0 }}>{editing.sourcePdf ? "Review AI-drafted scheme" : "New scheme"}</h2>
                  {editing.sourcePdf && (
                    <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)", margin: "var(--sp-2) 0 0 0" }}>
                      📄 Auto-drafted from <strong>{editing.sourcePdf}</strong>. Review each field carefully — the AI may misread rules.
                    </p>
                  )}
                  {editing.droppedConditions ? (
                    <div className="alert" style={{ marginTop: "var(--sp-3)", background: "var(--warning-bg)", color: "var(--warning)", padding: "var(--sp-3)", fontSize: "var(--fs-sm)" }}>
                      ⚠️ {editing.droppedConditions} AI-drafted condition(s) had rules too complex for the form editor and were dropped. Check the Advanced panel below to see the raw JSON.
                    </div>
                  ) : null}
                </div>
              </div>

              <SchemeEditor value={editing.form} onChange={(next) => setEditing({ ...editing, form: next })} />

              <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-6)", justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: "var(--sp-4)" }}>
                <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveDraft} disabled={busyKey === "save"}>
                  {busyKey === "save" ? "Saving..." : "💾 Save as Draft"}
                </button>
              </div>
            </div>
          )}

          <div className="data-table-wrapper glass-card">
            {loading ? (
              <div className="loading-state">
                <div className="spinner" style={{ width: "2rem", height: "2rem" }} />
                <p>Loading schemes...</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Scheme</th><th>V</th><th>State</th><th>Status</th>
                    <th>Drafter</th><th>Editors</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map(row => {
                    const rowKey = `${row.schemeId}-${row.version}`;
                    const publishKey = `pub-${rowKey}`;
                    const rejectKey = `rej-${rowKey}`;
                    const cannotPublishReason =
                      row.status !== "DRAFT" ? null :
                        row.drafter === me ? "You drafted this — ask a different admin" :
                          (row.editors || []).includes(me) ? "You edited this — ask a different admin" : null;
                    return (
                      <tr key={rowKey}>
                        <td><strong>{row.name}</strong><br /><code style={{ fontSize: "0.75rem" }}>{row.schemeId}</code></td>
                        <td>{row.version}</td>
                        <td>{row.state}</td>
                        <td>{badge(row.status)}</td>
                        <td><code style={{ fontSize: "0.75rem" }}>{shorten(row.drafter)}</code></td>
                        <td>
                          {(row.editors || []).length === 0 ? <span style={{ color: "var(--text-muted)" }}>—</span>
                            : (row.editors || []).map(e => <code key={e} style={{ fontSize: "0.7rem", marginRight: 4 }}>{shorten(e)}</code>)}
                        </td>
                        <td>
                          {row.status === "DRAFT" && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button className="btn btn-secondary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}
                                onClick={() => openEdit(row)}>
                                Edit
                              </button>
                              <button className="btn btn-primary"
                                style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}
                                disabled={!canPublish(row) || busyKey === publishKey}
                                title={cannotPublishReason || "Publish"}
                                onClick={() => publish(row)}>
                                {busyKey === publishKey ? "..." : "✅ Publish"}
                              </button>
                              <button className="btn"
                                style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem", background: "var(--danger)", color: "white" }}
                                disabled={busyKey === rejectKey}
                                onClick={() => reject(row)}>
                                {busyKey === rejectKey ? "..." : "❌ Reject"}
                              </button>
                            </div>
                          )}
                          {row.status === "PUBLISHED" && (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              by <code>{shorten(row.publishedBy ?? "?")}</code>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {sortedRows.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "var(--sp-8)" }}>
                      <div style={{ fontSize: "2rem" }}>📝</div>
                      <div>No scheme versions yet.</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "var(--sp-2)" }}>
                        Upload a scheme PDF or click "New Blank Scheme" to create the first one.
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <p style={{ marginTop: "var(--sp-4)", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
            <strong>Maker-checker rule:</strong> Publish is disabled for any draft you created or edited. Another admin must review and publish it.
          </p>
        </>
      )}
    </main>
  );
}

function shorten(s: string): string {
  return s.length > 10 ? s.slice(0, 8) + "…" : s;
}
