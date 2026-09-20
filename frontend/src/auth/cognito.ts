/// <reference types="vite/client" />
import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";

/**
 * OIDC / Cognito Hosted UI configuration.
 *
 * The whole point of using an off-the-shelf OIDC library here is that we do
 * NOT hand-roll the OAuth2 authorization-code flow, do NOT store any client
 * secret in the browser (we don't have one), and do NOT verify JWTs on the
 * frontend at all - the backend does that. This module only knows how to
 * kick users off to Cognito's login page and pick them up on the way back.
 *
 * `automaticSilentRenew: true` refreshes the access token in the background
 * before it expires (Cognito issues short-lived access tokens with a longer
 * refresh token; the library handles the dance).
 */
const authority = import.meta.env.VITE_COGNITO_ISSUER;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;
const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;

if (!authority || !clientId || !redirectUri || !cognitoDomain) {
  console.error("Cognito env vars missing", { authority, clientId, redirectUri, cognitoDomain });
}

// Dynamically replace localhost with the current window origin if we are deployed
const safeRedirectUri = redirectUri && redirectUri.includes("localhost") && window.location.hostname !== "localhost"
  ? `${window.location.origin}/callback`
  : redirectUri;

let userManager: UserManager | null = null;
try {
  userManager = new UserManager({
    authority: authority || "https://missing",
    client_id: clientId || "missing",
    redirect_uri: safeRedirectUri || "http://missing",
    post_logout_redirect_uri: window.location.origin,
    response_type: "code",
    scope: "openid email profile",
    loadUserInfo: false, // Cognito's /userInfo works but is redundant; /api/me is authoritative
    automaticSilentRenew: true,
    // Store tokens in localStorage so a page refresh keeps you signed in.
    // Session storage would be safer but less convenient; for a government
    // portal we'll harden this later (HttpOnly cookie-backed BFF is the real
    // production pattern - deferred to Session 5.)
    userStore: new WebStorageStateStore({ store: window.localStorage }),
  });
} catch (e) {
  console.error("Failed to initialize UserManager", e);
}

export async function signIn(): Promise<void> {
  if (!userManager) {
    alert("Cognito configuration is missing! Check your environment variables.");
    return;
  }
  await userManager.signinRedirect();
}

export async function completeSignIn(): Promise<User> {
  if (!userManager) throw new Error("No userManager configured");
  return userManager.signinRedirectCallback();
}

export async function signOut(): Promise<void> {
  if (!userManager) return;
  const user = await userManager.getUser();
  await userManager.removeUser();
  const logoutUrl = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(window.location.origin)}`;
  // Best-effort: even if the redirect fails, local state is cleared.
  if (user) window.location.assign(logoutUrl);
  else window.location.assign(window.location.origin);
}

export async function getCurrentUser(): Promise<User | null> {
  return userManager ? userManager.getUser() : null;
}
