package in.yojanasaathi.vocabulary;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/** One entry from data/vocabulary.json. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FieldSpec(
        String type,
        String unit,
        Boolean required,
        List<String> values,
        Long min,
        Long max,
        String description) {

    public boolean isRequired() {
        return Boolean.TRUE.equals(required);
    }
}
