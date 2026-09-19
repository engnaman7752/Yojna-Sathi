package in.yojanasaathi.eligibility.domain;

import java.util.Collections;
import java.util.List;

/**
 * One version of one scheme, as loaded from data/schemes/*.json.
 *
 * {@code state} is either a state name or the reserved value {@link #CENTRAL}
 * ("ALL"), which marks a central scheme available in every state.
 */
public record SchemeVersion(
        String schemeId,
        String name,
        String state,
        int version,
        VersionStatus status,
        List<Condition> conditions) {

    /** Reserved value of {@code state} meaning "central scheme, all states". */
    public static final String CENTRAL = "ALL";

    public SchemeVersion {
        conditions = conditions == null ? List.of() : Collections.unmodifiableList(List.copyOf(conditions));
    }

    public boolean isPublished() {
        return status == VersionStatus.PUBLISHED;
    }

    public boolean isCentral() {
        return CENTRAL.equalsIgnoreCase(state);
    }

    /** True if this scheme applies to a household living in {@code householdState}. */
    public boolean appliesInState(String householdState) {
        return isCentral() || (householdState != null && householdState.trim().equalsIgnoreCase(state));
    }

    /** Stable identity used in log and error messages. */
    public String reference() {
        return schemeId + " v" + version;
    }
}
