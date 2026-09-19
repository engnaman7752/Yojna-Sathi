import { useState } from "react";
import { BACKEND_URL, ApiError, request } from "../api/client";
import type { EligibilityCheckResponse, HouseholdFacts } from "../api/types";
import { FactConfirmation } from "./FactConfirmation";
import { ResultsView } from "./ResultsView";

export function ManualFallbackForm({ token, reason }: { token: string; reason?: string }) {
  const [result, setResult] = useState<EligibilityCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(facts: HouseholdFacts) {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await request<EligibilityCheckResponse>("/api/eligibility/check", {
          method: "POST",
          body: facts,
          token,
          baseUrl: BACKEND_URL,
          serviceName: "backend",
        }),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.friendly : "We could not reach the service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Check without the assistant" data-testid="manual-fallback" className="fallback-section">
      <div className="glass-card fallback-card">
        <div className="fallback-header">
          <h2>📝 Check your details directly</h2>
          {reason && (
            <div className="alert alert-warning" role="status" style={{ marginTop: "var(--sp-3)" }}>
              ⚠️ {reason}
            </div>
          )}
          <p className="fallback-desc">
            The assistant is not available right now. Fill in your details below and we'll check your eligibility directly.
          </p>
        </div>
        <FactConfirmation extracted={{}} onConfirm={(facts) => void submit(facts)} submitLabel="Check schemes" />
      </div>

      {busy && (
        <div className="loading-state" style={{ marginTop: "var(--sp-6)" }}>
          <div className="spinner" style={{ width: "2rem", height: "2rem" }} />
          <p>Checking your eligibility...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginTop: "var(--sp-4)" }}>
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: "var(--sp-6)" }}>
          <ResultsView result={result} />
        </div>
      )}
    </section>
  );
}
