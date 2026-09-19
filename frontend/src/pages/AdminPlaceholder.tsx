export function AdminPlaceholder() {
  return (
    <main className="page-container">
      <div className="page-header">
        <h1 className="page-title">⚙️ Scheme Administration</h1>
        <p className="page-subtitle">Manage and publish government scheme configurations</p>
      </div>

      <div className="dashboard-grid">
        <div className="glass-card stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-value">Draft</div>
          <div className="stat-label">Create new scheme rules</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-icon">👁️</div>
          <div className="stat-value">Review</div>
          <div className="stat-label">Approve pending changes</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-icon">🚀</div>
          <div className="stat-value">Publish</div>
          <div className="stat-label">Push live to citizens</div>
        </div>
      </div>

      <div className="glass-card" style={{ marginTop: "var(--sp-6)", padding: "var(--sp-8)", textAlign: "center" }}>
        <p style={{ fontSize: "var(--fs-lg)", color: "var(--text-secondary)", marginBottom: "var(--sp-3)" }}>
          🔒 Maker-checker publishing flow arrives in Phase 6
        </p>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
          Admins never see citizen data. No one may publish a version they drafted.
          Both rules are enforced by Cedar policy.
        </p>
      </div>
    </main>
  );
}
