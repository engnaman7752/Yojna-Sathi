package in.yojanasaathi.persistence;

/**
 * Central definition of every PK/SK/GSI key format in the single table.
 *
 * Following the layout in PROJECT_BRIEF.md and infra/create-table.sh so that
 * the Java, the shell that creates the table, and the brief all agree. If
 * you invent a new key format, put it here first so it can be searched for.
 */
public final class Keys {
    private Keys() {}

    // ---------- Applications (Phase 2 addition) ----------
    public static String applicationPk(String id)      { return "APP#" + id; }
    public static String applicationSk()               { return "META"; }
    public static String applicationStatusGsi3Pk(String status) { return "APP_STATUS#" + status; }
    public static String applicationDistrictGsi2Pk(String district) { return "DISTRICT#" + district; }
    public static String applicationDistrictGsi2Sk(String id, String dateSubmitted) {
        // Sort by newest first (descending ISO timestamps work lexically when
        // paired with a stable id suffix as tiebreaker).
        return dateSubmitted + "#APP#" + id;
    }

    // ---------- Household (planned Session 5+) ----------
    public static String householdPk(String id)        { return "HOUSEHOLD#" + id; }
    public static String householdProfileSk()          { return "PROFILE"; }
    public static String consentSk(String operatorId)  { return "CONSENT#" + operatorId; }

    // ---------- Scheme (Session 5) ----------
    public static String schemePk(String schemeId)     { return "SCHEME#" + schemeId; }
    public static String schemeCurrentSk()             { return "CURRENT"; }
    public static String schemeVersionSk(int version)  { return "VERSION#" + version; }
    public static String schemeStatusGsi3Pk(String status) { return "SCHEME_STATUS#" + status; }

    public static final String TABLE_NAME_DEFAULT = "YojanaSaathi";
}
