import { NextResponse } from "next/server";

import {
  getPaymentLinkByUsernameAndPublicId,
  markPaymentLinkPaid,
} from "@/lib/db/payment-links";
import { getWorkspaceForUser } from "@/lib/db/auth";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { UserDoc } from "@/lib/db/types";
import { isReservedPaymentPathSegment } from "@/lib/payment-link-url";
import { logWorkspaceSecurityEvent } from "@/lib/security-logging";
import { extractSecurityContext } from "@/lib/request-security";

type RouteContext = {
  params: Promise<{ username: string; linkId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { username, linkId } = await context.params;

  if (isReservedPaymentPathSegment(username)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const link = await getPaymentLinkByUsernameAndPublicId(username, linkId);

  if (!link) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }

  return NextResponse.json(link);
}

export async function POST(request: Request, context: RouteContext) {
  const { username, linkId } = await context.params;

  if (isReservedPaymentPathSegment(username)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    payerAddress?: string;
    txHash?: string;
  };

  const payerAddress = body.payerAddress?.trim();
  const txHash = body.txHash?.trim();

  if (!payerAddress || !txHash) {
    return NextResponse.json(
      { error: "Wallet address and transaction hash are required" },
      { status: 400 },
    );
  }

  const result = await markPaymentLinkPaid({
    username,
    publicId: linkId,
    payerAddress,
    txHash,
    paidVia: "human",
  });

  if (!result.ok) {
    const status =
      result.error === "Payment link not found"
        ? 404
        : result.error === "This link has already been paid"
          ? 409
          : 400;

    return NextResponse.json({ error: result.error }, { status });
  }

  const db = await getDb();
  const merchant = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    username: username.trim().toLowerCase(),
  });
  const workspace = merchant ? await getWorkspaceForUser(merchant._id) : null;

  if (workspace) {
    await logWorkspaceSecurityEvent({
      workspaceId: workspace._id,
      actorType: "user",
      actorId: payerAddress,
      action: "human_payment_link_paid",
      resourceType: "payment_link",
      resourceId: linkId,
      security: extractSecurityContext(request),
    });
  }

  return NextResponse.json(result.link);
}
