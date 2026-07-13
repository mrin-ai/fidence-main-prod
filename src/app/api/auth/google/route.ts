import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  buildGoogleAuthUrl,
  createGoogleOAuthState,
  GOOGLE_OAUTH_REDIRECT_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  isGoogleOAuthConfigured,
} from "@/lib/google-oauth";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";

function sanitizeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

export async function GET(request: Request) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Google sign-in is not configured" },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const limit = await checkRateLimit(`auth:google:${ip}`, {
    max: 10,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return rateLimitResponse(limit);
  }

  const { searchParams } = new URL(request.url);
  const redirect = sanitizeRedirectPath(searchParams.get("redirect"));
  const state = createGoogleOAuthState();

  const cookieStore = await cookies();
  cookieStore.set({
    name: GOOGLE_OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  cookieStore.set({
    name: GOOGLE_OAUTH_REDIRECT_COOKIE,
    value: redirect,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
