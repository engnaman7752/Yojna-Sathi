import { useState } from "react";
import { request, ApiError } from "../api/client";
import { Link } from "react-router-dom";

export function RegisterPage() {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [role, setRole] = useState("CSC_OPERATOR");
    const [district, setDistrict] = useState("PATNA");
    const [busy, setBusy] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setBusy(true);

        try {
            await request("/api/users/register", {
                method: "POST",
                body: { email, name, role, district },
                token: "",
            });
            setSuccess(true);
        } catch (e) {
            if (e instanceof ApiError) setError(e.friendly);
            else setError("Registration failed. Please try again later.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="sign-in-page">
            <div className="sign-in-container" style={{ maxWidth: 500 }}>
                <header className="sign-in-header">
                    <div className="sign-in-logo" aria-hidden="true" style={{ fontSize: "3rem" }}>📝</div>
                    <h1>Officer Registration</h1>
                    <p className="sign-in-subtitle">Apply for Government/CSC Portal Access</p>
                </header>

                <div className="glass-card citizen-primary-card" style={{ padding: "var(--sp-8)" }}>
                    {success ? (
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "3rem", marginBottom: "var(--sp-4)" }}>✅</div>
                            <h2>Application Sent</h2>
                            <p style={{ color: "var(--text-secondary)", marginBottom: "var(--sp-6)" }}>
                                Your request has been submitted to the Admin for approval.
                                You will be able to access your dashboard once approved.
                            </p>
                            <Link to="/login" className="btn btn-primary" style={{ width: "100%", textAlign: "center", display: "inline-block" }}>
                                Return to Login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            {error && <div className="alert alert-danger" style={{ marginBottom: "var(--sp-4)" }}>⚠️ {error}</div>}

                            <div className="form-group" style={{ marginBottom: 'var(--sp-4)' }}>
                                <label className="form-label">Full Name</label>
                                <input type="text" className="form-input" required
                                    value={name} onChange={e => setName(e.target.value)}
                                    placeholder="Rahul Singh" />
                            </div>

                            <div className="form-group" style={{ marginBottom: 'var(--sp-4)' }}>
                                <label className="form-label">Email Address</label>
                                <input type="email" className="form-input" required
                                    value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="rahul@example.com" />
                            </div>

                            <div className="form-group" style={{ marginBottom: 'var(--sp-4)' }}>
                                <label className="form-label">Requested Role</label>
                                <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
                                    <option value="CSC_OPERATOR">CSC Operator (Citizen Service Center)</option>
                                    <option value="VILLAGE_OFFICER">Village Level Officer (VDO)</option>
                                    <option value="BLOCK_OFFICER">Block Officer (BDO)</option>
                                    <option value="DISTRICT_OFFICER">District Officer</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 'var(--sp-6)' }}>
                                <label className="form-label">Assigned District</label>
                                <input type="text" className="form-input" required
                                    value={district} onChange={e => setDistrict(e.target.value)}
                                    placeholder="e.g. PATNA" />
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
                                {busy ? "Submitting..." : "Request Access"}
                            </button>

                            <div style={{ textAlign: "center", marginTop: "var(--sp-4)" }}>
                                <Link to="/login" style={{ fontSize: "var(--fs-sm)", color: "var(--primary-600)", textDecoration: "none" }}>
                                    Already have an account? Sign in.
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
