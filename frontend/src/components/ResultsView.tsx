import type { EligibilityCheckResponse, SchemeResult } from "../api/types";

function failed(scheme: SchemeResult) {
  return scheme.failedConditions ?? scheme.conditions.filter((c) => !c.passed);
}

/**
 * Eligible schemes first, with what to do next. Then the ones that did not
 * match, each with the conditions that stopped it, in the words a citizen was
 * shown rather than a rule id - the whole point of the engine returning labels.
 */
export function ResultsView({ result }: { result: EligibilityCheckResponse }) {
  return (
    <section aria-label="Your results">
      <h2>You may qualify for {result.eligible.length} scheme(s)</h2>
      {result.eligible.length === 0 && (
        <p>Nothing matched from the {result.schemesEvaluated} scheme(s) checked. The reasons are below.</p>
      )}

      <ul>
        {result.eligible.map((scheme) => (
          <li key={scheme.schemeId} data-testid={`eligible-${scheme.schemeId}`}>
            <h3>{scheme.schemeName}</h3>
            <h4>Documents to take with you</h4>
            <ul>
              {scheme.conditions
                .filter((c) => c.evidence?.docId)
                .map((c) => (
                  <li key={c.conditionId}>
                    {c.label}
                    {c.evidence?.page !== undefined && <> — see page {c.evidence.page}</>}
                  </li>
                ))}
              {scheme.conditions.every((c) => !c.evidence?.docId) && (
                <li>The scheme document does not list documents yet. Ask at your nearest CSC.</li>
              )}
            </ul>
            <h4>How to apply</h4>
            <p>Take these to your nearest Common Service Centre, or ask the operator who is helping you.</p>
          </li>
        ))}
      </ul>

      {result.notEligible.length > 0 && (
        <>
          <h2>Not matched, and why</h2>
          <ul>
            {result.notEligible.map((scheme) => (
              <li key={scheme.schemeId} data-testid={`not-eligible-${scheme.schemeId}`}>
                <h3>{scheme.schemeName}</h3>
                <ul>
                  {failed(scheme).map((c) => (
                    <li key={c.conditionId} data-testid={`failed-${scheme.schemeId}-${c.conditionId}`}>
                      {c.label}
                      {c.detail && <> ({c.detail})</>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
      <p><small>Reference: {result.correlationId}</small></p>
    </section>
  );
}
