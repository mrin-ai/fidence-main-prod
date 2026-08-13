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
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  if (!isPayAgentConnectEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const agentRequired = requireAgentScopedContext(context);
  if (agentRequired) return agentRequired;

  const permission = requireApiPermission(context, "payment_intents.read");
  if (permission) return permission;

  const { id } = await params;
  const limited = await checkRateLimit(`payment-intents:poll:${id}`, {
    max: 120,
    windowMs: 60 * 1000,
  });
  if (!limited.allowed) return rateLimitResponse(limited);

  const intent = await getPaymentIntentByIntentId(id);
  if (!intent || !context.agentObjectId?.equals(intent.agentObjectId)) {
    return NextResponse.json({ error: "Payment intent not found" }, { status: 404 });
  }

  if (intent.status === "pending") {
    return NextResponse.json({
      ok: true,
      status: "pending",
      intentId: intent.intentId,
      expiresAt: intent.expiresAt.toISOString(),
    });
  }

  return NextResponse.json({
    ok: true,
    status: intent.status,
    intent: serializePaymentIntent(intent),
  });
}
