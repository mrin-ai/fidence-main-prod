export const POLICY_CODES = {
  NO_ACTIVE_POLICY: "NO_ACTIVE_POLICY",
  AGENT_DISABLED: "AGENT_DISABLED",
  ACTION_NOT_ALLOWED: "ACTION_NOT_ALLOWED",
  NETWORK_NOT_ALLOWED: "NETWORK_NOT_ALLOWED",
  TOKEN_NOT_ALLOWED: "TOKEN_NOT_ALLOWED",
  AMOUNT_ABOVE_MAX: "AMOUNT_ABOVE_MAX",
  DAILY_CAP_EXCEEDED: "DAILY_CAP_EXCEEDED",
  MONTHLY_CAP_EXCEEDED: "MONTHLY_CAP_EXCEEDED",
  APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
  POLICY_EVAL_ERROR: "POLICY_EVAL_ERROR",
  CONTENT_GUARD_BLOCKED: "CONTENT_GUARD_BLOCKED",
  AMOUNT_VALUATION_UNAVAILABLE: "AMOUNT_VALUATION_UNAVAILABLE",
  POLICY_VERSION_CONFLICT: "POLICY_VERSION_CONFLICT",
  ENFORCEMENT_BYPASSED: "ENFORCEMENT_BYPASSED",
  CONFIRM_WIDE_OPEN_REQUIRED: "CONFIRM_WIDE_OPEN_REQUIRED",
  SETTLEMENT_AMOUNT_UNKNOWN: "SETTLEMENT_AMOUNT_UNKNOWN",
} as const;

export type PolicyCode = (typeof POLICY_CODES)[keyof typeof POLICY_CODES];

export const POLICY_CODE_MESSAGES: Record<PolicyCode, string> = {
  NO_ACTIVE_POLICY: "Agent has no active compliance policy",
  AGENT_DISABLED: "Agent is disabled",
  ACTION_NOT_ALLOWED: "This action is not allowed by the agent policy",
  NETWORK_NOT_ALLOWED: "Network is not allowed by the agent policy",
  TOKEN_NOT_ALLOWED: "Token is not allowed by the agent policy",
  AMOUNT_ABOVE_MAX: "Amount exceeds max per payment",
  DAILY_CAP_EXCEEDED: "Daily spend cap exceeded",
  MONTHLY_CAP_EXCEEDED: "Monthly spend cap exceeded",
  APPROVAL_REQUIRED: "Human approval is required for this payment",
  POLICY_EVAL_ERROR: "Policy evaluation failed",
  CONTENT_GUARD_BLOCKED: "Request blocked by content safety guard",
  AMOUNT_VALUATION_UNAVAILABLE: "USD valuation unavailable for this token",
  POLICY_VERSION_CONFLICT: "Policy changed during evaluation",
  ENFORCEMENT_BYPASSED: "Compliance enforcement was bypassed by configuration",
  CONFIRM_WIDE_OPEN_REQUIRED:
    "Daily spend cap is very high; confirm with confirmWideOpen: true",
  SETTLEMENT_AMOUNT_UNKNOWN: "Could not determine on-chain settlement amount",
};

export function policyDeniedMessage(code: PolicyCode) {
  return POLICY_CODE_MESSAGES[code] ?? "Policy denied";
}
