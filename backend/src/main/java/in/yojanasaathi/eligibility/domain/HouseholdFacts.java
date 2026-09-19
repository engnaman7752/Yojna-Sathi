package in.yojanasaathi.eligibility.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The facts a rule may be evaluated against. Exactly the field vocabulary from
 * PROJECT_BRIEF.md, nothing more.
 *
 * Every field is boxed so that "not supplied" (null) is distinguishable from a
 * real value such as 0. That distinction matters: a household that did not
 * answer the pension question is not the same as a household with no pension,
 * and treating the two alike is how a rule engine quietly denies someone a
 * benefit. Money is in whole rupees and land in whole square metres, so the
 * numeric types are integral by design; no field is a floating point number.
 */
@JsonIgnoreProperties(ignoreUnknown = false)
public record HouseholdFacts(
        String state,
        String district,
        Long annualIncome,
        Long monthlyPension,
        Boolean ownsCultivableLand,
        Long landAreaSqm,
        Boolean paysIncomeTax,
        String socialCategory,
        Integer age,
        String gender,
        String maritalStatus,
        Integer disabilityPercent,
        Integer studentClass) {

    /**
     * The data map handed to the rule evaluator. Only supplied facts are
     * present, so a missing key means "not supplied" rather than null, and the
     * engine can detect it before evaluating rather than after.
     */
    public Map<String, Object> asMap() {
        Map<String, Object> map = new LinkedHashMap<>();
        putIfPresent(map, "state", state);
        putIfPresent(map, "district", district);
        putIfPresent(map, "annualIncome", annualIncome);
        putIfPresent(map, "monthlyPension", monthlyPension);
        putIfPresent(map, "ownsCultivableLand", ownsCultivableLand);
        putIfPresent(map, "landAreaSqm", landAreaSqm);
        putIfPresent(map, "paysIncomeTax", paysIncomeTax);
        putIfPresent(map, "socialCategory", socialCategory);
        putIfPresent(map, "age", age);
        putIfPresent(map, "gender", gender);
        putIfPresent(map, "maritalStatus", maritalStatus);
        putIfPresent(map, "disabilityPercent", disabilityPercent);
        putIfPresent(map, "studentClass", studentClass);
        return map;
    }

    private static void putIfPresent(Map<String, Object> map, String key, Object value) {
        if (value != null) {
            map.put(key, value);
        }
    }
}
