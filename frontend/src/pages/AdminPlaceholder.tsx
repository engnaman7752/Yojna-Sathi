/**
 * Placeholder. Scheme drafting, the PDF import queue and the maker-checker
 * publish flow are Phase 6; the Cedar policies that will guard them already
 * exist in backend/src/main/resources/cedar/.
 */
export function AdminPlaceholder() {
  return (
    <main>
      <h1>Scheme administration</h1>
      <p>Drafting, reviewing and publishing scheme versions arrives in Phase 6.</p>
      <p>
        Admins never see citizen data, and no one may publish a version they drafted or
        edited. Both rules are already enforced by policy.
      </p>
    </main>
  );
}
