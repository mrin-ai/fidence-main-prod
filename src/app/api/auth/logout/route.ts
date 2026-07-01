import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  clearSessionCookieOptions,
  deleteSessionByToken,
} from "@/lib/db/auth";
import { AUTH_COOKIE } from "@/lib/auth-session";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (token) {
    await deleteSessionByToken(token);
  }

  cookieStore.set(clearSessionCookieOptions());

  return NextResponse.json({ ok: true });
}
