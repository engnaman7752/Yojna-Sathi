package in.yojanasaathi.eligibility;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.yojanasaathi.eligibility.domain.ConditionResult;
import in.yojanasaathi.eligibility.domain.HouseholdFacts;
import in.yojanasaathi.eligibility.domain.SchemeResult;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Runs every case in data/test_households.json through the real engine and
 * asserts the eligible set exactly.
 *
 * The ground truth is data, not code: this test never adjusts to make itself
 * pass. When a case fails, the message names the case id, the schemes that were
 * expected but not granted (with the condition labels that stopped them) and
 * the schemes that were granted but not expected, so the disagreement between
 * the rules and the engine can be settled by a human.
 */
@SpringBootTest
class EligibilityGroundTruthTest {

    private static final Path TEST_HOUSEHOLDS =
            Path.of(System.getProperty("yojana.data.dir", "../data")).resolve("test_households.json");

    @Autowired
    private EligibilityService eligibilityService;

    @ParameterizedTest(name = "{0}")
    @MethodSource("groundTruthCases")
    void household_qualifies_for_exactly_the_expected_schemes(String caseId, TestCase testCase) {
        assumeTrue(testCase != null,
                "data/test_households.json was not found at " + TEST_HOUSEHOLDS.toAbsolutePath()
                        + ". Phase 1 ground truth has not been supplied, so there is nothing to verify.");

        EligibilityOutcome outcome = eligibilityService.check(testCase.facts());

        Set<String> actual = new TreeSet<>(outcome.eligible().stream().map(SchemeResult::schemeId).toList());
        Set<String> expected = new TreeSet<>(testCase.expectedEligible() == null ? Set.of() : testCase.expectedEligible());

        assertEquals(expected, actual, () -> mismatchReport(testCase, expected, actual, outcome));
    }

    private static String mismatchReport(TestCase testCase, Set<String> expected, Set<String> actual,
                                         EligibilityOutcome outcome) {
        Set<String> expectedNotGranted = new LinkedHashSet<>(expected);
        expectedNotGranted.removeAll(actual);
        Set<String> grantedNotExpected = new LinkedHashSet<>(actual);
        grantedNotExpected.removeAll(expected);

        StringBuilder report = new StringBuilder();
        report.append("\n\nCASE ").append(testCase.id());
        if (testCase.description() != null && !testCase.description().isBlank()) {
            report.append(" - ").append(testCase.description());
        }
        report.append("\n  expected eligible : ").append(expected);
        report.append("\n  actual eligible   : ").append(actual);

        if (!expectedNotGranted.isEmpty()) {
            report.append("\n\n  EXPECTED BUT NOT GRANTED - the engine failed these conditions:");
            for (String schemeId : expectedNotGranted) {
                report.append("\n    ").append(schemeId).append(':');
                SchemeResult result = outcome.notEligible().stream()
                        .filter(r -> r.schemeId().equals(schemeId))
                        .findFirst()
                        .orElse(null);
                if (result == null) {
                    report.append("\n      (not evaluated at all - it is not PUBLISHED, or its state does not match "
                            + "this household's state of ")
                            .append(testCase.facts().state())
                            .append(')');
                    continue;
                }
                for (ConditionResult condition : result.failedConditions()) {
                    report.append("\n      - [").append(condition.conditionId()).append("] ")
                            .append(condition.label());
                    if (condition.detail() != null) {
                        report.append(" (").append(condition.detail()).append(')');
                    }
                }
            }
        }
        if (!grantedNotExpected.isEmpty()) {
            report.append("\n\n  GRANTED BUT NOT EXPECTED - every condition of these passed:");
            for (String schemeId : grantedNotExpected) {
                report.append("\n    ").append(schemeId);
            }
        }
        report.append("\n\n  Either data/schemes/ says something different from what you intended, "
                + "or the engine is wrong. The engine does not get to decide which.\n");
        return report.toString();
    }

    static Stream<Arguments> groundTruthCases() {
        if (!Files.isReadable(TEST_HOUSEHOLDS)) {
            return Stream.of(Arguments.of("no ground truth supplied", null));
        }
        GroundTruth groundTruth;
        try {
            groundTruth = new ObjectMapper().readValue(TEST_HOUSEHOLDS.toFile(), GroundTruth.class);
        } catch (IOException e) {
            throw new IllegalStateException(
                    "data/test_households.json could not be read: " + e.getMessage(), e);
        }
        if (groundTruth.cases() == null || groundTruth.cases().isEmpty()) {
            throw new IllegalStateException("data/test_households.json contains no cases.");
        }
        for (TestCase testCase : groundTruth.cases()) {
            if (testCase.id() == null || testCase.id().isBlank()) {
                throw new IllegalStateException("Every case in data/test_households.json needs an \"id\".");
            }
            if (testCase.facts() == null) {
                throw new IllegalStateException("Case " + testCase.id() + " has no \"facts\".");
            }
        }
        return groundTruth.cases().stream().map(c -> Arguments.of(c.id(), c));
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GroundTruth(List<TestCase> cases) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TestCase(String id, String description, HouseholdFacts facts, Set<String> expectedEligible) {
    }
}
