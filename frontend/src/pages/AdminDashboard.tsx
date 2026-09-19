import { useState, useEffect } from "react";
import { request } from "../api/client";
interface SchemeVersion {
    schemeId: string;
    name: string;
    state: string;
    version: number;
    status: "DRAFT" | "PUBLISHED" | "REJECTED";
    conditions: any[];
}

export function AdminDashboard({ token }: { token: string }) {
    const [schemes, setSchemes] = useState<SchemeVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Editor Modal State
    const [editingScheme, setEditingScheme] = useState<SchemeVersion | null>(null);
    const [saving, setSaving] = useState(false);

    const [extracting, setExtracting] = useState(false);

    useEffect(() => {
        fetchSchemes();
    }, []);

    async function fetchSchemes() {
        setLoading(true);
        try {
            const data = await request<SchemeVersion[]>("/api/admin/schemes", { token });
            setSchemes(data);
        } catch (e: any) {
            setError("Failed to load schemes.");
        } finally {
            setLoading(false);
        }
    }

    async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        setExtracting(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("http://localhost:8000/admin/extract", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`AI Extraction Failed: ${text}`);
            }

            const draftedJson = await res.json();
            setEditingScheme(draftedJson);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setExtracting(false);
            if (e.target) e.target.value = ""; // reset file input
        }
    }

    function handleEditContent(scheme: SchemeVersion) {
        setEditingScheme(scheme);
    }

    function handleNewScheme() {
        const template: SchemeVersion = {
            schemeId: "new-scheme",
            name: "New Scheme Name",
            state: "ALL",
            version: 1,
            status: "DRAFT",
            conditions: [
                {
                    id: "c1",
                    label: "Must be a resident of India",
                    rule: { "==": [{ var: "state" }, "ALL"] }
                }
            ]
        };
        setEditingScheme(template);
    }

    function parseRule(rule: any) {
        if (!rule) return { field: "state", operator: "==", value: "" };
        const op = Object.keys(rule)[0];
        const args = rule[op];
        if (!Array.isArray(args) || !args[0]?.var) return { field: "state", operator: "==", value: "" };
        const val = Array.isArray(args[1]) ? args[1].join(", ") : args[1];
        return { field: args[0].var, operator: op, value: val };
    }

    function buildRule(field: string, op: string, valStr: string) {
        let finalVal: any = valStr;
        if (op === "in") finalVal = valStr.split(",").map((v: string) => v.trim());
        else if (!isNaN(Number(valStr)) && valStr.trim() !== "") finalVal = Number(valStr);
        return { [op]: [{ var: field }, finalVal] };
    }

    function updateObj(updates: Partial<SchemeVersion>) {
        if (editingScheme) setEditingScheme({ ...editingScheme, ...updates });
    }

    async function handleSave() {
        if (!editingScheme) return;
        setSaving(true);
        try {
            await request("/api/admin/schemes", {
                method: "POST",
                body: editingScheme,
                token
            });
            setEditingScheme(null);
            await fetchSchemes();
        } catch (e: any) {
            alert("Failed to save: " + e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="page-container">
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1 className="page-title">⚙️ Scheme Administration</h1>
                    <p className="page-subtitle">Maker-Checker Scheme Rules Publishing CMS</p>
                </div>
                <div style={{ display: "flex", gap: "var(--sp-4)" }}>
                    {extracting && <span style={{ padding: "var(--sp-2)", color: "var(--text-muted)" }}>🤖 Reading PDF...</span>}
                    <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
                        ✨ AI PDF Auto-Draft
                        <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={handlePdfUpload} disabled={extracting} />
                    </label>
                    <button className="btn btn-primary" onClick={handleNewScheme}>+ New Blank Draft</button>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="glass-card" style={{ padding: "0" }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Scheme ID</th>
                            <th>Name</th>
                            <th>State</th>
                            <th>Version</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ textAlign: "center", padding: "var(--sp-8)" }}><div className="spinner" /></td></tr>
                        ) : schemes.map((s: SchemeVersion) => (
                            <tr key={`${s.schemeId}-v${s.version}`}>
                                <td style={{ fontFamily: "monospace" }}>{s.schemeId}</td>
                                <td>{s.name}</td>
                                <td><span className="badge">{s.state}</span></td>
                                <td>v{s.version}</td>
                                <td>
                                    <span className={`badge badge-${s.status === 'PUBLISHED' ? 'citizen' : s.status === 'DRAFT' ? 'admin' : 'secondary'}`}>
                                        {s.status}
                                    </span>
                                </td>
                                <td>
                                    <button className="btn btn-secondary" onClick={() => handleEditContent(s)}>
                                        Edit Config
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!loading && schemes.length === 0 && (
                            <tr><td colSpan={6} style={{ textAlign: "center", padding: "var(--sp-6)" }}>No schemes found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Non-Technical Form Editor Modal */}
            {editingScheme && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
                }}>
                    <div className="glass-card" style={{
                        width: "800px", maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column", overflowY: "auto"
                    }}>
                        <h2 style={{ marginBottom: "var(--sp-2)", color: "var(--primary)" }}>Scheme Visual Builder</h2>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-4)", borderBottom: "1px solid var(--border)", paddingBottom: "var(--sp-4)", marginBottom: "var(--sp-4)" }}>
                            <div className="form-group">
                                <label>Scheme ID</label>
                                <input className="form-input" value={editingScheme.schemeId} onChange={e => updateObj({ schemeId: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Scheme Name</label>
                                <input className="form-input" value={editingScheme.name} onChange={e => updateObj({ name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Target State</label>
                                <input className="form-input" value={editingScheme.state} onChange={e => updateObj({ state: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Maker/Checker Status</label>
                                <select className="form-input" value={editingScheme.status} onChange={e => updateObj({ status: e.target.value as any })}>
                                    <option value="DRAFT">DRAFT</option>
                                    <option value="PUBLISHED">PUBLISHED</option>
                                    <option value="REJECTED">REJECTED</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Version (Bump to draft a new version)</label>
                                <input type="number" className="form-input" value={editingScheme.version} onChange={e => updateObj({ version: Number(e.target.value) })} />
                            </div>
                        </div>

                        <h3 style={{ marginBottom: "var(--sp-4)" }}>Eligibility Conditions</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", maxHeight: "35vh", overflowY: "auto", paddingRight: "var(--sp-2)" }}>
                            {editingScheme.conditions.map((cond: any, i: number) => {
                                const parsed = parseRule(cond.rule);
                                return (
                                    <div key={cond.id || i} style={{ border: "1px dashed var(--border)", padding: "var(--sp-4)", borderRadius: "var(--radius-md)", backgroundColor: "#fdfdfd" }}>
                                        <div className="form-group" style={{ marginBottom: "var(--sp-2)" }}>
                                            <input className="form-input" value={cond.label} onChange={e => {
                                                const newConds = [...editingScheme.conditions];
                                                newConds[i].label = e.target.value;
                                                updateObj({ conditions: newConds });
                                            }} placeholder="Human Readable Rule Explanation" />
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "var(--sp-2)", alignItems: "center" }}>
                                            <select className="form-input" value={parsed.field} onChange={e => {
                                                const newConds = [...editingScheme.conditions];
                                                newConds[i].rule = buildRule(e.target.value, parsed.operator, String(parsed.value));
                                                updateObj({ conditions: newConds });
                                            }}>
                                                <option value="state">State</option>
                                                <option value="district">District</option>
                                                <option value="annualIncome">Annual Income</option>
                                                <option value="age">Age</option>
                                                <option value="gender">Gender</option>
                                                <option value="socialCategory">Social Category</option>
                                                <option value="maritalStatus">Marital Status</option>
                                            </select>
                                            <select className="form-input" value={parsed.operator} onChange={e => {
                                                const newConds = [...editingScheme.conditions];
                                                newConds[i].rule = buildRule(parsed.field, e.target.value, String(parsed.value));
                                                updateObj({ conditions: newConds });
                                            }}>
                                                <option value="==">is exactly (==)</option>
                                                <option value="in">is one of (in)</option>
                                                <option value="<=">is less than or equal (&lt;=)</option>
                                                <option value=">=">is greater than or equal (&gt;=)</option>
                                                <option value=">">is strictly greater (&gt;)</option>
                                                <option value="<">is strictly less (&lt;)</option>
                                            </select>
                                            <input className="form-input" value={parsed.value} onChange={e => {
                                                const newConds = [...editingScheme.conditions];
                                                newConds[i].rule = buildRule(parsed.field, parsed.operator, e.target.value);
                                                updateObj({ conditions: newConds });
                                            }} placeholder="Value (comma separated if 'in')" />
                                        </div>
                                    </div>
                                )
                            })}
                            <button className="btn btn-secondary" onClick={() => {
                                const newConds = [...editingScheme.conditions, { id: `c${Date.now()}`, label: "New Rule", rule: { "==": [{ var: "state" }, ""] } }];
                                updateObj({ conditions: newConds });
                            }}>+ Add Condition</button>
                        </div>

                        <div style={{ display: "flex", gap: "var(--sp-4)", marginTop: "var(--sp-6)", justifyContent: "flex-end" }}>
                            <button className="btn btn-secondary" onClick={() => setEditingScheme(null)} disabled={saving}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? "Saving..." : "Save to Server"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
