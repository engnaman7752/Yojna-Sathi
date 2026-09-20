import { useCallback, useEffect, useState } from "react";
import { ApiError, request } from "../api/client";

/**
 * District officer / admin dashboard.
 *
 * Reads real numbers from GET /api/district/summary (Session 6). Optional
 * ?district= filter narrows the view; leaving it blank shows every district.
 * SLA breach: any application sitting in a pending status for more than 7
 * days shows in amber, and the top-level KPI counts them so an officer knows
 * how many are overdue at a glance.
 */

interface StatusCount { status: string; count: number; slaBreached: number; }
interface SchemeCount { scheme: string; total: number; pending: number; approved: number; rejected: number; }
interface RecentEvent { appId: string; applicant: string; scheme: string; status: string; at: string; }
interface DistrictSummary {
  district: string;
  totalApplications: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  slaBreachedCount: number;
  byStatus: StatusCount[];
  bySchemeEligible: SchemeCount[];
  recent: RecentEvent[];
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_VDO: "Pending Village Officer",
  PENDING_BDO: "Pending Block Officer",
  PENDING_DISTRICT: "Pending District",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING_VDO: "#f59e0b",
  PENDING_BDO: "#3b82f6",
  PENDING_DISTRICT: "#a855f7",
  APPROVED: "#15803d",
  REJECTED: "#b91c1c",
};

export function OfficerSummary({ token }: { token: string }) {
  const [summary, setSummary] = useState<DistrictSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [district, setDistrict] = useState("");
  const [applied, setApplied] = useState("");

  const load = useCallback(async (dist: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = dist ? `?district=${encodeURIComponent(dist)}` : "";
      const s = await request<DistrictSummary>(`/api/district/summary${qs}`, { token });
      setSummary(s);
    } catch (e) {
      setError(e instanceof ApiError ? e.friendly : "Could not load the district summary.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(applied); }, [load, applied]);

  const applyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setApplied(district.trim());
  };

  const clearFilter = () => {
    setDistrict("");
    setApplied("");
  };

  const maxStatusCount = summary?.byStatus.reduce((m, s) => Math.max(m, s.count), 1) || 1;

  return (
    <main className="page-container">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--sp-3)" }}>
        <div>
          <h1 className="page-title">🏛️ District Summary</h1>
          <p className="page-subtitle">
            {summary?.district === "ALL" ? "All districts combined" : `District: ${summary?.district ?? "…"}`}
            {summary && ` · ${summary.totalApplications} application(s)`}
          </p>
        </div>
        <form onSubmit={applyFilter} style={{ display: "flex", gap: "var(--sp-2)", alignItems: "flex-end" }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "var(--fs-xs)" }}>Filter by district (optional)</label>
            <input className="form-input" value={district}
                   placeholder="e.g. PATNA" style={{ maxWidth: 200 }}
                   onChange={e => setDistrict(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: "0.5rem 1rem" }}>Apply</button>
          {applied && (
            <button type="button" className="btn btn-secondary" onClick={clearFilter} style={{ padding: "0.5rem 1rem" }}>Clear</button>
          )}
        </form>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: "var(--sp-4)" }}>⚠️ {error}</div>}

      {loading && !summary && (
        <div className="loading-state">
          <div className="spinner" style={{ width: "2rem", height: "2rem" }} />
          <p>Loading district data...</p>
        </div>
      )}

      {summary && (
        <>
          {/* ─── KPI cards ─── */}
          <div className="dashboard-grid" style={{ marginBottom: "var(--sp-6)" }}>
            <StatCard icon="📥" value={summary.totalApplications} label="Total applications" />
            <StatCard icon="⏳" value={summary.pendingCount} label="Currently pending" tone={summary.pendingCount > 0 ? "warning" : "default"} />
            <StatCard icon="✅" value={summary.approvedCount} label="Approved" tone="success" />
            <StatCard icon="❌" value={summary.rejectedCount} label="Rejected" tone="danger" />
            <StatCard icon="🚨" value={summary.slaBreachedCount} label={`Overdue (>7 days)`}
                      tone={summary.slaBreachedCount > 0 ? "danger" : "success"} />
          </div>

          {/* ─── By status ─── */}
          <div className="glass-card" style={{ padding: "var(--sp-6)", marginBottom: "var(--sp-6)" }}>
            <h2 style={{ marginTop: 0, marginBottom: "var(--sp-4)" }}>By status</h2>
            {summary.byStatus.every(s => s.count === 0) ? (
              <p style={{ color: "var(--text-muted)" }}>No applications yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
                {summary.byStatus.map(s => (
                  <div key={s.status}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                      <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                        {s.count}
                        {s.slaBreached > 0 && (
                          <span style={{ color: "var(--danger)", marginLeft: 8, fontSize: "var(--fs-xs)" }}>
                            🚨 {s.slaBreached} overdue
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ background: "var(--neutral-100)", height: 8, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        width: `${(s.count / maxStatusCount) * 100}%`,
                        height: "100%",
                        background: STATUS_COLOR[s.status] ?? "var(--primary-500)",
                        transition: "width 300ms var(--ease)",
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── By scheme ─── */}
          <div className="glass-card" style={{ padding: "var(--sp-6)", marginBottom: "var(--sp-6)" }}>
            <h2 style={{ marginTop: 0, marginBottom: "var(--sp-4)" }}>By scheme</h2>
            {summary.bySchemeEligible.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No scheme activity yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Scheme</th><th>Total</th><th>Pending</th><th>Approved</th><th>Rejected</th><th style={{ minWidth: 180 }}>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.bySchemeEligible.map(s => (
                    <tr key={s.scheme}>
                      <td><strong>{s.scheme}</strong></td>
                      <td>{s.total}</td>
                      <td>{s.pending > 0 ? <span style={{ color: "var(--warning)" }}>{s.pending}</span> : 0}</td>
                      <td>{s.approved > 0 ? <span style={{ color: "var(--success)" }}>{s.approved}</span> : 0}</td>
                      <td>{s.rejected > 0 ? <span style={{ color: "var(--danger)" }}>{s.rejected}</span> : 0}</td>
                      <td>
                        <div style={{ background: "var(--neutral-100)", height: 6, borderRadius: 3, overflow: "hidden", display: "flex" }}>
                          {s.approved > 0 && (
                            <div style={{ width: `${(s.approved / s.total) * 100}%`, background: "var(--success)" }} />
                          )}
                          {s.pending > 0 && (
                            <div style={{ width: `${(s.pending / s.total) * 100}%`, background: "var(--warning)" }} />
                          )}
                          {s.rejected > 0 && (
                            <div style={{ width: `${(s.rejected / s.total) * 100}%`, background: "var(--danger)" }} />
                          )}
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 2 }}>
                          {Math.round((s.approved / s.total) * 100)}% approved
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ─── Recent activity ─── */}
          <div className="glass-card" style={{ padding: "var(--sp-6)" }}>
            <h2 style={{ marginTop: 0, marginBottom: "var(--sp-4)" }}>Recent activity</h2>
            {summary.recent.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>Nothing recent.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>App ID</th><th>Applicant</th><th>Scheme</th><th>Status</th><th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recent.map(r => (
                    <tr key={r.appId}>
                      <td><code style={{ fontSize: "0.75rem" }}>{r.appId}</code></td>
                      <td>{r.applicant}</td>
                      <td>{r.scheme}</td>
                      <td>
                        <span className="badge" style={{
                          background: (STATUS_COLOR[r.status] ?? "#94a3b8") + "22",
                          color: STATUS_COLOR[r.status] ?? "#334155",
                        }}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {formatRelative(r.at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function StatCard({ icon, value, label, tone }: { icon: string; value: number; label: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const border = tone === "danger" ? "var(--danger)" : tone === "warning" ? "var(--warning)" : tone === "success" ? "var(--success)" : "var(--border)";
  return (
    <div className="glass-card stat-card" style={{ borderLeft: `4px solid ${border}` }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const secs = Math.floor((now - then) / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}
