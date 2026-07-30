import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logLogoutActivity } from "@/lib/db/activity";
import {
  clearSessionCookieOptions,
  deleteSessionByToken,
  getSessionByToken,
} from "@/lib/db/auth";
import { AUTH_COOKIE } from "@/lib/auth-session";
import { sanitizeRedirectPath } from "@/lib/sanitize-redirect";
import { logWorkspaceSecurityEvent } from "@/lib/security-logging";
import { extractSecurityContext } from "@/lib/request-security";

function applyClearedSessionCookie(response: NextResponse) {
  const clear = clearSessionCookieOptions();
  response.cookies.set(clear.name, clear.value, {
    httpOnly: clear.httpOnly,
    sameSite: clear.sameSite,
    secure: clear.secure,
    path: clear.path,
    maxAge: clear.maxAge,
  });
  return response;
}

async function clearAuthSession(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (token) {
    const session = await getSessionByToken(token);
    if (session) {
      await logLogoutActivity(session.workspace._id);
      await logWorkspaceSecurityEvent({
        workspaceId: session.workspace._id,
        actorType: "user",
        actorId: session.user._id.toString(),
        action: "human_logout",
        security: extractSecurityContext(request),
      });
    }
    await deleteSessionByToken(token);
  }
}

export async function GET(request: Request) {
  await clearAuthSession(request);

  const url = new URL(request.url);
  const next = sanitizeRedirectPath(url.searchParams.get("next"), "/sign-in");
  const response = NextResponse.redirect(new URL(next, url.origin));
  return applyClearedSessionCookie(response);
}

export async function POST(request: Request) {
  await clearAuthSession(request);

  const cookieStore = await cookies();
  cookieStore.set(clearSessionCookieOptions());

  return NextResponse.json({ ok: true });
}
