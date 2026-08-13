export function isPayAgentConnectEnabled() {
  const flag = process.env.PAY_AGENT_CONNECT_ENABLED;
  if (flag === undefined || flag === "") return true;
  return flag === "1" || flag.toLowerCase() === "true";
}

export function getAgentLinkTtlMs() {
  const minutes = Number(process.env.AGENT_LINK_TTL_MINUTES ?? "15");
  return Math.max(1, minutes) * 60 * 1000;
}

export function getPaymentIntentTtlMs() {
  const minutes = Number(process.env.PAYMENT_INTENT_TTL_MINUTES ?? "30");
  return Math.max(1, minutes) * 60 * 1000;
}

export const MAX_LINKED_AGENTS_PER_WORKSPACE = Number(
  process.env.MAX_LINKED_AGENTS_PER_WORKSPACE ?? "5",
);

export const MAX_SAVED_ADDRESSES_PER_WORKSPACE = 50;

export const MAX_PENDING_LINK_SESSIONS_PER_WORKSPACE = 2;

export const AGENT_SCOPED_KEY_PERMISSIONS = [
  "agents.self.read",
  "pay.preflight",
  "pay.create",
  "payment_intents.create",
  "payment_intents.read",
  "compliance.policy.read",
  "payment_links.create",
] as const;
