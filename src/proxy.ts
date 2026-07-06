import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-session";
import { clearSessionCookieOptions, getSessionByToken } from "@/lib/db/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  const session = token ? await getSessionByToken(token) : null;
  const hasValidSession = Boolean(session);

  const isAuthRoute = pathname === "/sign-in" || pathname === "/sign-up";
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/invoice") ||
    pathname.startsWith("/manage-invoices") ||
    pathname.startsWith("/payment-links");

  if (isProtected && !hasValidSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(url);
    if (token) {
      applyClearSessionCookie(response);
    }
    return response;
  }

  if (isAuthRoute && hasValidSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

function applyClearSessionCookie(response: NextResponse) {
  const options = clearSessionCookieOptions();
  response.cookies.set(options.name, options.value, {
    httpOnly: options.httpOnly,
    sameSite: options.sameSite,
    secure: options.secure,
    path: options.path,
    maxAge: options.maxAge,
  });
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
    "/payment-links",
    "/payment-links/:path*",
    "/sign-in",
    "/sign-up",
  ],
};
