import { NextResponse } from "next/server";

import { rejectActionablePaymentIntentsForAgent } from "@/lib/db/payment-intents";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
  requireAgentScopedContext,
  requireApiPermission,
} from "@/lib/db/merchant-api";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";
import { isPayAgentConnectEnabled } from "@/lib/pay/config";

export async function POST(request: Request) {
  if (!isPayAgentConnectEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const agentRequired = requireAgentScopedContext(context);
  if (agentRequired) return agentRequired;

  const permission = requireApiPermission(context, "payment_intents.create");
  if (permission) return permission;

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  if (!context.agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const result = await rejectActionablePaymentIntentsForAgent({
    workspaceId: context.workspace._id,
    agentObjectId: context.agent._id,
  });

  return NextResponse.json({ ok: true, rejectedCount: result.rejectedCount });
}

export async function DELETE(request: Request) {
  return POST(request);
}
