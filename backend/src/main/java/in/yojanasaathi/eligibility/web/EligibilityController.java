package in.yojanasaathi.eligibility.web;

import in.yojanasaathi.common.CorrelationId;
import in.yojanasaathi.eligibility.EligibilityOutcome;
import in.yojanasaathi.eligibility.EligibilityService;
import in.yojanasaathi.eligibility.domain.HouseholdFacts;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Phase 1 endpoint. It takes facts in the request body and stores nothing:
 * households, consent and access logging all arrive in Phase 2, and the
 * authorization checks that must guard this endpoint arrive in Phase 3.
 */
@RestController
@RequestMapping("/api/eligibility")
public class EligibilityController {

    private final EligibilityService eligibilityService;

    public EligibilityController(EligibilityService eligibilityService) {
        this.eligibilityService = eligibilityService;
    }

    @PostMapping(path = "/check", consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public EligibilityCheckResponse check(@RequestBody HouseholdFacts facts, HttpServletRequest request) {
        EligibilityOutcome outcome = eligibilityService.check(facts);
        return EligibilityCheckResponse.from(outcome, CorrelationId.current(request));
    }
}
