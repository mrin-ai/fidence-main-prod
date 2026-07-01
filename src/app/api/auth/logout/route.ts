import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logLogoutActivity } from "@/lib/db/activity";
import {
  clearSessionCookieOptions,
  deleteSessionByToken,
  getSessionByToken,
} from "@/lib/db/auth";
import { AUTH_COOKIE } from "@/lib/auth-session";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (token) {
    const session = await getSessionByToken(token);
    if (session) {
      await logLogoutActivity(session.workspace._id);
    }
    await deleteSessionByToken(token);
  }

  cookieStore.set(clearSessionCookieOptions());

  return NextResponse.json({ ok: true });
}
