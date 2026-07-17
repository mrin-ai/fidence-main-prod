import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-session";
import { sanitizeRedirectPath } from "@/lib/sanitize-redirect";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  const isAuthRoute = pathname === "/sign-in" || pathname === "/sign-up";
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
    pathname.startsWith("/merchant");

  if (isProtected && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && token) {
    const destination = sanitizeRedirectPath(
      request.nextUrl.searchParams.get("redirect"),
    );
    const url = request.nextUrl.clone();
    url.pathname = destination;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
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
    "/wallets",
    "/wallets/:path*",
    "/sign-in",
    "/sign-up",
  ],
};
