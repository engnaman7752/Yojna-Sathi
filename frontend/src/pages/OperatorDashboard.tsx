import { useEffect, useState } from "react";
import { type Role, loadSession } from "../auth/session";

interface Application {
  id: string;
  applicant: string;
  scheme: string;
  district: string;
  status: 'PENDING_VDO' | 'PENDING_BDO' | 'PENDING_DISTRICT' | 'APPROVED' | 'REJECTED';
  documents: string[];
  dateSubmitted: string;
}

export function OperatorDashboard({ token }: { token: string }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [role, setRole] = useState<Role>("CSC_OPERATOR");

  // Form State for CSC
  const [applicant, setApplicant] = useState("");
  const [selectedSchemes, setSelectedSchemes] = useState<string[]>(["PM-KISAN"]);
  const [documentUrl, setDocumentUrl] = useState("Khasra_Report_122.pdf");

  const toggleScheme = (sc: string) => setSelectedSchemes(prev => prev.includes(sc) ? prev.filter(x => x !== sc) : [...prev, sc]);

  useEffect(() => {
    const session = loadSession();
    if (session) setRole(session.displayRole);

    const saved = window.localStorage.getItem("yojana.applications");
    if (saved) {
      setApps(JSON.parse(saved));
    } else {
      // Seed some dummy apps if empty (for demo)
      const dummy: Application[] = [
        { id: "APP-9831", applicant: "Ramesh Kumar", scheme: "PM-KISAN", district: "PATNA", status: "PENDING_VDO", documents: ["Aadhar_Card.pdf", "Land_Record.pdf"], dateSubmitted: new Date().toISOString() },
        { id: "APP-4011", applicant: "Geeta Devi", scheme: "Bihar MVPY", district: "BHAGALPUR", status: "PENDING_BDO", documents: ["Aadhar_Card.pdf", "Age_Proof.jpg"], dateSubmitted: new Date().toISOString() },
      ];
      setApps(dummy);
      window.localStorage.setItem("yojana.applications", JSON.stringify(dummy));
    }
  }, [token]);

  const saveApps = (newApps: Application[]) => {
    setApps(newApps);
    window.localStorage.setItem("yojana.applications", JSON.stringify(newApps));
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSchemes.length === 0) {
      alert("Please select at least one scheme.");
      return;
    }

    const newApps: Application[] = selectedSchemes.map((sc) => ({
      id: "APP-" + Math.floor(1000 + Math.random() * 9000),
      applicant,
      scheme: sc,
      district: "PATNA",
      status: "PENDING_VDO",
      documents: documentUrl.split(",").map(d => d.trim()).filter(Boolean),
      dateSubmitted: new Date().toISOString()
    }));

    saveApps([...newApps, ...apps]);
    setApplicant("");
  };

  const handleAction = (id: string, action: 'APPROVE' | 'REJECT') => {
    const newApps = apps.map(app => {
      if (app.id !== id) return app;

      if (action === 'REJECT') return { ...app, status: 'REJECTED' as const };

      let nextStatus = app.status;
      if (app.status === 'PENDING_VDO') nextStatus = 'PENDING_BDO';
      else if (app.status === 'PENDING_BDO') nextStatus = 'PENDING_DISTRICT';
      else if (app.status === 'PENDING_DISTRICT') nextStatus = 'APPROVED';

      return { ...app, status: nextStatus as Application['status'] };
    });
    saveApps(newApps);
  };

  // Determine what each role can see
  let visibleApps = apps;
  if (role === "VILLAGE_OFFICER") visibleApps = apps.filter(a => a.status === 'PENDING_VDO');
  if (role === "BLOCK_OFFICER") visibleApps = apps.filter(a => a.status === 'PENDING_BDO');
  if (role === "DISTRICT_OFFICER") visibleApps = apps.filter(a => a.status === 'PENDING_DISTRICT' || a.status === 'APPROVED');

  const getStatusBadge = (status: string) => {
    if (status === 'APPROVED') return <span className="badge badge-citizen">✅ Fully Approved</span>;
    if (status === 'REJECTED') return <span className="badge badge-admin">❌ Rejected</span>;
    if (status === 'PENDING_VDO') return <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>⏳ Village Level Review</span>;
    if (status === 'PENDING_BDO') return <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>⏳ Block Level Review</span>;
    if (status === 'PENDING_DISTRICT') return <span className="badge" style={{ background: '#fce7f3', color: '#9d174d' }}>⏳ District Level Review</span>;
    return <span className="badge">{status}</span>;
  };

  return (
    <main className="page-container">
      <div className="page-header">
        <h1 className="page-title">📑 Verification Pipeline</h1>
        <p className="page-subtitle">Multi-Step Verification Workflow</p>
      </div>

      {role === "CSC_OPERATOR" && (
        <form className="glass-card" style={{ marginBottom: "var(--sp-8)", padding: "var(--sp-8)", border: "1px solid rgba(255, 255, 255, 0.4)", borderRadius: "16px", background: "linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 100%)", boxShadow: "0 8px 32px rgba(0,0,0,0.05)" }} onSubmit={handleUpload}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: "var(--sp-6)" }}>
            <div style={{ background: 'var(--primary)', color: 'white', padding: '0.75rem', borderRadius: '12px', fontSize: '1.25rem' }}>📄</div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>New Application Submission</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Upload supporting documents to initiate the verification pipeline</p>
            </div>
          </div>

          <div className="demo-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-6)' }}>
            <div>
              <div className="input-group" style={{ marginBottom: 'var(--sp-4)' }}>
                <label style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-2)', display: 'block' }}>Applicant Name</label>
                <input type="text" className="form-input" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} placeholder="e.g. Ramesh Kumar" value={applicant} onChange={e => setApplicant(e.target.value)} required />
              </div>
              <div className="input-group">
                <label style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-2)', display: 'block' }}>Target Schemes (Select Multiple)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0.75rem', background: 'rgba(255,255,255,0.5)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {["PM-KISAN", "Bihar MVPY", "IGNOAPS"].map(s => (
                    <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedSchemes.includes(s)}
                        onChange={() => toggleScheme(s)}
                        style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--primary)' }}
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-2)', display: 'block' }}>Upload Document (Simulated PDF)</label>
              <div style={{ flex: 1, border: '2px dashed var(--primary-light)', borderRadius: '12px', background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 'var(--sp-2)', padding: 'var(--sp-4)' }}>
                <span style={{ fontSize: '2rem' }}>📁</span>
                <input type="text" style={{ background: 'transparent', border: 'none', borderBottom: '2px solid var(--primary)', textAlign: 'center', width: '80%', padding: '0.25rem', outline: 'none', fontWeight: 500 }} value={documentUrl} onChange={e => setDocumentUrl(e.target.value)} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Type simulated filename directly</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: "var(--sp-8)", borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 'var(--sp-4)' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem', fontWeight: 600, borderRadius: '8px', boxShadow: '0 4px 14px 0 rgba(249, 115, 22, 0.39)' }}>Submit to Village Officer 🚀</button>
          </div>
        </form>
      )}

      <div className="data-table-wrapper glass-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>App ID</th>
              <th>Applicant</th>
              <th>Scheme</th>
              <th>Status</th>
              <th>Documents</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleApps.map(app => (
              <tr key={app.id}>
                <td><code>{app.id}</code></td>
                <td>{app.applicant}</td>
                <td>{app.scheme}</td>
                <td>{getStatusBadge(app.status)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {app.documents.map(doc => (
                      <span key={doc} className="badge" style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>📎 {doc}</span>
                    ))}
                  </div>
                </td>
                <td>
                  {app.status !== 'APPROVED' && app.status !== 'REJECTED' && role !== 'CSC_OPERATOR' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleAction(app.id, 'APPROVE')} className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}>✅ Approve</button>
                      <button onClick={() => handleAction(app.id, 'REJECT')} className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem', background: '#ef4444', color: 'white' }}>❌ Reject</button>
                    </div>
                  )}
                  {role === 'CSC_OPERATOR' && (
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Awaiting Review</span>
                  )}
                </td>
              </tr>
            ))}
            {visibleApps.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "var(--sp-8)" }}>
                  <div style={{ fontSize: "2rem" }}>🎉</div>
                  <div style={{ fontWeight: 500 }}>No applications in your queue!</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
