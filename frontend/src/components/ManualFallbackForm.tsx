import { useState } from "react";
import { BACKEND_URL, ApiError, request } from "../api/client";
import type { EligibilityCheckResponse, HouseholdFacts } from "../api/types";
import { FactConfirmation } from "./FactConfirmation";
import { ResultsView } from "./ResultsView";

/**
 * The route that works when the agent does not.
 *
 * It talks to POST /api/eligibility/check directly, so a citizen can still get
 * an answer when the AI service is down. The rule engine is what decides
 * eligibility in either case, so the answer here is exactly the answer the chat
 * would have given - only the conversation is missing.
 */
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
    <section aria-label="Check without the assistant" data-testid="manual-fallback">
      <h2>Check your details directly</h2>
      {reason && <p role="status">{reason}</p>}
      <p>The assistant is not available right now, so you can fill the details in yourself.</p>
      <FactConfirmation extracted={{}} onConfirm={(facts) => void submit(facts)} submitLabel="Check schemes" />
      {busy && <p role="status">Checking…</p>}
      {error && <p role="alert">{error}</p>}
      {result && <ResultsView result={result} />}
    </section>
  );
}
