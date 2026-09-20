package in.yojanasaathi.auth;

import java.util.List;

/**
 * The authenticated caller, as understood by this service.
 *
 * `sub` is Cognito's stable user id (never the email or the display name -
 * users can change those). `email` and `name` come from the JWT claims and
 * are for display only. `roles` are the group names Cognito attached to this
 * user (e.g. "ADMIN", "CSC_OPERATOR"); the ROLE_ prefix Spring uses
 * internally is stripped here.
 *
 * IMPORTANT (per PROJECT_BRIEF rule 1): authorization DATA - which household
 * this caller may see, which district they belong to for scoping, whether a
 * consent is active - must never be read from JWT claims. Those come from
 * DynamoDB via a PrincipalLoader (next task). This record carries identity
 * only.
 */
public record Principal(String sub, String email, String name, List<String> roles) {
}
