import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSessionForUser,
  sessionCookieOptions,
  upsertGoogleUser,
} from "@/lib/db/auth";
import { ensureDbIndexes, seedWorkspaceDemoData } from "@/lib/db/seed";

export async function POST() {
  try {
    await ensureDbIndexes();

    const user = await upsertGoogleUser({
      email: "alex.rivera@lcx.ag",
      name: "Alex Rivera",
    });

    if (!user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    const { token, workspace } = await createSessionForUser(user, "google");
    await seedWorkspaceDemoData(workspace._id, user._id);

    const cookieStore = await cookies();
    cookieStore.set(sessionCookieOptions(token));

    return NextResponse.json({
      user: {
        name: user.name,
        role: user.role,
        initials: user.initials,
        email: user.email,
      },
      workspace: {
        name: workspace.name,
        slug: workspace.slug,
      },
    });
  } catch (error) {
    console.error("Google auth failed:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
