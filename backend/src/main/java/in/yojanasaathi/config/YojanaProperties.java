package in.yojanasaathi.config;

import in.yojanasaathi.eligibility.MissingFieldPolicy;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Phase 1 configuration. Bound from the "yojana" prefix in application.yml. */
@ConfigurationProperties(prefix = "yojana")
public record YojanaProperties(@DefaultValue Data data, @DefaultValue Eligibility eligibility) {

    public record Data(@DefaultValue("../data") String dir) {
    }

    public record Eligibility(@DefaultValue("STRICT") MissingFieldPolicy missingFieldPolicy) {
    }
}
