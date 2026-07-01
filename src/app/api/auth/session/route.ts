import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/db/auth";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      name: session.user.name,
      role: session.user.role,
      initials: session.user.initials,
      email: session.user.email,
    },
    workspace: {
      name: session.workspace.name,
      slug: session.workspace.slug,
    },
  });
}
