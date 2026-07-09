import { NextResponse } from "next/server";

import { getWorkspaceForUser } from "@/lib/db/auth";
import { getPublicProfileByUsername } from "@/lib/db/public-profile";
import {
  checkProfilePayRateLimit,
  recordProfilePayment,
} from "@/lib/db/profile-payments";
import { resolveRecipientAddress } from "@/lib/db/wallets";
import { getTokenById } from "@/lib/create-payment-link-data";
import { isReservedPaymentPathSegment } from "@/lib/payment-link-url";
import { normalizeUsername } from "@/lib/db/profile";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { UserDoc } from "@/lib/db/types";
import { supportsOnChainPayment } from "@/lib/payment-contracts";

type RouteContext = { params: Promise<{ username: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { username: rawUsername } = await context.params;
    const username = normalizeUsername(rawUsername);

    if (isReservedPaymentPathSegment(username)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (!checkProfilePayRateLimit(clientIp)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = (await request.json()) as {
      amount?: number;
      tokenId?: string;
      networkId?: string;
      payerAddress?: string;
      txHash?: string;
    };

    const amount = body.amount;
    const tokenId = body.tokenId?.trim();
    const networkId = body.networkId?.trim();
    const payerAddress = body.payerAddress?.trim();
    const txHash = body.txHash?.trim();

    if (
      amount == null ||
      !tokenId ||
      !networkId ||
      !payerAddress ||
      !txHash
    ) {
      return NextResponse.json(
        { error: "amount, tokenId, networkId, payerAddress, and txHash are required" },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
    }

    if (!supportsOnChainPayment(networkId, tokenId)) {
      return NextResponse.json(
        { error: "This token/network combination is not supported" },
        { status: 400 },
      );
    }

    const profile = await getPublicProfileByUsername(username);
    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const db = await getDb();
    const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
      username,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const recipientAddress = resolveRecipientAddress(user, networkId);
    if (!recipientAddress) {
      return NextResponse.json(
        { error: "Merchant has no verified wallet for this network" },
        { status: 400 },
      );
    }

    const workspace = await getWorkspaceForUser(user._id);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 500 });
    }

    const token = getTokenById(tokenId);

    const result = await recordProfilePayment({
      workspaceId: workspace._id,
      recipientUserId: user._id,
      recipientAddress,
      payerAddress,
      amount,
      tokenId,
      networkId,
      txHash,
      username,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      transactionId: result.transactionId,
      duplicate: result.duplicate,
      amount,
      symbol: token?.symbol ?? tokenId.toUpperCase(),
    });
  } catch (error) {
    console.error("Profile payment failed:", error);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
