import { actorFromSecurity } from "@/lib/compliance/actor";
import { evaluateAndRecordPolicy } from "@/lib/compliance/evaluate-and-record";
import { evaluatePolicy } from "@/lib/compliance/evaluate-policy";
import { POLICY_CODES } from "@/lib/compliance/codes";
import { toPolicyAmountUsdAsync } from "@/lib/compliance/valuation-async";
import {
  agentHasWallet,
  getAgentByExternalId,
  getAgentPayerWallets,
  isLinkedAgent,
} from "@/lib/db/agents";
import { getAgentPolicy, toEvaluablePolicy } from "@/lib/db/agent-policies";
import { getAgentSpendTotals } from "@/lib/db/agent-spend";
import type { MerchantApiContext } from "@/lib/db/merchant-api";
import { getPaymentLinkByUsernameAndPublicId } from "@/lib/db/payment-links";
import { getWorkspaceForUser } from "@/lib/db/auth";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { normalizeUsername } from "@/lib/db/profile";
import { resolveRecipientAddress } from "@/lib/db/wallets";
import { supportsOnChainPayment } from "@/lib/payment-contracts";
import { validateRecipientAddress } from "@/lib/pay/recipient-address";
import type { UserDoc } from "@/lib/db/types";
import type { AgentDoc } from "@/lib/db/merchant-types";

export type PreflightCheck = {
  ok: boolean;
  code?: string;
  message: string;
};

export type AgentPayPreflightResult = {
  ready: boolean;
  type: "link" | "profile" | "address";
  checks: Record<string, PreflightCheck>;
};

function check(ok: boolean, message: string, code?: string): PreflightCheck {
  return { ok, message, ...(code ? { code } : {}) };
}

function allReady(checks: Record<string, PreflightCheck>) {
  return Object.values(checks).every((item) => item.ok);
}

export function isAutoPayEligibleFromChecks(checks: Record<string, PreflightCheck>) {
  if (Object.values(checks).some((item) => !item.ok)) return false;
  return !Object.values(checks).some(
    (item) => item.code === POLICY_CODES.APPROVAL_REQUIRED,
  );
}

export async function withAutoPayEligible(
  context: MerchantApiContext,
  externalAgentId: string,
  result: AgentPayPreflightResult,
): Promise<AgentPayPreflightResult & { autoPayEligible: boolean }> {
  const agent = await getAgentByExternalId(context.workspace._id, externalAgentId);
  if (!agent) {
    return { ...result, autoPayEligible: false };
  }

  const policy = await getAgentPolicy(context.workspace._id, agent._id);
  const autoPayEligible = Boolean(
    policy?.autoPayEnabled === true &&
      policy.status === "active" &&
      isAutoPayEligibleFromChecks(result.checks),
  );

  return { ...result, autoPayEligible };
}

function agentWalletVerified(
  agent: AgentDoc,
  owner: UserDoc | null,
  payerAddress?: string,
  networkId?: string,
) {
  if (process.env.AGENT_REQUIRE_VERIFIED_WALLET !== "true") {
    return true;
  }
  const wallets = getAgentPayerWallets(agent, owner);
  if (!payerAddress || !networkId) {
    return wallets.some((w) => w.verifiedAt);
  }
  const normalized = payerAddress.trim().toLowerCase();
  return wallets.some(
    (w) =>
      w.networkId === networkId &&
      w.address.toLowerCase() === normalized &&
      Boolean(w.verifiedAt),
  );
}

async function checkAgent(
  context: MerchantApiContext,
  externalAgentId: string,
  payerAddress?: string,
  networkId?: string,
) {
  const checks: Record<string, PreflightCheck> = {
    api_key: check(true, "API key is valid"),
  };

  const agent = await getAgentByExternalId(context.workspace._id, externalAgentId);

  if (!agent) {
    checks.agent_registered = check(
      false,
      "Agent is not registered",
      "AGENT_NOT_FOUND",
    );
    checks.agent_active = check(false, "Agent status unknown", "AGENT_NOT_FOUND");
    checks.agent_wallet = check(
      false,
      "Agent wallet not configured",
      "AGENT_NOT_FOUND",
    );
    return { checks, agent: null };
  }

  checks.agent_registered = check(true, "Agent is registered");

  if (agent.status !== "active") {
    checks.agent_active = check(false, "Agent is disabled", "AGENT_INACTIVE");
  } else {
    checks.agent_active = check(true, "Agent is active");
  }

  const wallets = getAgentPayerWallets(agent, context.owner);
  if (wallets.length === 0) {
    checks.agent_wallet = check(
      false,
      isLinkedAgent(agent)
        ? "No verified wallet on /wallets for this network"
        : "No wallet added for this agent",
      "AGENT_WALLET_MISSING",
    );
  } else if (payerAddress && networkId) {
    checks.agent_wallet = agentHasWallet(agent, payerAddress, networkId, context.owner)
      ? check(true, "Payer address matches agent wallet on this network")
      : check(
          false,
          "payerAddress does not match a wallet registered for this agent",
          "AGENT_WALLET_MISMATCH",
        );
  } else if (networkId) {
    const hasNetworkWallet = wallets.some((wallet) => wallet.networkId === networkId);
    checks.agent_wallet = hasNetworkWallet
      ? check(true, `Agent has a wallet on ${networkId}`)
      : check(
          false,
          isLinkedAgent(agent)
            ? `No verified wallet on /wallets for ${networkId}`
            : `Agent has no wallet on ${networkId}`,
          "AGENT_WALLET_MISSING",
        );
  } else {
    checks.agent_wallet = check(true, `${wallets.length} wallet(s) configured`);
  }

  if (payerAddress && networkId && agentHasWallet(agent, payerAddress, networkId, context.owner)) {
    checks.agent_wallet_verified = agentWalletVerified(
      agent,
      context.owner,
      payerAddress,
      networkId,
    )
      ? check(true, "Agent wallet is verified")
      : check(
          false,
          "Agent wallet must be cryptographically verified before pay",
          "AGENT_WALLET_UNVERIFIED",
        );
  }

  return { checks, agent };
}

async function appendPolicyChecks(input: {
  context: MerchantApiContext;
  agent: AgentDoc;
  action: "pay.link" | "pay.profile" | "pay.address";
  amount?: number;
  tokenId: string;
  networkId: string;
  checks: Record<string, PreflightCheck>;
  dryRun?: boolean;
}) {
  const amountKnown =
    input.amount !== undefined && Number.isFinite(input.amount) && input.amount > 0;

  if (!amountKnown) {
    const [policyDoc, spend] = await Promise.all([
      getAgentPolicy(input.context.workspace._id, input.agent._id),
      getAgentSpendTotals(input.context.workspace._id, input.agent._id),
    ]);
    const soft = evaluatePolicy({
      agentStatus: input.agent.status,
      action: input.action,
      amountUsd: 0,
      networkId: input.networkId,
      tokenId: input.tokenId,
      policy: policyDoc ? toEvaluablePolicy(policyDoc) : null,
      spentDailyUsd: spend.spentDailyUsd,
      spentMonthlyUsd: spend.spentMonthlyUsd,
    });

    input.checks.policy_active = soft.codes.includes(POLICY_CODES.NO_ACTIVE_POLICY)
      ? check(false, "No active compliance policy", POLICY_CODES.NO_ACTIVE_POLICY)
      : check(true, "Active compliance policy");
    input.checks.policy_action = soft.codes.includes(POLICY_CODES.ACTION_NOT_ALLOWED)
      ? check(false, "Pay action not allowed by policy", POLICY_CODES.ACTION_NOT_ALLOWED)
      : check(true, "Pay action allowed by policy");
    input.checks.policy_network = soft.codes.includes(POLICY_CODES.NETWORK_NOT_ALLOWED)
      ? check(false, "Network not allowed by policy", POLICY_CODES.NETWORK_NOT_ALLOWED)
      : check(true, "Network allowed by policy");
    input.checks.policy_token = soft.codes.includes(POLICY_CODES.TOKEN_NOT_ALLOWED)
      ? check(false, "Token not allowed by policy", POLICY_CODES.TOKEN_NOT_ALLOWED)
      : check(true, "Token allowed by policy");
    input.checks.policy_amount = check(
      false,
      "Amount required for full policy preflight",
      "AMOUNT_REQUIRED",
    );
    return;
  }

  const valuation = await toPolicyAmountUsdAsync(input.amount!, input.tokenId);
  if (!valuation.ok) {
    input.checks.policy_amount = check(
      false,
      "USD valuation unavailable for this token",
      valuation.code,
    );
    return;
  }

  if (input.dryRun) {
    const [policyDoc, spend] = await Promise.all([
      getAgentPolicy(input.context.workspace._id, input.agent._id),
      getAgentSpendTotals(input.context.workspace._id, input.agent._id),
    ]);
    const evaluated = evaluatePolicy({
      agentStatus: input.agent.status,
      action: input.action,
      amountUsd: valuation.amountUsd,
      networkId: input.networkId,
      tokenId: input.tokenId,
      policy: policyDoc ? toEvaluablePolicy(policyDoc) : null,
      spentDailyUsd: spend.spentDailyUsd,
      spentMonthlyUsd: spend.spentMonthlyUsd,
    });
    input.checks.policy_amount = evaluated.verdict === "deny"
      ? check(false, evaluated.codes[0] ?? "Denied", evaluated.codes[0])
      : check(true, "Amount within policy limits (dry run)");
    return;
  }

  const evaluated = await evaluateAndRecordPolicy({
    workspaceId: input.context.workspace._id,
    agent: input.agent,
    action: input.action,
    amount: input.amount!,
    tokenId: input.tokenId,
    networkId: input.networkId,
    actor: actorFromSecurity(input.context.security, {
      actorType: "agent",
      agentId: input.agent._id.toString(),
      agentPublicId: input.agent.publicId,
      externalAgentId: input.agent.externalAgentId,
    }),
    security: input.context.security,
    skipReceiptOnAllow: true,
  });

  input.checks.policy_active = evaluated.codes.includes(POLICY_CODES.NO_ACTIVE_POLICY)
    ? check(false, "No active compliance policy", POLICY_CODES.NO_ACTIVE_POLICY)
    : check(true, "Active compliance policy");
  input.checks.policy_action = evaluated.codes.includes(POLICY_CODES.ACTION_NOT_ALLOWED)
    ? check(false, "Pay action not allowed by policy", POLICY_CODES.ACTION_NOT_ALLOWED)
    : check(true, "Pay action allowed by policy");
  input.checks.policy_network = evaluated.codes.includes(POLICY_CODES.NETWORK_NOT_ALLOWED)
    ? check(false, "Network not allowed by policy", POLICY_CODES.NETWORK_NOT_ALLOWED)
    : check(true, "Network allowed by policy");
  input.checks.policy_token = evaluated.codes.includes(POLICY_CODES.TOKEN_NOT_ALLOWED)
    ? check(false, "Token not allowed by policy", POLICY_CODES.TOKEN_NOT_ALLOWED)
    : check(true, "Token allowed by policy");

  const amountDenied =
    evaluated.codes.includes(POLICY_CODES.AMOUNT_ABOVE_MAX) ||
    evaluated.codes.includes(POLICY_CODES.DAILY_CAP_EXCEEDED) ||
    evaluated.codes.includes(POLICY_CODES.MONTHLY_CAP_EXCEEDED) ||
    evaluated.codes.includes(POLICY_CODES.AMOUNT_VALUATION_UNAVAILABLE);

  input.checks.policy_amount = amountDenied
    ? check(
        false,
        evaluated.codes[0] ?? "Amount denied by policy",
        evaluated.codes[0],
      )
    : evaluated.verdict === "require_approval"
      ? check(
          true,
          "Amount requires human approval before pay",
          POLICY_CODES.APPROVAL_REQUIRED,
        )
      : check(true, "Amount within policy limits");
}

export async function preflightAgentLinkPayment(input: {
  context: MerchantApiContext;
  externalAgentId: string;
  linkUsername: string;
  linkPublicId: string;
  payerAddress?: string;
  dryRun?: boolean;
}): Promise<AgentPayPreflightResult> {
  const link = await getPaymentLinkByUsernameAndPublicId(
    input.linkUsername,
    input.linkPublicId,
  );

  const { checks, agent } = await checkAgent(
    input.context,
    input.externalAgentId,
    input.payerAddress,
    link?.networkId,
  );

  if (!link) {
    checks.link_found = check(false, "Payment link not found", "LINK_NOT_FOUND");
    checks.link_payable = check(false, "Payment link not payable", "LINK_NOT_FOUND");
    checks.token_network = check(
      false,
      "Token/network unknown",
      "LINK_NOT_FOUND",
    );
    checks.recipient_wallet = check(
      false,
      "Recipient wallet unknown",
      "LINK_NOT_FOUND",
    );
    return { ready: false, type: "link", checks };
  }

  checks.link_found = check(true, "Payment link exists");

  if (link.status === "pending" && link.canPay) {
    checks.link_payable = check(true, "Payment link is pending and payable");
  } else {
    checks.link_payable = check(
      false,
      `Payment link is ${link.status} and cannot be paid`,
      "LINK_NOT_PAYABLE",
    );
  }

  if (supportsOnChainPayment(link.networkId, link.tokenId)) {
    checks.token_network = check(
      true,
      `${link.tokenId.toUpperCase()} on ${link.networkId} is supported`,
    );
  } else {
    checks.token_network = check(
      false,
      `${link.tokenId}/${link.networkId} is not supported`,
      "TOKEN_NETWORK_UNSUPPORTED",
    );
  }

  if (link.recipientAddress) {
    checks.recipient_wallet = check(true, "Link recipient wallet is configured");
  } else {
    checks.recipient_wallet = check(
      false,
      "Merchant has no receiving wallet for this link",
      "RECIPIENT_WALLET_MISSING",
    );
  }

  if (!agent) {
    return { ready: allReady(checks), type: "link", checks };
  }

  await appendPolicyChecks({
    context: input.context,
    agent,
    action: "pay.link",
    amount: link.amount,
    tokenId: link.tokenId,
    networkId: link.networkId,
    checks,
    dryRun: input.dryRun,
  });

  return { ready: allReady(checks), type: "link", checks };
}

export async function preflightAgentProfilePayment(input: {
  context: MerchantApiContext;
  externalAgentId: string;
  recipientUsername: string;
  tokenId: string;
  networkId: string;
  payerAddress?: string;
  amount?: number;
  dryRun?: boolean;
}): Promise<AgentPayPreflightResult> {
  const { checks, agent } = await checkAgent(
    input.context,
    input.externalAgentId,
    input.payerAddress,
    input.networkId,
  );

  if (supportsOnChainPayment(input.networkId, input.tokenId)) {
    checks.token_network = check(
      true,
      `${input.tokenId.toUpperCase()} on ${input.networkId} is supported`,
    );
  } else {
    checks.token_network = check(
      false,
      `${input.tokenId}/${input.networkId} is not supported`,
      "TOKEN_NETWORK_UNSUPPORTED",
    );
  }

  const username = normalizeUsername(input.recipientUsername);
  const db = await getDb();
  const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    username,
  });

  if (!user) {
    checks.recipient_found = check(false, "Recipient not found", "RECIPIENT_NOT_FOUND");
    checks.recipient_wallet = check(
      false,
      "Recipient wallet unknown",
      "RECIPIENT_NOT_FOUND",
    );
    return { ready: allReady(checks), type: "profile", checks };
  }

  checks.recipient_found = check(true, "Recipient profile exists");

  const recipientAddress = resolveRecipientAddress(user, input.networkId);
  if (recipientAddress) {
    checks.recipient_wallet = check(
      true,
      "Recipient has a verified wallet on this network",
    );
  } else {
    checks.recipient_wallet = check(
      false,
      "Recipient has no verified wallet for this network",
      "RECIPIENT_WALLET_MISSING",
    );
  }

  const workspace = await getWorkspaceForUser(user._id);
  if (!workspace) {
    checks.recipient_workspace = check(
      false,
      "Recipient workspace not found",
      "RECIPIENT_WORKSPACE_MISSING",
    );
  } else {
    checks.recipient_workspace = check(true, "Recipient workspace exists");
  }

  if (!agent) {
    return { ready: allReady(checks), type: "profile", checks };
  }

  await appendPolicyChecks({
    context: input.context,
    agent,
    action: "pay.profile",
    amount: input.amount,
    tokenId: input.tokenId,
    networkId: input.networkId,
    checks,
    dryRun: input.dryRun,
  });

  return { ready: allReady(checks), type: "profile", checks };
}

export async function preflightAgentAddressPayment(input: {
  context: MerchantApiContext;
  externalAgentId: string;
  recipientAddress: string;
  tokenId: string;
  networkId: string;
  payerAddress?: string;
  amount?: number;
  dryRun?: boolean;
}): Promise<AgentPayPreflightResult> {
  const { checks, agent } = await checkAgent(
    input.context,
    input.externalAgentId,
    input.payerAddress,
    input.networkId,
  );

  if (supportsOnChainPayment(input.networkId, input.tokenId)) {
    checks.token_network = check(
      true,
      `${input.tokenId.toUpperCase()} on ${input.networkId} is supported`,
    );
  } else {
    checks.token_network = check(
      false,
      `${input.tokenId}/${input.networkId} is not supported`,
      "TOKEN_NETWORK_UNSUPPORTED",
    );
  }

  const validated = validateRecipientAddress(input.recipientAddress, input.networkId);
  if (validated.ok) {
    checks.recipient_address = check(true, "Recipient address is valid");
  } else {
    checks.recipient_address = check(
      false,
      validated.error,
      "INVALID_RECIPIENT_ADDRESS",
    );
  }

  if (!agent) {
    return { ready: allReady(checks), type: "address", checks };
  }

  await appendPolicyChecks({
    context: input.context,
    agent,
    action: "pay.address",
    amount: input.amount,
    tokenId: input.tokenId,
    networkId: input.networkId,
    checks,
    dryRun: input.dryRun,
  });

  return { ready: allReady(checks), type: "address", checks };
}
