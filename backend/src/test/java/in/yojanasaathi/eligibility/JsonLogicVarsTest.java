package in.yojanasaathi.eligibility;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Field extraction is what stops a rule reaching outside the vocabulary, so it
 * has to find every "var" however it is written.
 */
class JsonLogicVarsTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static Set<String> fieldsOf(String ruleJson) throws JsonProcessingException {
        return JsonLogicVars.referencedFields(MAPPER.readTree(ruleJson));
    }

    @Test
    @DisplayName("finds vars nested inside and/or and comparison operators")
    void finds_nested_vars() throws Exception {
        assertEquals(
                Set.of("annualIncome", "paysIncomeTax", "socialCategory"),
                fieldsOf("{\"and\":["
                        + "{\"<\":[{\"var\":\"annualIncome\"},250000]},"
                        + "{\"==\":[{\"var\":\"paysIncomeTax\"},false]},"
                        + "{\"in\":[{\"var\":\"socialCategory\"},[\"SC\",\"ST\"]]}]}"));
    }

    @Test
    @DisplayName("handles the defaulted form {\"var\": [name, default]}")
    void handles_var_with_default() throws Exception {
        assertEquals(Set.of("monthlyPension"), fieldsOf("{\">\":[{\"var\":[\"monthlyPension\",0]},0]}"));
    }

    @Test
    @DisplayName("reduces a dotted path to its first segment")
    void reduces_dotted_path() throws Exception {
        assertEquals(Set.of("district"), fieldsOf("{\"==\":[{\"var\":\"district.name\"},\"PATNA\"]}"));
    }

    @Test
    @DisplayName("a rule with no var reads nothing")
    void no_vars() throws Exception {
        assertEquals(Set.of(), fieldsOf("{\"==\":[1,1]}"));
    }
}
