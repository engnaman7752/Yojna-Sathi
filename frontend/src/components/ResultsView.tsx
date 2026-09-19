import type { EligibilityCheckResponse, SchemeResult } from "../api/types";

function failed(scheme: SchemeResult) {
  return scheme.failedConditions ?? scheme.conditions.filter((c) => !c.passed);
}

export function ResultsView({ result }: { result: EligibilityCheckResponse }) {
  return (
    <section aria-label="Your results" className="results-view">
      {/* ── Eligible Schemes ── */}
      <div className="results-header">
        <h2 className="results-title">
          {result.eligible.length > 0 ? "🎉" : "😔"}{" "}
          You may qualify for {result.eligible.length} scheme(s)
        </h2>
        <span className="badge badge-primary">{result.schemesEvaluated} evaluated</span>
      </div>

      {result.eligible.length === 0 && (
        <div className="glass-card" style={{ textAlign: "center", padding: "var(--sp-8)" }}>
          <p style={{ color: "var(--text-secondary)" }}>
            Nothing matched from the {result.schemesEvaluated} scheme(s) checked. See the reasons below.
          </p>
        </div>
      )}

      {result.eligible.length > 0 && (
        <div className="results-grid">
          {result.eligible.map((scheme) => (
            <div key={scheme.schemeId} className="glass-card result-card eligible" data-testid={`eligible-${scheme.schemeId}`}>
              <div className="result-card-header">
                <h3>{scheme.schemeName}</h3>
                <span className="badge badge-citizen">✓ Eligible</span>
              </div>

              <div className="result-section">
                <h4>📄 Documents to take</h4>
                <ul className="result-list">
                  {scheme.conditions
                    .filter((c) => c.evidence?.docId)
                    .map((c) => (
                      <li key={c.conditionId}>
                        {c.label}
                        {c.evidence?.page !== undefined && <span className="result-page"> — page {c.evidence.page}</span>}
                      </li>
                    ))}
                  {scheme.conditions.every((c) => !c.evidence?.docId) && (
                    <li className="result-no-docs">Ask at your nearest CSC for required documents.</li>
                  )}
                </ul>
              </div>

              <div className="result-section">
                <h4>🏢 Apply Directly (Self-Service)</h4>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>You can upload your documents here and immediately queue this application for Village level review.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();

                    const fd = new FormData(e.currentTarget);
                    const applicant = (fd.get('applicant') as string) || 'Self';
                    const district = (fd.get('district') as string) || 'PATNA';
                    const doc = (fd.get('document') as string) || 'Scan.pdf';

                    const newApp = {
                      id: "APP-" + Math.floor(1000 + Math.random() * 9000),
                      applicant,
                      scheme: scheme.schemeName,
                      district,
                      status: "PENDING_VDO",
                      documents: [doc],
                      dateSubmitted: new Date().toISOString()
                    };

                    const saved = window.localStorage.getItem("yojana.applications");
                    const apps = saved ? JSON.parse(saved) : [];
                    window.localStorage.setItem("yojana.applications", JSON.stringify([newApp, ...apps]));

                    alert("Application submitted! Reference ID: " + newApp.id);
                  }}
                  style={{ marginTop: 'var(--sp-2)' }}
                >
                  <input name="applicant" placeholder="Applicant Full Name" required style={{ width: '100%', padding: '0.5rem', marginBottom: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                  <select name="district" required style={{ width: '100%', padding: '0.5rem', marginBottom: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                    <option>PATNA</option>
                    <option>BHAGALPUR</option>
                    <option>GAYA</option>
                  </select>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Upload Document (PDF)</label>
                  <input name="document" type="file" required style={{ marginBottom: '8px', display: 'block' }} />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', width: '100%' }}>Upload and Submit</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Not Eligible ── */}
      {result.notEligible.length > 0 && (
        <>
          <h2 className="results-subtitle">Not matched, and why</h2>
          <div className="results-grid">
            {result.notEligible.map((scheme) => (
              <div key={scheme.schemeId} className="glass-card result-card not-eligible" data-testid={`not-eligible-${scheme.schemeId}`}>
                <div className="result-card-header">
                  <h3>{scheme.schemeName}</h3>
                  <span className="badge badge-admin">✗ Not eligible</span>
                </div>
                <ul className="result-list failed">
                  {failed(scheme).map((c) => (
                    <li key={c.conditionId} data-testid={`failed-${scheme.schemeId}-${c.conditionId}`}>
                      {c.label}
                      {c.detail && <span className="result-detail"> ({c.detail})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="result-ref">
        Reference: <code>{result.correlationId}</code>
      </p>
    </section>
  );
}
