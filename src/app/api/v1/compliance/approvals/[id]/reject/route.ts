import { NextResponse } from "next/server";

import { actorFromSecurity } from "@/lib/compliance/actor";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
  requireApiPermission,
} from "@/lib/db/merchant-api";
import { resolvePaymentApproval } from "@/lib/db/payment-approvals";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";
import { enqueueWebhookEvent } from "@/lib/webhooks/dispatch";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const forbidden = requireApiPermission(context, "compliance.approvals.approve");
  if (forbidden) return forbidden;

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const { id } = await params;
  const result = await resolvePaymentApproval({
    workspaceId: context.workspace._id,
    approvalId: id,
    decision: "rejected",
    actor: actorFromSecurity(context.security, {
      actorType: "api_key",
      authMethod: "api_key",
      userId: context.owner._id.toString(),
    }),
    security: context.security,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  await enqueueWebhookEvent({
    workspaceId: context.workspace._id,
    event: "compliance.approval.resolved",
    payload: {
      approvalId: result.approval.approvalId,
      status: result.approval.status,
      externalAgentId: result.approval.externalAgentId,
      amountUsd: result.approval.amountUsd,
    },
  });

  return NextResponse.json({
    approvalId: result.approval.approvalId,
    status: result.approval.status,
    receiptId: result.receiptId,
  });
}
