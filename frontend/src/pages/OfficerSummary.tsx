import { useEffect, useState } from "react";
import { ApiError, request } from "../api/client";

interface DistrictSummary {
  district: string;
  households: number;
  bySchemeEligible: Record<string, number>;
}

export function OfficerSummary({ token }: { token: string }) {
  const [summary, setSummary] = useState<DistrictSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    request<DistrictSummary>("/api/district/summary", { token })
      .then(setSummary)
      .catch((e) => setError(e instanceof ApiError ? e.friendly : "Could not load the summary."));
  }, [token]);

  return (
    <main className="page-container">
      <div className="page-header">
        <h1 className="page-title">🏛️ District Summary</h1>
        <p className="page-subtitle">Overview of households and scheme eligibility in your district</p>
      </div>

      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      {!summary && !error && (
        <div className="loading-state">
          <div className="spinner" style={{ width: "2rem", height: "2rem" }} />
          <p>Loading district data...</p>
        </div>
      )}

      {summary && (
        <div className="dashboard-grid">
          {/* Stat cards */}
          <div className="glass-card stat-card">
            <div className="stat-icon">📍</div>
            <div className="stat-value">{summary.district}</div>
            <div className="stat-label">District</div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-icon">👨‍👩‍👧‍👦</div>
            <div className="stat-value">{summary.households}</div>
            <div className="stat-label">Households Registered</div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-value">{Object.keys(summary.bySchemeEligible).length}</div>
            <div className="stat-label">Active Schemes</div>
          </div>

          {/* Scheme breakdown table */}
          <div className="data-table-wrapper glass-card" style={{ gridColumn: "1 / -1" }}>
            <h3 style={{ marginBottom: "var(--sp-4)", color: "var(--text-primary)" }}>Scheme-wise Eligibility</h3>
            <table className="data-table">
              <thead>
                <tr><th>Scheme</th><th>Eligible Households</th></tr>
              </thead>
              <tbody>
                {Object.entries(summary.bySchemeEligible).map(([scheme, count]) => (
                  <tr key={scheme}>
                    <td>{scheme}</td>
                    <td><span className="badge badge-citizen">{count}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
