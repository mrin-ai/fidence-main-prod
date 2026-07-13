import {
  agentHasWallet,
  getAgentByExternalId,
  getAgentWallets,
} from "@/lib/db/agents";
import type { MerchantApiContext } from "@/lib/db/merchant-api";
import { getPaymentLinkByUsernameAndPublicId } from "@/lib/db/payment-links";
import { getWorkspaceForUser } from "@/lib/db/auth";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { normalizeUsername } from "@/lib/db/profile";
import { resolveRecipientAddress } from "@/lib/db/wallets";
import { supportsOnChainPayment } from "@/lib/payment-contracts";
import type { UserDoc } from "@/lib/db/types";

export type PreflightCheck = {
  ok: boolean;
  code?: string;
  message: string;
};

export type AgentPayPreflightResult = {
  ready: boolean;
  type: "link" | "profile";
  checks: Record<string, PreflightCheck>;
};

function check(ok: boolean, message: string, code?: string): PreflightCheck {
  return { ok, message, ...(code ? { code } : {}) };
}

function allReady(checks: Record<string, PreflightCheck>) {
  return Object.values(checks).every((item) => item.ok);
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

  const wallets = getAgentWallets(agent);
  if (wallets.length === 0) {
    checks.agent_wallet = check(
      false,
      "No wallet added for this agent",
      "AGENT_WALLET_MISSING",
    );
  } else if (payerAddress && networkId) {
    checks.agent_wallet = agentHasWallet(agent, payerAddress, networkId)
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
          `Agent has no wallet on ${networkId}`,
          "AGENT_WALLET_MISSING",
        );
  } else {
    checks.agent_wallet = check(true, `${wallets.length} wallet(s) configured`);
  }

  return { checks, agent };
}

export async function preflightAgentLinkPayment(input: {
  context: MerchantApiContext;
  externalAgentId: string;
  linkUsername: string;
  linkPublicId: string;
  payerAddress?: string;
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

  return { ready: allReady(checks), type: "link", checks };
}

export async function preflightAgentProfilePayment(input: {
  context: MerchantApiContext;
  externalAgentId: string;
  recipientUsername: string;
  tokenId: string;
  networkId: string;
  payerAddress?: string;
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

  return { ready: allReady(checks), type: "profile", checks };
}
