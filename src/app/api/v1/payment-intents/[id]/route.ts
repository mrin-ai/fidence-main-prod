import { NextResponse } from "next/server";

import {
  getMerchantApiContext,
  merchantApiUnauthorized,
  requireAgentScopedContext,
  requireApiPermission,
} from "@/lib/db/merchant-api";
import {
  getPaymentIntentByIntentId,
  serializePaymentIntent,
} from "@/lib/db/payment-intents";
import { isPayAgentConnectEnabled } from "@/lib/pay/config";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  if (!isPayAgentConnectEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const context = await getMerchantApiContext(_request);
  if (!context) return merchantApiUnauthorized();

  const agentRequired = requireAgentScopedContext(context);
  if (agentRequired) return agentRequired;

  const permission = requireApiPermission(context, "payment_intents.read");
  if (permission) return permission;

  const { id } = await params;
  const intent = await getPaymentIntentByIntentId(id);
  if (!intent || !context.agentObjectId?.equals(intent.agentObjectId)) {
    return NextResponse.json({ error: "Payment intent not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, intent: serializePaymentIntent(intent) });
}
