export const COMPLIANCE_DECISION_ACTIONS = {
  PAYMENT_LINKS_CREATE: "payment_links.create",
  PAYMENT_LINKS_BATCH: "payment_links.batch",
  PAYMENT_LINKS_BATCH_ITEM: "payment_links.batch_item",
  PAY_LINK: "pay.link",
  PAY_PROFILE: "pay.profile",
  PAY_PREFLIGHT: "pay.preflight",
  POLICY_DRAFT_SAVED: "policy.draft_saved",
  POLICY_ACTIVATED: "policy.activated",
  POLICY_DEACTIVATED: "policy.deactivated",
  APPROVAL_APPROVED: "approval.approved",
  APPROVAL_REJECTED: "approval.rejected",
  APPROVAL_EXPIRED: "approval.expired",
} as const;

export type ComplianceDecisionAction =
  (typeof COMPLIANCE_DECISION_ACTIONS)[keyof typeof COMPLIANCE_DECISION_ACTIONS];
