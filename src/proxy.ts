import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-session";
import { hasCachedSession } from "@/lib/cache/session-cache";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  const hasValidSession = token ? await hasCachedSession(token) : false;

  const isAuthRoute = pathname === "/sign-in" || pathname === "/sign-up";
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/wallets") ||
    pathname.startsWith("/invoice") ||
    pathname.startsWith("/manage-invoices") ||
    pathname.startsWith("/activity") ||
    pathname.startsWith("/payment-links");

  if (isProtected && !hasValidSession) {
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    // Cache miss with cookie present — defer to page/API auth (no Mongo in proxy).
    return NextResponse.next();
  }

  if (isAuthRoute && hasValidSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
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
    "/wallets",
    "/wallets/:path*",
    "/sign-in",
    "/sign-up",
  ],
};
