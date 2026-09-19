package in.yojanasaathi.eligibility.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonRawValue;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * One eligibility criterion: a JSON Logic rule plus the human-readable label
 * that explains it.
 *
 * The rule is kept as its serialised JSON string because that is what the
 * evaluator consumes. {@code referencedFields} is computed once at load time,
 * both to validate the rule against the field vocabulary and so the engine can
 * tell, before evaluating, whether the household actually supplied the facts
 * the rule needs.
 */
public record Condition(
        String id,
        String label,
        @JsonProperty("rule") @JsonRawValue String ruleJson,
        Evidence evidence,
        @JsonIgnore Set<String> referencedFields) {

    public Condition {
        referencedFields = referencedFields == null
                ? Set.of()
                : Collections.unmodifiableSet(new LinkedHashSet<>(referencedFields));
    }
}
