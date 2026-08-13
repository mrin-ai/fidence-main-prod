import { NextResponse } from "next/server";

import { getSavedAddress } from "@/lib/db/saved-addresses";
import {
  listActionablePaymentIntents,
  listAutoExecutePaymentIntents,
  listManualActionablePaymentIntents,
  listPendingPaymentIntents,
  serializePaymentIntent,
} from "@/lib/db/payment-intents";
import { resolvePaymentIntentRecipientAddress } from "@/lib/db/payment-intent-settlement";
import { getPaySessionContext } from "@/lib/pay/session-api";

export async function GET(request: Request) {
  const ctx = await getPaySessionContext(request);
  if (!ctx.ok) return ctx.response;

  const status = new URL(request.url).searchParams.get("status") ?? "actionable";
  const supported = ["actionable", "manual", "auto_execute", "pending"] as const;
  if (!supported.includes(status as (typeof supported)[number])) {
    return NextResponse.json({ error: "Unsupported status filter" }, { status: 400 });
  }

  const intents =
    status === "pending"
      ? await listPendingPaymentIntents(ctx.workspaceId)
      : status === "auto_execute"
        ? await listAutoExecutePaymentIntents(ctx.workspaceId)
        : status === "manual"
          ? await listManualActionablePaymentIntents(ctx.workspaceId)
          : await listActionablePaymentIntents(ctx.workspaceId);

  const enriched = await Promise.all(
    intents.map(async (intent) => {
      const base = serializePaymentIntent(intent);
      const savedAddress = intent.savedAddressId
        ? await getSavedAddress(ctx.workspaceId, intent.savedAddressId)
        : null;
      const recipientAddress =
        intent.status === "approved" || intent.type === "address"
          ? await resolvePaymentIntentRecipientAddress({
              type: intent.type,
              recipientUsername: intent.recipientUsername,
              recipientAddress: intent.recipientAddress,
              networkId: intent.networkId,
            })
          : null;

      return {
        ...base,
        savedAddress: savedAddress
          ? {
              id: savedAddress._id.toString(),
              name: savedAddress.name,
              line1: savedAddress.line1,
              city: savedAddress.city,
            }
          : null,
        recipientAddress,
      };
    }),
  );

  return NextResponse.json({ ok: true, intents: enriched });
}
