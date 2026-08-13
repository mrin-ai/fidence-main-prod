import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-session";
import { sanitizeRedirectPath } from "@/lib/sanitize-redirect";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  const isAuthRoute = pathname === "/sign-in" || pathname === "/sign-up";
  const isOnboarding =
    pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  if (isOnboarding) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/wallets") ||
    pathname.startsWith("/invoice") ||
    pathname.startsWith("/manage-invoices") ||
    pathname.startsWith("/activity") ||
    pathname.startsWith("/payment-links") ||
    pathname.startsWith("/referrals") ||
    pathname.startsWith("/rewards") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/merchant") ||
    pathname.startsWith("/pay");

  if (isProtected && !token) {
    const redirectTarget = `${pathname}${request.nextUrl.search}`;
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    url.searchParams.set("redirect", redirectTarget);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && token) {
    const destination = sanitizeRedirectPath(
      request.nextUrl.searchParams.get("redirect"),
    );
    const url = request.nextUrl.clone();
    // Session may still need username; shell onboarding modal handles it.
    url.pathname = destination;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/onboarding",
    "/onboarding/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/settings",
    "/settings/:path*",
    "/invoice",
    "/invoice/:path*",
    "/manage-invoices",
    "/manage-invoices/:path*",
    "/activity",
    "/activity/:path*",
    "/payment-links",
    "/payment-links/:path*",
    "/referrals",
    "/referrals/:path*",
    "/rewards",
    "/rewards/:path*",
    "/transactions",
    "/transactions/:path*",
    "/merchant",
    "/merchant/:path*",
    "/pay",
    "/pay/:path*",
    "/wallets",
    "/wallets/:path*",
    "/sign-in",
    "/sign-up",
  ],
};
