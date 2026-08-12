import { NextResponse } from "next/server";

import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { listPaymentApprovals } from "@/lib/db/payment-approvals";
import { enforceComplianceReadRateLimit } from "@/lib/merchant-api/rate-limit";

export async function GET(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceComplianceReadRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim() || undefined;
  const approvals = await listPaymentApprovals(context.workspace._id, status);

  return NextResponse.json({
    approvals: approvals.map((approval) => ({
      approvalId: approval.approvalId,
      status: approval.status,
      amountUsd: approval.amountUsd,
      networkId: approval.networkId,
      tokenId: approval.tokenId,
      externalAgentId: approval.externalAgentId,
      agentPublicId: approval.agentPublicId,
      payload: approval.payload,
      requestedBy: {
        actorType: approval.requestedBy.actorType,
        ip: approval.requestedBy.ip,
        externalAgentId: approval.requestedBy.externalAgentId ?? null,
      },
      resolvedBy: approval.resolvedBy
        ? {
            actorType: approval.resolvedBy.actorType,
            ip: approval.resolvedBy.ip,
            userId: approval.resolvedBy.userId ?? null,
          }
        : null,
      createdAt: approval.createdAt.toISOString(),
      expiresAt: approval.expiresAt.toISOString(),
      resolvedAt: approval.resolvedAt?.toISOString() ?? null,
    })),
  });
}
