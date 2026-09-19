package in.yojanasaathi.eligibility;

/**
 * A rule could not be evaluated. This is a defect in the scheme data or in the
 * facts supplied, never a statement about the household, and is deliberately
 * not collapsed into "not eligible".
 */
public class RuleEvaluationException extends RuntimeException {

    private final String schemeId;
    private final int version;
    private final String conditionId;

    public RuleEvaluationException(String schemeId, int version, String conditionId, String reason, Throwable cause) {
        super("Scheme '" + schemeId + "' v" + version + ", condition '" + conditionId + "': " + reason, cause);
        this.schemeId = schemeId;
        this.version = version;
        this.conditionId = conditionId;
    }

    public String schemeId() {
        return schemeId;
    }

    public int version() {
        return version;
    }

    public String conditionId() {
        return conditionId;
    }
}
