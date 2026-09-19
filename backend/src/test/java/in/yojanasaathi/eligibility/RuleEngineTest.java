package in.yojanasaathi.eligibility;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.yojanasaathi.config.YojanaProperties;
import in.yojanasaathi.eligibility.domain.Condition;
import in.yojanasaathi.eligibility.domain.HouseholdFacts;
import in.yojanasaathi.eligibility.domain.SchemeResult;
import in.yojanasaathi.eligibility.domain.SchemeVersion;
import in.yojanasaathi.eligibility.domain.VersionStatus;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Mechanics of the rule engine, using throwaway conditions built in the test.
 *
 * These are not scheme rules and must never be mistaken for them: real rules
 * live in data/schemes/ and are verified by EligibilityGroundTruthTest.
 */
class RuleEngineTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static RuleEngine engineWith(MissingFieldPolicy policy) {
        return new RuleEngine(
                new JsonLogicEvaluator(),
                new YojanaProperties(
                        new YojanaProperties.Data("../data"),
                        new YojanaProperties.Eligibility(policy)));
    }

    private static Condition condition(String id, String label, String ruleJson) {
        try {
            return new Condition(id, label, ruleJson, null,
                    JsonLogicVars.referencedFields(MAPPER.readTree(ruleJson)));
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("test rule is not valid JSON: " + ruleJson, e);
        }
    }

    private static SchemeVersion scheme(Condition... conditions) {
        return new SchemeVersion("test-scheme", "Test scheme", SchemeVersion.CENTRAL, 1,
                VersionStatus.PUBLISHED, List.of(conditions));
    }

    private static HouseholdFacts facts() {
        return new HouseholdFacts("BIHAR", "PATNA", 90_000L, 0L, true, 4047L, false,
                "OBC", 41, "F", "WIDOWED", 0, null);
    }

    @Test
    @DisplayName("all conditions pass -> eligible, every condition reported")
    void eligible_when_every_condition_passes() {
        SchemeResult result = engineWith(MissingFieldPolicy.STRICT).evaluate(
                scheme(
                        condition("income", "Annual income must be 1,00,000 rupees or less",
                                "{\"<=\":[{\"var\":\"annualIncome\"},100000]}"),
                        condition("land", "Household must own cultivable land",
                                "{\"==\":[{\"var\":\"ownsCultivableLand\"},true]}")),
                facts());

        assertTrue(result.eligible());
        assertEquals(2, result.conditions().size());
        assertTrue(result.failedConditions().isEmpty());
    }

    @Test
    @DisplayName("one condition fails -> not eligible, and that condition's label explains why")
    void reports_the_label_of_the_condition_that_failed() {
        SchemeResult result = engineWith(MissingFieldPolicy.STRICT).evaluate(
                scheme(
                        condition("income", "Annual income must be 1,00,000 rupees or less",
                                "{\"<=\":[{\"var\":\"annualIncome\"},100000]}"),
                        condition("age", "Applicant must be 60 or older",
                                "{\">=\":[{\"var\":\"age\"},60]}")),
                facts());

        assertFalse(result.eligible());
        assertEquals(List.of("Applicant must be 60 or older"), result.failedConditionLabels());
        assertEquals("age", result.failedConditions().get(0).conditionId());
    }

    @Test
    @DisplayName("STRICT: a rule reading a fact the household did not supply throws, naming scheme and condition")
    void strict_policy_throws_on_missing_fact() {
        RuleEvaluationException thrown = assertThrows(RuleEvaluationException.class, () ->
                engineWith(MissingFieldPolicy.STRICT).evaluate(
                        scheme(condition("class", "Must be enrolled in class 9 or above",
                                "{\">=\":[{\"var\":\"studentClass\"},9]}")),
                        facts()));

        assertEquals("test-scheme", thrown.schemeId());
        assertEquals("class", thrown.conditionId());
        assertTrue(thrown.getMessage().contains("studentClass"), thrown.getMessage());
        // Crucially it is NOT silently reported as "not eligible".
    }

    @Test
    @DisplayName("FAIL_CONDITION: the same missing fact fails that one condition and says so")
    void lenient_policy_fails_the_condition_instead() {
        SchemeResult result = engineWith(MissingFieldPolicy.FAIL_CONDITION).evaluate(
                scheme(condition("class", "Must be enrolled in class 9 or above",
                        "{\">=\":[{\"var\":\"studentClass\"},9]}")),
                facts());

        assertFalse(result.eligible());
        assertEquals("information missing: studentClass", result.failedConditions().get(0).detail());
    }

    @Test
    @DisplayName("a rule that does not return a boolean throws rather than being coerced")
    void non_boolean_rule_result_throws() {
        RuleEvaluationException thrown = assertThrows(RuleEvaluationException.class, () ->
                engineWith(MissingFieldPolicy.STRICT).evaluate(
                        scheme(condition("bad", "Not a yes/no test", "{\"+\":[{\"var\":\"age\"},1]}")),
                        facts()));

        assertTrue(thrown.getMessage().contains("instead of true or false"), thrown.getMessage());
    }

    @Test
    @DisplayName("a rule using an unknown operator throws, naming scheme and condition")
    void unevaluable_rule_throws() {
        RuleEvaluationException thrown = assertThrows(RuleEvaluationException.class, () ->
                engineWith(MissingFieldPolicy.STRICT).evaluate(
                        scheme(condition("bad", "Nonsense", "{\"noSuchOperator\":[{\"var\":\"age\"},1]}")),
                        facts()));

        assertTrue(thrown.getMessage().contains("test-scheme"), thrown.getMessage());
        assertTrue(thrown.getMessage().contains("bad"), thrown.getMessage());
    }
}
