package in.yojanasaathi.eligibility;

import io.github.jamsesso.jsonlogic.JsonLogic;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * The single point at which this codebase touches json-logic-java.
 *
 * Everything else in the engine speaks in terms of a rule string and a fact
 * map, so swapping the JSON Logic implementation, or adapting to a change in
 * its API, means editing this class and nothing else.
 *
 * {@link JsonLogic} is documented as thread-safe, so one instance is shared.
 */
@Component
public class JsonLogicEvaluator {

    private final JsonLogic jsonLogic = new JsonLogic();

    /**
     * @return whatever the rule evaluates to; the caller decides whether a
     *         non-boolean result is acceptable.
     * @throws Exception if the rule is malformed or uses an unknown operator
     */
    public Object apply(String ruleJson, Map<String, Object> facts) throws Exception {
        return jsonLogic.apply(ruleJson, facts);
    }
}
