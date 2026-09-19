package in.yojanasaathi.eligibility;

import in.yojanasaathi.eligibility.domain.HouseholdFacts;
import in.yojanasaathi.eligibility.domain.SchemeResult;
import in.yojanasaathi.eligibility.domain.SchemeVersion;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Decides which schemes a household qualifies for.
 *
 * Two filters apply before any rule runs, and both are load-bearing:
 * only PUBLISHED versions are ever evaluated, because a citizen must never see
 * the effect of a draft; and only central schemes (state "ALL") plus the
 * household's own state, because a scheme from another state is not merely
 * failed, it is not applicable.
 */
@Service
public class EligibilityService {

    private static final Logger log = LoggerFactory.getLogger(EligibilityService.class);

    private final SchemeRepository schemes;
    private final RuleEngine ruleEngine;

    public EligibilityService(SchemeRepository schemes, RuleEngine ruleEngine) {
        this.schemes = schemes;
        this.ruleEngine = ruleEngine;
    }

    public EligibilityOutcome check(HouseholdFacts facts) {
        if (facts == null) {
            throw new IllegalArgumentException("Household facts are required.");
        }
        String state = facts.state();
        if (state == null || state.isBlank()) {
            throw new IllegalArgumentException(
                    "Household facts must include \"state\"; it decides which schemes apply.");
        }
        if (SchemeVersion.CENTRAL.equalsIgnoreCase(state.trim())) {
            throw new IllegalArgumentException(
                    "\"ALL\" is the reserved marker for a central scheme and is not a household's state.");
        }

        List<SchemeVersion> applicable = schemes.publishedSchemesFor(state);
        List<SchemeResult> eligible = new ArrayList<>();
        List<SchemeResult> notEligible = new ArrayList<>();
        for (SchemeVersion scheme : applicable) {
            SchemeResult result = ruleEngine.evaluate(scheme, facts);
            (result.eligible() ? eligible : notEligible).add(result);
        }
        log.debug("Evaluated {} published scheme(s) for a household in {}: {} eligible, {} not",
                applicable.size(), state, eligible.size(), notEligible.size());
        return new EligibilityOutcome(List.copyOf(eligible), List.copyOf(notEligible));
    }
}
