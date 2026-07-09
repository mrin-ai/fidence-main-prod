import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/db/auth";
import { getDashboardOverview } from "@/lib/db/dashboard";
import { buildProfileUrl } from "@/lib/profile-url";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overview = await getDashboardOverview(session.workspace._id);

  return NextResponse.json({
    ...overview,
    user: {
      name: session.user.name,
      role: session.user.role,
      initials: session.user.initials,
    },
    workspace: {
      name: session.workspace.name,
      slug: session.workspace.slug,
      paymentLink: session.user.username
        ? buildProfileUrl(session.user.username)
        : overview.workspace.paymentLink,
    },
  });
}
