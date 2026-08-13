import { recordAgentAddressPayment, recordAgentProfilePayment } from "@/lib/db/agent-payments";
import { logActivity } from "@/lib/db/activity";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { MerchantApiContext } from "@/lib/db/merchant-api";
import type { AgentDoc, ApiKeyDoc, SecurityContext } from "@/lib/db/merchant-types";
import {
  consumePaymentIntent,
  getPaymentIntentForWorkspace,
  serializePaymentIntent,
} from "@/lib/db/payment-intents";
import { normalizeUsername } from "@/lib/db/profile";
import { validateRecipientAddress } from "@/lib/pay/recipient-address";
import { normalizePaymentAddress } from "@/lib/payment/normalize";
import { resolveRecipientAddress } from "@/lib/db/wallets";
import type { UserDoc, WorkspaceDoc } from "@/lib/db/types";

function buildSessionAgentPayContext(input: {
  workspace: WorkspaceDoc;
  owner: UserDoc;
  agent: AgentDoc;
  security: SecurityContext;
}): MerchantApiContext {
  const stubKey = {
    _id: input.agent._id,
    workspaceId: input.workspace._id,
    createdBy: input.owner._id,
    keyHash: "session-linked-agent",
    keyPrefix: "session",
    keyLast4: "link",
    keyType: "agent" as const,
    agentId: input.agent._id,
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies ApiKeyDoc;

  return {
    workspace: input.workspace,
    owner: input.owner,
    security: input.security,
    apiKey: stubKey,
    agentObjectId: input.agent._id,
    externalAgentId: input.agent.externalAgentId,
    agent: input.agent,
  };
}

export async function resolvePaymentIntentRecipientAddress(input: {
  type?: string;
  recipientUsername?: string;
  recipientAddress?: string;
  networkId?: string;
}) {
  if (input.recipientAddress?.trim() && input.networkId?.trim()) {
    const validated = validateRecipientAddress(input.recipientAddress, input.networkId);
    if (validated.ok) {
      return validated.address;
    }
    if (input.type === "address" || !input.recipientUsername?.trim()) {
      return normalizePaymentAddress(
        input.recipientAddress.trim().toLowerCase(),
        input.networkId,
      );
    }
  }

  if (!input.recipientUsername?.trim() || !input.networkId?.trim()) {
    return null;
  }

  const db = await getDb();
  const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    username: normalizeUsername(input.recipientUsername),
  });
  if (!user) return null;
  return resolveRecipientAddress(user, input.networkId);
}

export async function settleApprovedPaymentIntent(input: {
  workspace: WorkspaceDoc;
  owner: UserDoc;
  intentId: string;
  payerAddress: string;
  txHash: string;
  security: SecurityContext;
}) {
  const intent = await getPaymentIntentForWorkspace(input.workspace._id, input.intentId);
  if (!intent) {
    return { ok: false as const, error: "Payment intent not found", status: 404 as const };
  }

  if (intent.status !== "approved") {
    return {
      ok: false as const,
      error: `Payment intent is ${intent.status}, not approved`,
      status: 400 as const,
    };
  }

  if (intent.type !== "profile" && intent.type !== "address") {
    return {
      ok: false as const,
      error: "Only profile and address payment intents can be settled in the portal",
      status: 400 as const,
    };
  }

  if (
    intent.type === "profile" &&
    (!intent.recipientUsername ||
      intent.amount == null ||
      !intent.tokenId ||
      !intent.networkId)
  ) {
    return { ok: false as const, error: "Payment intent is missing required fields", status: 400 as const };
  }

  if (
    intent.type === "address" &&
    (!intent.recipientAddress ||
      intent.amount == null ||
      !intent.tokenId ||
      !intent.networkId)
  ) {
    return { ok: false as const, error: "Payment intent is missing required fields", status: 400 as const };
  }

  if (
    !intent.amount ||
    !intent.tokenId ||
    !intent.networkId
  ) {
    return { ok: false as const, error: "Payment intent is missing required fields", status: 400 as const };
  }

  const db = await getDb();
  const agent = await db.collection<AgentDoc>(COLLECTIONS.agents).findOne({
    _id: intent.agentObjectId,
    workspaceId: input.workspace._id,
  });

  if (!agent) {
    return { ok: false as const, error: "Linked agent not found", status: 404 as const };
  }

  const context = buildSessionAgentPayContext({
    workspace: input.workspace,
    owner: input.owner,
    agent,
    security: input.security,
  });

  const payResult =
    intent.type === "address"
      ? await recordAgentAddressPayment({
          context,
          externalAgentId: agent.externalAgentId,
          payerAddress: input.payerAddress,
          txHash: input.txHash,
          recipientAddress: intent.recipientAddress!,
          amount: intent.amount,
          tokenId: intent.tokenId,
          networkId: intent.networkId,
        })
      : await recordAgentProfilePayment({
          context,
          externalAgentId: agent.externalAgentId,
          payerAddress: input.payerAddress,
          txHash: input.txHash,
          recipientUsername: intent.recipientUsername!,
          amount: intent.amount,
          tokenId: intent.tokenId,
          networkId: intent.networkId,
        });

  if (!payResult.ok) {
    if ("policyResponse" in payResult && payResult.policyResponse) {
      return {
        ok: false as const,
        error: "Payment blocked by policy",
        status: 403 as const,
        policyResponse: payResult.policyResponse,
      };
    }
    return {
      ok: false as const,
      error: payResult.error ?? "Payment settlement failed",
      status: 400 as const,
      code: "code" in payResult ? payResult.code : undefined,
    };
  }

  const consumed = await consumePaymentIntent({
    workspaceId: input.workspace._id,
    intentId: input.intentId,
    txHash: input.txHash,
  });

  if (!consumed.ok) {
    return { ok: false as const, error: consumed.error, status: 400 as const };
  }

  const recipientLabel =
    intent.type === "address"
      ? intent.recipientAddress
      : `@${intent.recipientUsername}`;

  await logActivity({
    workspaceId: input.workspace._id,
    type: "payment_intent_approved",
    summary: `Agent payment completed · ${intent.amount} ${intent.tokenId} to ${recipientLabel}`,
  });

  return {
    ok: true as const,
    intent: serializePaymentIntent(consumed.intent),
    transactionId: "transactionId" in payResult ? payResult.transactionId : undefined,
    txHash: input.txHash,
    duplicate: "duplicate" in payResult ? payResult.duplicate : false,
  };
}
