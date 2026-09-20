package in.yojanasaathi.common;

/**
 * DELETED in Phase 3.
 *
 * This class used to serve GET /api/dev/auth and hand out unsigned string
 * "tokens" that anything on the internet could forge. It is replaced by Amazon
 * Cognito (Hosted UI + JWT resource server); the frontend redirects users to
 * Cognito's sign-in page and gets back a real, signed JWT that SecurityConfig
 * verifies on every request.
 *
 * Kept as an empty file (rather than deleted) because the connected folder is
 * read-only for deletes in this session. Safe to remove the file entirely once
 * you have delete permissions in your working folder.
 */
final class AuthControllerRemoved {
    private AuthControllerRemoved() {}
}
