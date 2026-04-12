/**
 * OIDC authentication service using oidc-client-ts.
 * Handles login, logout, token refresh, and silent renew.
 */

import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";

// Auto-detect OIDC authority from environment:
// - Vite env var (build-time) takes precedence
// - Otherwise, derive from current hostname pattern
function detectAuthority(): string {
  if (import.meta.env.VITE_OIDC_AUTHORITY) return import.meta.env.VITE_OIDC_AUTHORITY;
  const host = window.location.hostname;
  // Local dev: Keycloak on port 8082
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:8082/realms/openwebui";
  }
  // K8s/prod: derive SSO host from app host (myvault.X → mysso.X)
  const domain = host.replace(/^[^.]+\./, "");
  return `https://mysso.${domain}/realms/openwebui`;
}

const OIDC_AUTHORITY = detectAuthority();
const OIDC_CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID || "myvault";
const OIDC_REDIRECT_URI = `${window.location.origin}/`;

const userManager = new UserManager({
  authority: OIDC_AUTHORITY,
  client_id: OIDC_CLIENT_ID,
  redirect_uri: OIDC_REDIRECT_URI,
  post_logout_redirect_uri: OIDC_REDIRECT_URI,
  response_type: "code",
  scope: "openid profile email",
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
});

export async function login(): Promise<void> {
  await userManager.signinRedirect();
}

export async function handleCallback(): Promise<User> {
  return userManager.signinRedirectCallback();
}

export async function logout(): Promise<void> {
  await userManager.signoutRedirect();
}

export async function getUser(): Promise<User | null> {
  return userManager.getUser();
}

export async function getAccessToken(): Promise<string | null> {
  const user = await userManager.getUser();
  if (!user || user.expired) {
    return null;
  }
  return user.access_token;
}

export function onUserLoaded(callback: (user: User) => void): void {
  userManager.events.addUserLoaded(callback);
}

export function onUserUnloaded(callback: () => void): void {
  userManager.events.addUserUnloaded(callback);
}

export { type User };
