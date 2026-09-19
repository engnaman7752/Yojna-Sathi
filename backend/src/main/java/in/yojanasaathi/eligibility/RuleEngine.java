package in.yojanasaathi.eligibility;

import in.yojanasaathi.config.YojanaProperties;
import in.yojanasaathi.eligibility.domain.Condition;
import in.yojanasaathi.eligibility.domain.ConditionResult;
import in.yojanasaathi.eligibility.domain.HouseholdFacts;
import in.yojanasaathi.eligibility.domain.SchemeResult;
import in.yojanasaathi.eligibility.domain.SchemeVersion;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Evaluates every condition of a scheme version against a household's facts and
 * reports each one separately, so the caller can explain why not.
 *
 * This class is the whole of the eligibility decision. No model, prompt or
 * network call participates: given the same scheme version and the same facts
 * it returns the same answer every time.
 */
@Component
public class RuleEngine {

    private final JsonLogicEvaluator evaluator;
    private final MissingFieldPolicy missingFieldPolicy;

    public RuleEngine(JsonLogicEvaluator evaluator, YojanaProperties properties) {
        this.evaluator = evaluator;
        this.missingFieldPolicy = properties.eligibility().missingFieldPolicy();
    }

    /** Evaluates every condition; the scheme is met only if all of them pass. */
    public SchemeResult evaluate(SchemeVersion scheme, HouseholdFacts facts) {
        Map<String, Object> data = facts.asMap();
        List<ConditionResult> results = new ArrayList<>(scheme.conditions().size());
        for (Condition condition : scheme.conditions()) {
            results.add(evaluateCondition(scheme, condition, data));
        }
        return SchemeResult.of(scheme, results);
    }

    ConditionResult evaluateCondition(SchemeVersion scheme, Condition condition, Map<String, Object> facts) {
        Set<String> missing = missingFields(condition, facts);
        if (!missing.isEmpty()) {
            String names = String.join(", ", missing);
            if (missingFieldPolicy == MissingFieldPolicy.STRICT) {
                throw new RuleEvaluationException(scheme.schemeId(), scheme.version(), condition.id(),
                        "the household did not supply " + names
                                + ", which this condition reads. Supply the fact, or set "
                                + "yojana.eligibility.missing-field-policy=FAIL_CONDITION to treat it as a failure.",
                        null);
            }
            return ConditionResult.failed(condition, "information missing: " + names);
        }

        Object outcome;
        try {
            outcome = evaluator.apply(condition.ruleJson(), facts);
        } catch (Exception e) {
            throw new RuleEvaluationException(scheme.schemeId(), scheme.version(), condition.id(),
                    "the rule could not be evaluated (" + e.getClass().getSimpleName() + ": " + e.getMessage()
                            + "). Rule was: " + condition.ruleJson(),
                    e);
        }

        if (!(outcome instanceof Boolean decided)) {
            throw new RuleEvaluationException(scheme.schemeId(), scheme.version(), condition.id(),
                    "the rule returned " + describe(outcome) + " instead of true or false. "
                            + "A condition must be a yes/no test. Rule was: " + condition.ruleJson(),
                    null);
        }
        return decided ? ConditionResult.passed(condition) : ConditionResult.failed(condition, null);
    }

    private static Set<String> missingFields(Condition condition, Map<String, Object> facts) {
        Set<String> missing = new LinkedHashSet<>();
        for (String field : condition.referencedFields()) {
            if (!facts.containsKey(field)) {
                missing.add(field);
            }
        }
        return missing;
    }

    private static String describe(Object value) {
        if (value == null) {
            return "null";
        }
        return value.getClass().getSimpleName() + " (" + value + ")";
    }
}
