import type { ObjectId } from "mongodb";

import {
  agentHasWallet,
  incrementAgentPaymentStats,
  requireActiveAgent,
} from "@/lib/db/agents";
import type { MerchantApiContext } from "@/lib/db/merchant-api";
import {
  getPaymentLinkByUsernameAndPublicId,
  markPaymentLinkPaid,
} from "@/lib/db/payment-links";
import { getWorkspaceForUser } from "@/lib/db/auth";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { recordProfilePayment } from "@/lib/db/profile-payments";
import { recordPaymentSentForPayer } from "@/lib/db/payment-sent";
import { resolveRecipientAddress } from "@/lib/db/wallets";
import { normalizeUsername } from "@/lib/db/profile";
import { normalizePaymentAddress, normalizeTxHash } from "@/lib/payment/normalize";
import { supportsOnChainPayment } from "@/lib/payment-contracts";
import { logSecurityEvent } from "@/lib/db/security-audit";
import type { UserDoc } from "@/lib/db/types";

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

export async function recordAgentPaymentLink(input: {
  context: MerchantApiContext;
  externalAgentId: string;
  payerAddress: string;
  txHash: string;
  linkUsername: string;
  linkPublicId: string;
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
    return { ok: false as const, error: result.error };
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

  const result = await recordProfilePayment({
    workspaceId: workspace._id,
    recipientUserId: user._id,
    recipientAddress,
    payerAddress: input.payerAddress,
    amount: input.amount,
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
    return { ok: false as const, error: result.error };
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
