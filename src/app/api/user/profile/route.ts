import { NextResponse } from "next/server";

import {
  logProfileUpdatedActivity,
  logUsernameUpdatedActivity,
} from "@/lib/db/activity";
import { getSessionFromCookies } from "@/lib/db/auth";
import {
  updateUserPersonalInfo,
  updateUsername,
  validateUsername,
} from "@/lib/db/profile";

export async function PATCH(request: Request) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    section?: "personal" | "username";
    firstName?: string;
    lastName?: string;
    phone?: string;
    company?: string;
    username?: string;
  };

  if (body.section === "username") {
    if (typeof body.username !== "string") {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const validation = validateUsername(body.username);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const result = await updateUsername(session.user._id, body.username);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    if (result.user?.username) {
      await logUsernameUpdatedActivity({
        workspaceId: session.workspace._id,
        username: result.user.username,
      });
    }

    return NextResponse.json({
      username: result.user?.username,
      initials: result.user?.initials,
      name: result.user?.name,
    });
  }

  if (body.section === "personal") {
    const user = await updateUserPersonalInfo(session.user._id, {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      company: body.company,
    });

    await logProfileUpdatedActivity(session.workspace._id);

    return NextResponse.json({
      name: user?.name,
      initials: user?.initials,
      profile: user?.profile ?? {},
    });
  }

  return NextResponse.json({ error: "Invalid section" }, { status: 400 });
}
