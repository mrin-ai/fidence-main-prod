import { NextResponse } from "next/server";

import { actorFromSecurity } from "@/lib/compliance/actor";
import {
  evaluateAndRecordPolicy,
  policyDeniedResponse,
} from "@/lib/compliance/evaluate-and-record";
import { requireActiveAgent } from "@/lib/db/agents";
import { createPaymentLink } from "@/lib/db/payment-links";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { requireRecipientAddress } from "@/lib/db/wallets";
import { logSecurityEvent } from "@/lib/db/security-audit";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";
import { supportsOnChainPayment } from "@/lib/payment-contracts";

export async function POST(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const body = (await request.json()) as {
    agentId?: string;
    amount?: number | string;
    tokenId?: string;
    networkId?: string;
    expiresAt?: string;
  };

  const externalAgentId = body.agentId?.trim();
  const amount = Number(body.amount);
  const tokenId = body.tokenId?.trim();
  const networkId = body.networkId?.trim();
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  if (!externalAgentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  if (!amount || amount <= 0 || !tokenId || !networkId || !expiresAt) {
    return NextResponse.json(
      { error: "amount, tokenId, networkId, and expiresAt are required" },
      { status: 400 },
    );
  }

  if (!supportsOnChainPayment(networkId, tokenId)) {
    return NextResponse.json(
      {
        error: "This token/network combination is not supported",
        code: "TOKEN_NETWORK_UNSUPPORTED",
      },
      { status: 400 },
    );
  }

  const agentResult = await requireActiveAgent(
    context.workspace._id,
    externalAgentId,
  );

  if (!agentResult.ok) {
    return NextResponse.json(
      {
        error: agentResult.error,
        code: agentResult.code,
        hint: "Register the agent first via POST /api/v1/agents/register",
      },
      { status: agentResult.code === "AGENT_INACTIVE" ? 403 : 404 },
    );
  }

  const policyResult = await evaluateAndRecordPolicy({
    workspaceId: context.workspace._id,
    agent: agentResult.agent,
    action: "payment_links.create",
    amount,
    tokenId,
    networkId,
    actor: actorFromSecurity(context.security, {
      actorType: "agent",
      agentId: agentResult.agent._id.toString(),
      agentPublicId: agentResult.agent.publicId,
      externalAgentId: agentResult.agent.externalAgentId,
    }),
    security: context.security,
    contentGuardArgs: body,
  });

  if (policyResult.verdict !== "allow") {
    return policyDeniedResponse(policyResult);
  }

  const recipient = requireRecipientAddress(context.owner, networkId);
  if (!recipient.ok) {
    return NextResponse.json(
      { error: recipient.error, code: recipient.code },
      { status: 400 },
    );
  }

  const link = await createPaymentLink({
    workspaceId: context.workspace._id,
    userId: context.owner._id,
    username: context.owner.username!,
    recipientAddress: recipient.recipientAddress,
    amount,
    tokenId,
    networkId,
    expiresAt,
    source: "agent",
    agentId: agentResult.agent._id,
    agentPublicId: agentResult.agent.publicId,
  });

  await logSecurityEvent({
    workspaceId: context.workspace._id,
    actorType: "api_key",
    actorId: context.owner._id.toString(),
    agentId: agentResult.agent._id,
    action: "agent_payment_link_created",
    resourceType: "payment_link",
    resourceId: link.id,
    security: context.security,
  });

  return NextResponse.json({
    ...link,
    receiptId: policyResult.receiptId,
    agent: {
      publicId: agentResult.agent.publicId,
      externalAgentId: agentResult.agent.externalAgentId,
    },
  });
}
