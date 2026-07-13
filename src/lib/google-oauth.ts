import { createHmac, randomBytes, timingSafeEqual } from "crypto";

import { getPaymentBaseUrl } from "@/lib/payment-link-url";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export const GOOGLE_OAUTH_STATE_COOKIE = "lcx-google-oauth-state";
export const GOOGLE_OAUTH_REDIRECT_COOKIE = "lcx-google-oauth-redirect";

function getGoogleClientId() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  return clientId;
}

function getGoogleClientSecret() {
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    throw new Error("GOOGLE_CLIENT_SECRET is not configured");
  }
  return clientSecret;
}

function getAuthSecret() {
  const secret =
    process.env.AUTH_SECRET?.trim() ??
    process.env.CRON_SECRET?.trim() ??
    process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  return secret;
}

export function getGoogleRedirectUri(requestOrigin?: string) {
  return `${getPaymentBaseUrl(requestOrigin)}/api/auth/google/callback`;
}

export function isGoogleOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

export function createGoogleOAuthState() {
  const nonce = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", getAuthSecret())
    .update(nonce)
    .digest("hex");

  return `${nonce}.${signature}`;
}

export function verifyGoogleOAuthState(state: string) {
  const [nonce, signature] = state.split(".");
  if (!nonce || !signature) return false;

  const expected = createHmac("sha256", getAuthSecret())
    .update(nonce)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}

export function buildGoogleAuthUrl(state: string, requestOrigin?: string) {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getGoogleRedirectUri(requestOrigin),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleAuthCode(
  code: string,
  requestOrigin?: string,
) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: getGoogleRedirectUri(requestOrigin),
      grant_type: "authorization_code",
    }),
  });

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "Token exchange failed");
  }

  return data.access_token;
}

export async function fetchGoogleUserProfile(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = (await response.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    error?: string;
  };

  if (!response.ok || !data.email) {
    throw new Error(data.error ?? "Failed to load Google profile");
  }

  if (data.email_verified === false) {
    throw new Error("Google email is not verified");
  }

  return {
    email: data.email,
    name: data.name?.trim() || data.email.split("@")[0] || "Google User",
    picture: data.picture,
    sub: data.sub,
  };
}
