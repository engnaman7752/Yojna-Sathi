package in.yojanasaathi.auth;

import java.util.List;

import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET /api/me - who am I, according to the token you sent?
 *
 * The frontend calls this once after sign-in to know the user's real role
 * (rather than trusting anything in localStorage, which the user can edit).
 * Route guards on the frontend read from this response, not from the JWT
 * itself - the frontend never decodes the JWT for authorization decisions.
 */
@RestController
@RequestMapping("/api/me")
public class MeController {

    @GetMapping
    public Principal me(JwtAuthenticationToken auth) {
        Jwt jwt = auth.getToken();
        Object groupsClaim = jwt.getClaims().get("cognito:groups");
        List<String> groups = List.of();
        if (groupsClaim instanceof List<?> l) {
            groups = l.stream().filter(java.util.Objects::nonNull).map(Object::toString).toList();
        }
        return new Principal(
                jwt.getSubject(),
                jwt.getClaimAsString("email"),
                pickName(jwt),
                groups);
    }

    private static String pickName(Jwt jwt) {
        for (String claim : new String[]{"name", "given_name", "preferred_username", "email"}) {
            String v = jwt.getClaimAsString(claim);
            if (v != null && !v.isBlank()) return v;
        }
        return jwt.getSubject();
    }
}
