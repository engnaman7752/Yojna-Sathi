package in.yojanasaathi.eligibility.web;

import in.yojanasaathi.eligibility.EligibilityOutcome;
import in.yojanasaathi.eligibility.domain.SchemeResult;
import java.util.List;

/**
 * Response of POST /api/eligibility/check.
 *
 * Each not-eligible scheme carries its failed conditions with their labels, so
 * the caller can say why not without a second request and without re-reading
 * the rules.
 */
public record EligibilityCheckResponse(
        String correlationId,
        int schemesEvaluated,
        List<SchemeResult> eligible,
        List<SchemeResult> notEligible) {

    public static EligibilityCheckResponse from(EligibilityOutcome outcome, String correlationId) {
        return new EligibilityCheckResponse(
                correlationId, outcome.schemesEvaluated(), outcome.eligible(), outcome.notEligible());
    }
}
