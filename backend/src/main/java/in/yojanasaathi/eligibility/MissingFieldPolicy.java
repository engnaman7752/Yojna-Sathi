package in.yojanasaathi.eligibility;

/**
 * What the engine does when a rule references a fact the household did not
 * supply. JSON Logic itself resolves an absent variable to null and carries on,
 * which would silently turn "we never asked" into "not eligible". Neither
 * option below does that.
 */
public enum MissingFieldPolicy {

    /** Throw, naming the scheme, the condition and the missing fields. */
    STRICT,

    /** Fail that one condition, with the missing fields named in the detail. */
    FAIL_CONDITION
}
