import { NextResponse } from "next/server";

import { requireActiveAgent } from "@/lib/db/agents";
import { createPaymentLink } from "@/lib/db/payment-links";
import {
  getMerchantApiContext,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { requireRecipientAddress } from "@/lib/db/wallets";
import { logSecurityEvent } from "@/lib/db/security-audit";
import { supportsOnChainPayment } from "@/lib/payment-contracts";

export async function POST(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

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
    agent: {
      publicId: agentResult.agent.publicId,
      externalAgentId: agentResult.agent.externalAgentId,
    },
  });
}
