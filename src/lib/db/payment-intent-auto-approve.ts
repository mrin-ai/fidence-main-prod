import type { MerchantApiContext } from "@/lib/db/merchant-api";
import { getAgentPolicy } from "@/lib/db/agent-policies";
import {
  isAutoPayEligibleFromChecks,
  preflightAgentAddressPayment,
  preflightAgentProfilePayment,
  type AgentPayPreflightResult,
} from "@/lib/db/agent-pay-preflight";
import {
  approvePaymentIntent,
  rejectActionablePaymentIntentsForAgent,
} from "@/lib/db/payment-intents";
import type { PaymentIntentDoc } from "@/lib/pay/types";

export async function evaluateAutoPayEligibility(input: {
  context: MerchantApiContext;
  type: "link" | "profile" | "address";
  recipientAddress?: string;
  recipientUsername?: string;
  amount?: number;
  tokenId?: string;
  networkId?: string;
}): Promise<boolean> {
  if (!input.context.agent) return false;

  const policy = await getAgentPolicy(
    input.context.workspace._id,
    input.context.agent._id,
  );
  if (!policy || policy.status !== "active" || policy.autoPayEnabled !== true) {
    return false;
  }

  const agentId = input.context.agent.externalAgentId;
  let preflight: AgentPayPreflightResult | null = null;

  if (
    input.type === "address" &&
    input.recipientAddress &&
    input.tokenId &&
    input.networkId &&
    input.amount != null
  ) {
    preflight = await preflightAgentAddressPayment({
      context: input.context,
      externalAgentId: agentId,
      recipientAddress: input.recipientAddress,
      tokenId: input.tokenId,
      networkId: input.networkId,
      amount: input.amount,
      dryRun: true,
    });
  } else if (
    input.type === "profile" &&
    input.recipientUsername &&
    input.tokenId &&
    input.networkId &&
    input.amount != null
  ) {
    preflight = await preflightAgentProfilePayment({
      context: input.context,
      externalAgentId: agentId,
      recipientUsername: input.recipientUsername,
      tokenId: input.tokenId,
      networkId: input.networkId,
      amount: input.amount,
      dryRun: true,
    });
  } else {
    return false;
  }

  return Boolean(preflight?.ready && isAutoPayEligibleFromChecks(preflight.checks));
}

/** When mandate preflight passes and auto-pay is enabled, skip manual portal approval. */
export async function tryAutoApprovePaymentIntent(input: {
  context: MerchantApiContext;
  intent: PaymentIntentDoc;
}) {
  if (input.intent.status !== "pending" || !input.context.agent) {
    return input.intent;
  }

  const eligible = await evaluateAutoPayEligibility({
    context: input.context,
    type: input.intent.type,
    recipientAddress: input.intent.recipientAddress,
    recipientUsername: input.intent.recipientUsername,
    amount: input.intent.amount,
    tokenId: input.intent.tokenId,
    networkId: input.intent.networkId,
  });

  if (!eligible) return input.intent;

  const approved = await approvePaymentIntent({
    workspaceId: input.context.workspace._id,
    intentId: input.intent.intentId,
    autoExecute: true,
  });

  if (approved.ok) {
    await rejectActionablePaymentIntentsForAgent({
      workspaceId: input.context.workspace._id,
      agentObjectId: input.context.agent._id,
      exceptIntentId: input.intent.intentId,
    });
    return approved.intent;
  }

  return input.intent;
}

export { isAutoPayEligibleFromChecks };
