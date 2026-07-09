import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyMessage } from "viem";
import { logLoginActivity } from "@/lib/db/activity";
import {
  createSessionForUser,
  sessionCookieOptions,
  upsertWalletUser,
} from "@/lib/db/auth";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(`auth:wallet:${ip}`, {
      max: 10,
      windowMs: 60_000,
    });
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

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
