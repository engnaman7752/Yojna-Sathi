package in.yojanasaathi.vocabulary;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * The field vocabulary, loaded once at startup from data/vocabulary.json.
 *
 * PROJECT_BRIEF.md: "Nothing outside this list may appear in a rule." That is
 * enforced by SchemeRepository at load time, which refuses to start the
 * application if a scheme references an unknown field.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record Vocabulary(int vocabularyVersion, Map<String, FieldSpec> fields) {

    public Vocabulary {
        fields = fields == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(fields));
    }

    public Set<String> fieldNames() {
        return fields.keySet();
    }

    public boolean knows(String fieldName) {
        return fields.containsKey(fieldName);
    }

    public FieldSpec spec(String fieldName) {
        return fields.get(fieldName);
    }
}
