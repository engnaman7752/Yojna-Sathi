import { useEffect, useState } from "react";
import { ApiError, request } from "../api/client";

interface HouseholdRow {
  householdId: string;
  district: string;
  consentActive: boolean;
  consentExpiresAt?: string;
}

/**
 * Households this operator registered. The backend returns only those they may
 * see, so a household whose consent has lapsed simply is not in the list; the
 * frontend does no filtering of its own and must not be trusted to.
 */
export function OperatorDashboard({ token }: { token: string }) {
  const [rows, setRows] = useState<HouseholdRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    request<HouseholdRow[]>("/api/operator/households", { token })
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.friendly : "Could not load your households."));
  }, [token]);

  return (
    <main>
      <h1>Households you registered</h1>
      {error && <p role="alert">{error}</p>}
      {!rows && !error && <p role="status">Loading…</p>}
      {rows?.length === 0 && <p>You have not registered any households yet.</p>}
      {rows && rows.length > 0 && (
        <table>
          <thead>
            <tr><th>Household</th><th>District</th><th>Consent</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.householdId}>
                <td>{r.householdId}</td>
                <td>{r.district}</td>
                <td>{r.consentActive ? `active until ${r.consentExpiresAt ?? "—"}` : "not active"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
