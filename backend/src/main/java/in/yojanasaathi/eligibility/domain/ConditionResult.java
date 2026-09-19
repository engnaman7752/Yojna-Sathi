package in.yojanasaathi.eligibility.domain;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * The outcome of one condition, carrying the readable label so the caller can
 * say why a household did not qualify without re-reading the rules.
 *
 * {@code detail} is only set when there is something to add beyond the label,
 * for example that a fact was missing.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ConditionResult(
        String conditionId,
        String label,
        boolean passed,
        String detail,
        Evidence evidence) {

    public static ConditionResult passed(Condition condition) {
        return new ConditionResult(condition.id(), condition.label(), true, null, condition.evidence());
    }

    public static ConditionResult failed(Condition condition, String detail) {
        return new ConditionResult(condition.id(), condition.label(), false, detail, condition.evidence());
    }
}
