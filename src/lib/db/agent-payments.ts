import type { ObjectId } from "mongodb";

import { actorFromSecurity } from "@/lib/compliance/actor";
import {
  evaluateAndRecordPolicy,
  policyDeniedResponse,
} from "@/lib/compliance/evaluate-and-record";
import { POLICY_CODES } from "@/lib/compliance/codes";
import { toPolicyAmountUsd } from "@/lib/compliance/valuation";
import {
  agentHasWallet,
  requireActiveAgent,
} from "@/lib/db/agents";
import { getAgentPolicy } from "@/lib/db/agent-policies";
import {
  decrementAgentSpend,
  tryIncrementAgentSpend,
} from "@/lib/db/agent-spend";
import type { MerchantApiContext } from "@/lib/db/merchant-api";
import {
  getPaymentLinkByUsernameAndPublicId,
  markPaymentLinkPaid,
} from "@/lib/db/payment-links";
import { getWorkspaceForUser } from "@/lib/db/auth";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { recordProfilePayment } from "@/lib/db/profile-payments";
import { resolveRecipientAddress } from "@/lib/db/wallets";
import { normalizeUsername } from "@/lib/db/profile";
import { normalizePaymentAddress, normalizeTxHash } from "@/lib/payment/normalize";
import { supportsOnChainPayment } from "@/lib/payment-contracts";
import { getSettlementVerifier } from "@/lib/payment/settlement";
import { logSecurityEvent } from "@/lib/db/security-audit";
import type { UserDoc } from "@/lib/db/types";
import type { AgentDoc } from "@/lib/db/merchant-types";
import {
  claimPaymentApproval,
  consumePaymentApproval,
  createPaymentApproval,
  releasePaymentApprovalClaim,
} from "@/lib/db/payment-approvals";

async function verifyAgentPayerWallet(
  context: MerchantApiContext,
  externalAgentId: string,
  payerAddress: string,
  networkId: string,
) {
  const active = await requireActiveAgent(context.workspace._id, externalAgentId);
  if (!active.ok) return active;

  if (!agentHasWallet(active.agent, payerAddress, networkId)) {
    return {
      ok: false as const,
      error: "payerAddress does not match a wallet registered for this agent",
      code: "AGENT_WALLET_MISMATCH" as const,
    };
  }

  return { ok: true as const, agent: active.agent };
}

async function reserveSpend(input: {
  workspaceId: ObjectId;
  agentId: ObjectId;
  amountUsd: number;
}) {
  const policy = await getAgentPolicy(input.workspaceId, input.agentId);
  if (!policy || policy.status !== "active") {
    return { ok: false as const, code: POLICY_CODES.NO_ACTIVE_POLICY };
  }

  return tryIncrementAgentSpend({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    amountUsd: input.amountUsd,
    dailySpendCap: policy.dailySpendCap,
    monthlySpendCap: policy.monthlySpendCap,
  });
}

export type AgentPayPolicyGate =
  | {
      ok: true;
      approvalClaimed: boolean;
      amountUsd: number;
    }
  | {
      ok: false;
      kind: "denied" | "approval_required" | "approval_error";
      response: Response;
    };

export async function gateAgentPayPolicy(input: {
  context: MerchantApiContext;
  agent: AgentDoc;
  action: "pay.link" | "pay.profile";
  /** Amount used for policy evaluation (observed on-chain for profile). */
  amount: number;
  tokenId: string;
  networkId: string;
  approvalId?: string;
  /**
   * Amount used to bind/claim an approval (usually client/body or link amount).
   * Defaults to `amount`.
   */
  approvalClaimAmount?: number;
  payloadMatch: {
    type: "link" | "profile";
    linkUsername?: string;
    linkPublicId?: string;
    recipientUsername?: string;
    payerAddress?: string;
  };
}): Promise<AgentPayPolicyGate> {
  const actor = actorFromSecurity(input.context.security, {
    actorType: "agent",
    agentId: input.agent._id.toString(),
    agentPublicId: input.agent.publicId,
    externalAgentId: input.agent.externalAgentId,
  });

  const valuation = toPolicyAmountUsd(input.amount, input.tokenId);
  if (!valuation.ok) {
    const evaluated = await evaluateAndRecordPolicy({
      workspaceId: input.context.workspace._id,
      agent: input.agent,
      action: input.action,
      amount: input.amount,
      tokenId: input.tokenId,
      networkId: input.networkId,
      actor,
      security: input.context.security,
    });
    return {
      ok: false,
      kind: "denied",
      response: policyDeniedResponse(evaluated),
    };
  }

  let approvalClaimed = false;
  if (input.approvalId) {
    const claimAmount = input.approvalClaimAmount ?? input.amount;
    const claimValuation = toPolicyAmountUsd(claimAmount, input.tokenId);
    if (!claimValuation.ok) {
      return {
        ok: false,
        kind: "approval_error",
        response: Response.json(
          {
            error: "Approval amount valuation unavailable",
            code: claimValuation.code,
          },
          { status: 400 },
        ),
      };
    }

    // Paying more than the approved intent is not allowed.
    if (valuation.amountUsd > claimValuation.amountUsd * 1.01) {
      return {
        ok: false,
        kind: "approval_error",
        response: Response.json(
          {
            error: "On-chain amount exceeds approved amount",
            code: "APPROVAL_MISMATCH",
          },
          { status: 400 },
        ),
      };
    }

    const claimed = await claimPaymentApproval({
      workspaceId: input.context.workspace._id,
      approvalId: input.approvalId,
      agentId: input.agent._id,
      amountUsd: claimValuation.amountUsd,
      tokenId: input.tokenId,
      networkId: input.networkId,
      payloadMatch: input.payloadMatch,
    });
    if (!claimed.ok) {
      return {
        ok: false,
        kind: "approval_error",
        response: Response.json(
          { error: claimed.error, code: claimed.code },
          { status: 400 },
        ),
      };
    }
    approvalClaimed = true;
  }

  const evaluated = await evaluateAndRecordPolicy({
    workspaceId: input.context.workspace._id,
    agent: input.agent,
    action: input.action,
    amount: input.amount,
    tokenId: input.tokenId,
    networkId: input.networkId,
    actor,
    security: input.context.security,
    approvalConsumed: approvalClaimed,
  });

  if (evaluated.verdict === "deny") {
    if (approvalClaimed && input.approvalId) {
      await releasePaymentApprovalClaim({
        workspaceId: input.context.workspace._id,
        approvalId: input.approvalId,
      });
    }
    return {
      ok: false,
      kind: "denied",
      response: policyDeniedResponse(evaluated),
    };
  }

  if (evaluated.verdict === "require_approval") {
    if (approvalClaimed && input.approvalId) {
      await releasePaymentApprovalClaim({
        workspaceId: input.context.workspace._id,
        approvalId: input.approvalId,
      });
    }
    const approval = await createPaymentApproval({
      workspaceId: input.context.workspace._id,
      agentId: input.agent._id,
      agentPublicId: input.agent.publicId,
      externalAgentId: input.agent.externalAgentId,
      payload: {
        type: input.payloadMatch.type,
        linkUsername: input.payloadMatch.linkUsername,
        linkPublicId: input.payloadMatch.linkPublicId,
        recipientUsername: input.payloadMatch.recipientUsername,
        amount: input.amount,
        tokenId: input.tokenId,
        networkId: input.networkId,
        amountUsd: valuation.amountUsd,
        payerAddress: input.payloadMatch.payerAddress,
      },
      requestedBy: actor,
      policyVersion: evaluated.policyVersion,
      receiptId: evaluated.receiptId ?? undefined,
      security: input.context.security,
    });

    return {
      ok: false,
      kind: "approval_required",
      response: Response.json(
        {
          ok: false,
          error: "APPROVAL_REQUIRED",
          code: POLICY_CODES.APPROVAL_REQUIRED,
          codes: evaluated.codes,
          receiptId: evaluated.receiptId,
          approvalId: approval.approvalId,
          status: "pending_approval",
          message: "Human approval is required for this payment",
          poll: `/api/v1/compliance/approvals/${approval.approvalId}`,
        },
        { status: 202 },
      ),
    };
  }

  return { ok: true, approvalClaimed, amountUsd: valuation.amountUsd };
}

export async function recordAgentPaymentLink(input: {
  context: MerchantApiContext;
  externalAgentId: string;
  payerAddress: string;
  txHash: string;
  linkUsername: string;
  linkPublicId: string;
  approvalId?: string;
}) {
  const link = await getPaymentLinkByUsernameAndPublicId(
    input.linkUsername,
    input.linkPublicId,
  );

  if (!link) {
    return { ok: false as const, error: "Payment link not found", code: "LINK_NOT_FOUND" as const };
  }

  if (link.status !== "pending" || !link.canPay) {
    return { ok: false as const, error: "Payment link is not payable", code: "LINK_NOT_PAYABLE" as const };
  }

  if (!supportsOnChainPayment(link.networkId, link.tokenId)) {
    return {
      ok: false as const,
      error: "This token/network combination is not supported",
      code: "TOKEN_NETWORK_UNSUPPORTED" as const,
    };
  }

  const walletCheck = await verifyAgentPayerWallet(
    input.context,
    input.externalAgentId,
    input.payerAddress,
    link.networkId,
  );
  if (!walletCheck.ok) return walletCheck;

  const gate = await gateAgentPayPolicy({
    context: input.context,
    agent: walletCheck.agent,
    action: "pay.link",
    amount: link.amount,
    tokenId: link.tokenId,
    networkId: link.networkId,
    approvalId: input.approvalId,
    payloadMatch: {
      type: "link",
      linkUsername: input.linkUsername,
      linkPublicId: input.linkPublicId,
      payerAddress: input.payerAddress,
    },
  });

  if (!gate.ok) {
    return { ok: false as const, policyResponse: gate.response };
  }

  const spend = await reserveSpend({
    workspaceId: input.context.workspace._id,
    agentId: walletCheck.agent._id,
    amountUsd: gate.amountUsd,
  });

  if (!spend.ok) {
    if (gate.approvalClaimed && input.approvalId) {
      await releasePaymentApprovalClaim({
        workspaceId: input.context.workspace._id,
        approvalId: input.approvalId,
      });
    }
    return {
      ok: false as const,
      policyResponse: Response.json(
        {
          ok: false,
          error: "POLICY_DENIED",
          code: spend.code,
          codes: [spend.code],
          message: spend.code,
        },
        { status: 403 },
      ),
    };
  }

  const normalizedPayerAddress = normalizePaymentAddress(
    input.payerAddress,
    link.networkId,
  );
  const normalizedTxHash = normalizeTxHash(input.txHash, link.networkId);

  const result = await markPaymentLinkPaid({
    username: input.linkUsername,
    publicId: input.linkPublicId,
    payerAddress: normalizedPayerAddress,
    txHash: normalizedTxHash,
    paidVia: "agent",
    payerAgentId: walletCheck.agent._id,
    payerAgentPublicId: walletCheck.agent.publicId,
  });

  if (!result.ok) {
    await decrementAgentSpend({
      workspaceId: input.context.workspace._id,
      agentId: walletCheck.agent._id,
      amountUsd: gate.amountUsd,
    });
    if (gate.approvalClaimed && input.approvalId) {
      await releasePaymentApprovalClaim({
        workspaceId: input.context.workspace._id,
        approvalId: input.approvalId,
      });
    }
    return { ok: false as const, error: result.error };
  }

  if (input.approvalId && gate.approvalClaimed) {
    await consumePaymentApproval({
      workspaceId: input.context.workspace._id,
      approvalId: input.approvalId,
    });
  }

  await logSecurityEvent({
    workspaceId: input.context.workspace._id,
    actorType: "agent",
    actorId: walletCheck.agent.publicId,
    agentId: walletCheck.agent._id,
    action: "agent_payment_link_paid",
    resourceType: "payment_link",
    resourceId: link.publicId,
    security: input.context.security,
  });

  return {
    ok: true as const,
    link: result.link,
    agent: {
      publicId: walletCheck.agent.publicId,
      externalAgentId: walletCheck.agent.externalAgentId,
    },
  };
}

export async function recordAgentProfilePayment(input: {
  context: MerchantApiContext;
  externalAgentId: string;
  payerAddress: string;
  txHash: string;
  recipientUsername: string;
  amount: number;
  tokenId: string;
  networkId: string;
  approvalId?: string;
}) {
  const walletCheck = await verifyAgentPayerWallet(
    input.context,
    input.externalAgentId,
    input.payerAddress,
    input.networkId,
  );
  if (!walletCheck.ok) return walletCheck;

  const username = normalizeUsername(input.recipientUsername);
  const db = await getDb();
  const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    username,
  });

  if (!user) {
    return { ok: false as const, error: "Recipient not found", code: "RECIPIENT_NOT_FOUND" as const };
  }

  const recipientAddress = resolveRecipientAddress(user, input.networkId);
  if (!recipientAddress) {
    return {
      ok: false as const,
      error: "Recipient has no verified wallet for this network",
      code: "RECIPIENT_WALLET_MISSING" as const,
    };
  }

  const workspace = await getWorkspaceForUser(user._id);
  if (!workspace) {
    return { ok: false as const, error: "Recipient workspace not found" };
  }

  const normalizedPayerAddress = normalizePaymentAddress(
    input.payerAddress,
    input.networkId,
  );
  const normalizedTxHash = normalizeTxHash(input.txHash, input.networkId);
  const normalizedRecipientAddress = normalizePaymentAddress(
    recipientAddress,
    input.networkId,
  );

  // Verify first so policy/spend use observed on-chain amount (A5).
  const verified = await getSettlementVerifier().verifySettlementDetailed(
    {
      recipientAddress: normalizedRecipientAddress,
      amount: input.amount,
      tokenId: input.tokenId,
      networkId: input.networkId,
      payerAddress: normalizedPayerAddress,
    },
    normalizedTxHash,
  );

  if (!verified.ok) {
    return { ok: false as const, error: "Payment verification failed" };
  }

  if (!Number.isFinite(verified.observedAmount) || verified.observedAmount <= 0) {
    return {
      ok: false as const,
      error: "Could not determine on-chain settlement amount",
      code: POLICY_CODES.SETTLEMENT_AMOUNT_UNKNOWN,
    };
  }

  const observedAmount = verified.observedAmount;

  const gate = await gateAgentPayPolicy({
    context: input.context,
    agent: walletCheck.agent,
    action: "pay.profile",
    amount: observedAmount,
    approvalClaimAmount: input.amount,
    tokenId: input.tokenId,
    networkId: input.networkId,
    approvalId: input.approvalId,
    payloadMatch: {
      type: "profile",
      recipientUsername: username,
      payerAddress: input.payerAddress,
    },
  });

  if (!gate.ok) {
    return { ok: false as const, policyResponse: gate.response };
  }

  const spend = await reserveSpend({
    workspaceId: input.context.workspace._id,
    agentId: walletCheck.agent._id,
    amountUsd: gate.amountUsd,
  });

  if (!spend.ok) {
    if (gate.approvalClaimed && input.approvalId) {
      await releasePaymentApprovalClaim({
        workspaceId: input.context.workspace._id,
        approvalId: input.approvalId,
      });
    }
    return {
      ok: false as const,
      policyResponse: Response.json(
        {
          ok: false,
          error: "POLICY_DENIED",
          code: spend.code,
          codes: [spend.code],
          message: spend.code,
        },
        { status: 403 },
      ),
    };
  }

  const result = await recordProfilePayment({
    workspaceId: workspace._id,
    recipientUserId: user._id,
    recipientAddress,
    payerAddress: input.payerAddress,
    amount: observedAmount,
    tokenId: input.tokenId,
    networkId: input.networkId,
    txHash: input.txHash,
    username,
    paidVia: "agent",
    payerAgentId: walletCheck.agent._id,
    payerAgentPublicId: walletCheck.agent.publicId,
    payerWorkspaceId: input.context.workspace._id,
  });

  if (!result.ok) {
    await decrementAgentSpend({
      workspaceId: input.context.workspace._id,
      agentId: walletCheck.agent._id,
      amountUsd: gate.amountUsd,
    });
    if (gate.approvalClaimed && input.approvalId) {
      await releasePaymentApprovalClaim({
        workspaceId: input.context.workspace._id,
        approvalId: input.approvalId,
      });
    }
    return { ok: false as const, error: result.error };
  }

  if (result.duplicate) {
    // Duplicate tx: roll back the reserve; prior payment already counted.
    await decrementAgentSpend({
      workspaceId: input.context.workspace._id,
      agentId: walletCheck.agent._id,
      amountUsd: gate.amountUsd,
    });
    if (gate.approvalClaimed && input.approvalId) {
      await releasePaymentApprovalClaim({
        workspaceId: input.context.workspace._id,
        approvalId: input.approvalId,
      });
    }
  } else if (input.approvalId && gate.approvalClaimed) {
    await consumePaymentApproval({
      workspaceId: input.context.workspace._id,
      approvalId: input.approvalId,
    });
  }

  await logSecurityEvent({
    workspaceId: input.context.workspace._id,
    actorType: "agent",
    actorId: walletCheck.agent.publicId,
    agentId: walletCheck.agent._id,
    action: "agent_profile_payment",
    resourceType: "profile",
    resourceId: username,
    security: input.context.security,
  });

  return {
    ok: true as const,
    transactionId: result.transactionId,
    duplicate: result.duplicate,
    agent: {
      publicId: walletCheck.agent.publicId,
      externalAgentId: walletCheck.agent.externalAgentId,
    },
  };
}
