package in.yojanasaathi.eligibility;

import in.yojanasaathi.eligibility.domain.SchemeResult;
import java.util.List;

/** Everything one eligibility check produced, split by verdict. */
public record EligibilityOutcome(List<SchemeResult> eligible, List<SchemeResult> notEligible) {

    public int schemesEvaluated() {
        return eligible.size() + notEligible.size();
    }
}
