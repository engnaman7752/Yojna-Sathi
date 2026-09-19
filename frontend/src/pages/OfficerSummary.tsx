import { useEffect, useState } from "react";
import { ApiError, request } from "../api/client";

interface DistrictSummary {
  district: string;
  households: number;
  bySchemeEligible: Record<string, number>;
}

/** Counts for the officer's own district. The backend decides which that is. */
export function OfficerSummary({ token }: { token: string }) {
  const [summary, setSummary] = useState<DistrictSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    request<DistrictSummary>("/api/district/summary", { token })
      .then(setSummary)
      .catch((e) => setError(e instanceof ApiError ? e.friendly : "Could not load the summary."));
  }, [token]);

  return (
    <main>
      <h1>District summary</h1>
      {error && <p role="alert">{error}</p>}
      {!summary && !error && <p role="status">Loading…</p>}
      {summary && (
        <>
          <p>{summary.district}: {summary.households} household(s) registered.</p>
          <table>
            <thead><tr><th>Scheme</th><th>Eligible households</th></tr></thead>
            <tbody>
              {Object.entries(summary.bySchemeEligible).map(([scheme, count]) => (
                <tr key={scheme}><td>{scheme}</td><td>{count}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
