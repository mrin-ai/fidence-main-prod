import { NextResponse } from "next/server";

import {
  approvePaymentIntent,
  getPaymentIntentForWorkspace,
  rejectActionablePaymentIntent,
  rejectPaymentIntent,
  serializePaymentIntent,
} from "@/lib/db/payment-intents";
import { resolvePaymentIntentRecipientAddress } from "@/lib/db/payment-intent-settlement";
import { getPaySessionContext } from "@/lib/pay/session-api";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const ctx = await getPaySessionContext(request);
  if (!ctx.ok) return ctx.response;

  const { id } = await params;
  const body = (await request.json()) as { action?: "approve" | "reject"; approvalId?: string };

  if (body.action === "reject") {
    const result = await rejectActionablePaymentIntent({
      workspaceId: ctx.workspaceId,
      intentId: id,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, intent: serializePaymentIntent(result.intent) });
  }

  const intent = await getPaymentIntentForWorkspace(ctx.workspaceId, id);
  if (!intent) {
    return NextResponse.json({ error: "Payment intent not found" }, { status: 404 });
  }

  if (intent.status === "approved") {
    const recipientAddress = await resolvePaymentIntentRecipientAddress({
      type: intent.type,
      recipientUsername: intent.recipientUsername,
      recipientAddress: intent.recipientAddress,
      networkId: intent.networkId,
    });

    return NextResponse.json({
      ok: true,
      intent: serializePaymentIntent(intent),
      recipientAddress,
      signPayload: {
        intentId: intent.intentId,
        type: intent.type,
        amount: intent.amount,
        tokenId: intent.tokenId,
        networkId: intent.networkId,
        linkUsername: intent.linkUsername,
        linkPublicId: intent.linkPublicId,
        recipientUsername: intent.recipientUsername,
        recipientAddress: intent.recipientAddress,
      },
    });
  }

  if (intent.status !== "pending") {
    return NextResponse.json({ error: "Payment intent not found or expired" }, { status: 404 });
  }

  const result = await approvePaymentIntent({
    workspaceId: ctx.workspaceId,
    intentId: id,
    approvalId: body.approvalId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const recipientAddress = await resolvePaymentIntentRecipientAddress({
    type: intent.type,
    recipientUsername: intent.recipientUsername,
    recipientAddress: intent.recipientAddress,
    networkId: intent.networkId,
  });

  return NextResponse.json({
    ok: true,
    intent: serializePaymentIntent(result.intent),
    recipientAddress,
    signPayload: {
      intentId: intent.intentId,
      type: intent.type,
      amount: intent.amount,
      tokenId: intent.tokenId,
      networkId: intent.networkId,
      linkUsername: intent.linkUsername,
      linkPublicId: intent.linkPublicId,
      recipientUsername: intent.recipientUsername,
      recipientAddress: intent.recipientAddress,
    },
  });
}
