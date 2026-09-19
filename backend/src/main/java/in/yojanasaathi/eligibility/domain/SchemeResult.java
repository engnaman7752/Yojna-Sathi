package in.yojanasaathi.eligibility.domain;

import java.util.Collections;
import java.util.List;

/**
 * The outcome of evaluating one scheme version against one household.
 *
 * A household is eligible only if every condition passed. An empty condition
 * list cannot occur: the loader rejects a scheme version that declares none,
 * precisely so that a malformed file cannot make everyone eligible.
 */
public record SchemeResult(
        String schemeId,
        String schemeName,
        int version,
        boolean eligible,
        List<ConditionResult> conditions) {

    public SchemeResult {
        conditions = conditions == null ? List.of() : Collections.unmodifiableList(List.copyOf(conditions));
    }

    public static SchemeResult of(SchemeVersion scheme, List<ConditionResult> results) {
        boolean eligible = !results.isEmpty() && results.stream().allMatch(ConditionResult::passed);
        return new SchemeResult(scheme.schemeId(), scheme.name(), scheme.version(), eligible, results);
    }

    /** The conditions that stopped this household qualifying. Empty when eligible. */
    public List<ConditionResult> failedConditions() {
        return conditions.stream().filter(c -> !c.passed()).toList();
    }

    /** The failed condition labels, for a one-line "why not". */
    public List<String> failedConditionLabels() {
        return failedConditions().stream().map(ConditionResult::label).toList();
    }
}
