import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { logLoginActivity } from "@/lib/db/activity";
import { logSecurityEvent } from "@/lib/db/security-audit";
import {
  createSessionForUser,
  sessionCookieOptions,
  upsertGoogleUser,
} from "@/lib/db/auth";
import {
  exchangeGoogleAuthCode,
  fetchGoogleUserProfile,
  GOOGLE_OAUTH_REDIRECT_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  isGoogleOAuthConfigured,
  verifyGoogleOAuthState,
} from "@/lib/google-oauth";
import { parseReferralCookie } from "@/lib/referrals";
import { extractSecurityContext } from "@/lib/request-security";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";

function clearOAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE);
  cookieStore.delete(GOOGLE_OAUTH_REDIRECT_COOKIE);
}

function redirectToSignIn(request: Request, error?: string) {
  const url = new URL("/sign-in", request.url);
  if (error) {
    url.searchParams.set("error", error);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  if (!isGoogleOAuthConfigured()) {
    return redirectToSignIn(request, "google_not_configured");
  }

  const ip = getClientIp(request);
  const limit = await checkRateLimit(`auth:google-callback:${ip}`, {
    max: 20,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return rateLimitResponse(limit);
  }

  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const redirectPath =
    cookieStore.get(GOOGLE_OAUTH_REDIRECT_COOKIE)?.value ?? "/dashboard";

  if (error) {
    clearOAuthCookies(cookieStore);
    return redirectToSignIn(request, "google_auth_denied");
  }

  if (!code || !state || !storedState || state !== storedState) {
    clearOAuthCookies(cookieStore);
    return redirectToSignIn(request, "google_auth_invalid");
  }

  if (!verifyGoogleOAuthState(state)) {
    clearOAuthCookies(cookieStore);
    return redirectToSignIn(request, "google_auth_invalid");
  }

  try {
    const accessToken = await exchangeGoogleAuthCode(code);
    const profile = await fetchGoogleUserProfile(accessToken);

    const user = await upsertGoogleUser({
      email: profile.email,
      name: profile.name,
      referralCode: parseReferralCookie(request.headers.get("cookie")),
    });

    if (!user) {
      clearOAuthCookies(cookieStore);
      return redirectToSignIn(request, "google_auth_failed");
    }

    const { token, workspace } = await createSessionForUser(user, "google");
    await logLoginActivity(workspace._id, "google");
    await logSecurityEvent({
      workspaceId: workspace._id,
      actorType: "user",
      actorId: user._id.toString(),
      action: "human_login_google",
      resourceType: "session",
      security: extractSecurityContext(request),
    });

    cookieStore.set(sessionCookieOptions(token));
    clearOAuthCookies(cookieStore);

    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (authError) {
    console.error("Google auth callback failed:", authError);
    clearOAuthCookies(cookieStore);
    return redirectToSignIn(request, "google_auth_failed");
  }
}
