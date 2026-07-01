import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyMessage } from "viem";
import { logLoginActivity } from "@/lib/db/activity";
import {
  createSessionForUser,
  sessionCookieOptions,
  upsertWalletUser,
} from "@/lib/db/auth";
import { ensureDbIndexes, seedWorkspaceDemoData } from "@/lib/db/seed";

export async function POST(request: Request) {
  try {
    await ensureDbIndexes();

    const body = (await request.json()) as {
      address?: string;
      message?: string;
      signature?: string;
    };

    const { address, message, signature } = body;

    if (!address || !message || !signature) {
      return NextResponse.json(
        { error: "Missing wallet verification payload" },
        { status: 400 },
      );
    }

    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (!message.startsWith("Sign in to LCX")) {
      return NextResponse.json({ error: "Invalid sign-in message" }, { status: 401 });
    }

    const user = await upsertWalletUser(address);
    if (!user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    const { token, workspace } = await createSessionForUser(
      user,
      "wallet",
      address,
    );
    await seedWorkspaceDemoData(workspace._id, user._id);
    await logLoginActivity(workspace._id, "wallet");

    const cookieStore = await cookies();
    cookieStore.set(sessionCookieOptions(token));

    return NextResponse.json({
      user: {
        name: user.name,
        role: user.role,
        initials: user.initials,
      },
      workspace: {
        name: workspace.name,
        slug: workspace.slug,
      },
    });
  } catch (error) {
    console.error("Wallet auth failed:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
