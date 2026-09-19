package in.yojanasaathi.eligibility;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Finds every field a JSON Logic rule reads, by walking the rule for {@code var}
 * operators.
 *
 * Used for two things: rejecting, at load time, any rule that reaches outside
 * the field vocabulary; and telling the engine, before evaluation, which facts
 * a rule needs.
 *
 * Handles both {@code {"var": "age"}} and the defaulted form
 * {@code {"var": ["age", 0]}}, and reduces a dotted path such as
 * {@code "address.district"} to its first segment.
 */
public final class JsonLogicVars {

    private JsonLogicVars() {
    }

    public static Set<String> referencedFields(JsonNode rule) {
        Set<String> found = new LinkedHashSet<>();
        collect(rule, found);
        return found;
    }

    private static void collect(JsonNode node, Set<String> found) {
        if (node == null || node.isNull() || node.isValueNode()) {
            return;
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                collect(child, found);
            }
            return;
        }
        for (Map.Entry<String, JsonNode> entry : node.properties()) {
            JsonNode value = entry.getValue();
            if ("var".equals(entry.getKey())) {
                addVarName(value, found);
                // The default argument of {"var": [name, default]} may itself be
                // a nested rule, so keep walking everything after the name.
                if (value != null && value.isArray()) {
                    for (int i = 1; i < value.size(); i++) {
                        collect(value.get(i), found);
                    }
                }
            } else {
                collect(value, found);
            }
        }
    }

    private static void addVarName(JsonNode value, Set<String> found) {
        String name = null;
        if (value == null) {
            return;
        }
        if (value.isTextual()) {
            name = value.asText();
        } else if (value.isArray() && !value.isEmpty() && value.get(0).isTextual()) {
            name = value.get(0).asText();
        }
        if (name == null || name.isBlank()) {
            return;
        }
        int dot = name.indexOf('.');
        found.add(dot >= 0 ? name.substring(0, dot) : name);
    }
}
