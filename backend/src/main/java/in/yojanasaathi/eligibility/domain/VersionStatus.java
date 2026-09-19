package in.yojanasaathi.eligibility.domain;

/**
 * Lifecycle of a scheme version.
 *
 * Present from Phase 1 because it is load-bearing for two of the three
 * inviolable rules: only PUBLISHED versions are ever evaluated for a citizen,
 * and only PUBLISHED versions may be indexed for retrieval. The transitions
 * themselves (who may publish what, and the separation of drafter from
 * approver) arrive in Phase 2.
 */
public enum VersionStatus {
    DRAFT,
    PUBLISHED,
    REJECTED
}
