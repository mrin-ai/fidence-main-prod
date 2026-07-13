import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { logLoginActivity } from "@/lib/db/activity";
import { logSecurityEvent } from "@/lib/db/security-audit";
import {
  createSessionForUser,
  sessionCookieOptions,
  upsertWalletUser,
} from "@/lib/db/auth";
import { parseReferralCookie } from "@/lib/referrals";
import { extractSecurityContext } from "@/lib/request-security";
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
      referralCode?: string;
    };

    const { address, message, signature, referralCode: bodyReferralCode } = body;

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
    }).catch(() => false);

    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (!message.startsWith("Sign in to LCX")) {
      return NextResponse.json({ error: "Invalid sign-in message" }, { status: 401 });
    }

    const referralCode =
      bodyReferralCode?.trim() || parseReferralCookie(request.headers.get("cookie"));

    const user = await upsertWalletUser(address, referralCode);
    if (!user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    const { token, workspace } = await createSessionForUser(
      user,
      "wallet",
      address,
    );

    try {
      await logLoginActivity(workspace._id, "wallet");
      await logSecurityEvent({
        workspaceId: workspace._id,
        actorType: "user",
        actorId: user._id.toString(),
        action: "human_login_wallet",
        resourceType: "session",
        security: extractSecurityContext(request),
      });
    } catch (logError) {
      console.error("Wallet auth audit logging failed:", logError);
    }

    const response = NextResponse.json({
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
    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (error) {
    console.error("Wallet auth failed:", error);
    const message =
      error instanceof Error &&
      /MongoServerSelectionError|ECONNREFUSED|ENOTFOUND|timed out/i.test(
        error.message,
      )
        ? "Database connection failed. Check server configuration."
        : "Authentication failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
