import { NextResponse } from "next/server";

import {
  recordAgentAddressPayment,
  recordAgentPaymentLink,
  recordAgentProfilePayment,
} from "@/lib/db/agent-payments";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { withIdempotency } from "@/lib/merchant-api/idempotency";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";
import { supportsOnChainPayment } from "@/lib/payment-contracts";

function mapAgentPayErrorStatus(code?: string) {
  if (code === "AGENT_INACTIVE" || code === "AGENT_WALLET_MISMATCH") return 403;
  if (
    code === "AGENT_NOT_FOUND" ||
    code === "LINK_NOT_FOUND" ||
    code === "RECIPIENT_NOT_FOUND"
  ) {
    return 404;
  }
  return 400;
}

export async function POST(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  return withIdempotency({
    workspaceId: context.workspace._id,
    request,
    route: "POST /api/v1/pay",
    required: true,
    handler: async () => handlePay(request, context),
  });
}

async function handlePay(
  request: Request,
  context: NonNullable<Awaited<ReturnType<typeof getMerchantApiContext>>>,
) {
  const body = (await request.json()) as {
    agentId?: string;
    payerAddress?: string;
    txHash?: string;
    type?: "link" | "profile" | "address";
    linkUsername?: string;
    linkId?: string;
    recipientUsername?: string;
    recipientAddress?: string;
    amount?: number;
    tokenId?: string;
    networkId?: string;
    approvalId?: string;
  };

  const externalAgentId = body.agentId?.trim();
  const payerAddress = body.payerAddress?.trim();
  const txHash = body.txHash?.trim();
  const type = body.type;
  const approvalId = body.approvalId?.trim();

  if (!externalAgentId || !payerAddress || !txHash || !type) {
    return NextResponse.json(
      { error: "agentId, payerAddress, txHash, and type are required" },
      { status: 400 },
    );
  }

  if (type === "link") {
    const linkUsername = body.linkUsername?.trim();
    const linkId = body.linkId?.trim();

    if (!linkUsername || !linkId) {
      return NextResponse.json(
        { error: "linkUsername and linkId are required for link payments" },
        { status: 400 },
      );
    }

    const result = await recordAgentPaymentLink({
      context,
      externalAgentId,
      payerAddress,
      txHash,
      linkUsername,
      linkPublicId: linkId,
      approvalId,
    });

    if (!result.ok) {
      if ("policyResponse" in result && result.policyResponse) {
        return result.policyResponse;
      }
      const code = "code" in result ? result.code : undefined;
      const status = mapAgentPayErrorStatus(code);

      return NextResponse.json(
        { error: result.error, ...(code ? { code } : {}) },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      type: "link",
      link: result.link,
      agent: result.agent,
    });
  }

  if (type === "profile") {
    const recipientUsername = body.recipientUsername?.trim();
    const amount = Number(body.amount);
    const tokenId = body.tokenId?.trim();
    const networkId = body.networkId?.trim();

    if (!recipientUsername || !amount || !tokenId || !networkId) {
      return NextResponse.json(
        {
          error:
            "recipientUsername, amount, tokenId, and networkId are required for profile payments",
        },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
    }

    if (!supportsOnChainPayment(networkId, tokenId)) {
      return NextResponse.json(
        { error: "This token/network combination is not supported" },
        { status: 400 },
      );
    }

    const result = await recordAgentProfilePayment({
      context,
      externalAgentId,
      payerAddress,
      txHash,
      recipientUsername,
      amount,
      tokenId,
      networkId,
      approvalId,
    });

    if (!result.ok) {
      if ("policyResponse" in result && result.policyResponse) {
        return result.policyResponse;
      }
      const code = "code" in result ? result.code : undefined;
      const status = mapAgentPayErrorStatus(code);

      return NextResponse.json(
        { error: result.error, ...(code ? { code } : {}) },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      type: "profile",
      transactionId: result.transactionId,
      duplicate: result.duplicate,
      agent: result.agent,
    });
  }

  if (type === "address") {
    const recipientAddress = body.recipientAddress?.trim();
    const amount = Number(body.amount);
    const tokenId = body.tokenId?.trim();
    const networkId = body.networkId?.trim();

    if (!recipientAddress || !amount || !tokenId || !networkId) {
      return NextResponse.json(
        {
          error:
            "recipientAddress, amount, tokenId, and networkId are required for address payments",
        },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
    }

    if (!supportsOnChainPayment(networkId, tokenId)) {
      return NextResponse.json(
        { error: "This token/network combination is not supported" },
        { status: 400 },
      );
    }

    const result = await recordAgentAddressPayment({
      context,
      externalAgentId,
      payerAddress,
      txHash,
      recipientAddress,
      amount,
      tokenId,
      networkId,
      approvalId,
    });

    if (!result.ok) {
      if ("policyResponse" in result && result.policyResponse) {
        return result.policyResponse;
      }
      const code = "code" in result ? result.code : undefined;
      const status = mapAgentPayErrorStatus(code);

      return NextResponse.json(
        { error: result.error, ...(code ? { code } : {}) },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      type: "address",
      transactionId: result.transactionId,
      duplicate: result.duplicate,
      agent: result.agent,
    });
  }

  return NextResponse.json(
    { error: "type must be 'link', 'profile', or 'address'" },
    { status: 400 },
  );
}
