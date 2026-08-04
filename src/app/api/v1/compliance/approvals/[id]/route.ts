import { NextResponse } from "next/server";

import {
  getMerchantApiContext,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { getPaymentApproval } from "@/lib/db/payment-approvals";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const { id } = await params;
  const approval = await getPaymentApproval(context.workspace._id, id);
  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  return NextResponse.json({
    approvalId: approval.approvalId,
    status: approval.status,
    amountUsd: approval.amountUsd,
    networkId: approval.networkId,
    tokenId: approval.tokenId,
    externalAgentId: approval.externalAgentId,
    expiresAt: approval.expiresAt.toISOString(),
    createdAt: approval.createdAt.toISOString(),
    payload: {
      type: approval.payload.type,
      linkUsername: approval.payload.linkUsername ?? null,
      linkPublicId: approval.payload.linkPublicId ?? null,
      recipientUsername: approval.payload.recipientUsername ?? null,
      amount: approval.payload.amount,
    },
  });
}
