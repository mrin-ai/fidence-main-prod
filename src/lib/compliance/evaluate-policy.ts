import { POLICY_CODES, type PolicyCode } from "@/lib/compliance/codes";

export type PolicyVerdict = "allow" | "deny" | "require_approval";

export type EvaluatePolicyAction =
  | "payment_links.create"
  | "payment_links.batch_item"
  | "pay.link"
  | "pay.profile";

export type EvaluablePolicy = {
  id: string;
  status: "draft" | "active";
  policyVersion: number;
  maxAmountPerPayment: number;
  dailySpendCap: number;
  monthlySpendCap: number | null;
  allowedNetworkIds: string[];
  allowedTokenIds: string[];
  allowCreatePaymentLinks: boolean;
  allowPay: boolean;
  requireApprovalAbove: number | null;
};

export type EvaluatePolicyInput = {
  agentStatus: "active" | "inactive";
  action: EvaluatePolicyAction;
  amountUsd: number;
  networkId: string;
  tokenId: string;
  policy: EvaluablePolicy | null;
  spentDailyUsd: number;
  spentMonthlyUsd: number;
  /** Unpaid pending payment-link exposure (USD). Counts toward caps on create. */
  outstandingUsd?: number;
  /** When true, skip require_approval (already approved intent). */
  approvalConsumed?: boolean;
  policyVersionAtRead?: number;
};

export type EvaluatePolicyResult = {
  verdict: PolicyVerdict;
  codes: PolicyCode[];
  policyVersion: number | null;
  policyId: string | null;
  remainingDailyUsd?: number;
  remainingMonthlyUsd?: number;
};

function deny(codes: PolicyCode[], policy: EvaluablePolicy | null): EvaluatePolicyResult {
  return {
    verdict: "deny",
    codes,
    policyVersion: policy?.policyVersion ?? null,
    policyId: policy?.id ?? null,
  };
}

/**
 * Pure policy evaluator. Fail closed on missing/inactive policy or inconsistent state.
 */
export function evaluatePolicy(input: EvaluatePolicyInput): EvaluatePolicyResult {
  try {
    if (input.agentStatus !== "active") {
      return deny([POLICY_CODES.AGENT_DISABLED], input.policy);
    }

    const policy = input.policy;
    if (!policy || policy.status !== "active") {
      return deny([POLICY_CODES.NO_ACTIVE_POLICY], policy);
    }

    if (
      input.policyVersionAtRead !== undefined &&
      input.policyVersionAtRead !== policy.policyVersion
    ) {
      return deny([POLICY_CODES.POLICY_VERSION_CONFLICT], policy);
    }

    const isCreate =
      input.action === "payment_links.create" ||
      input.action === "payment_links.batch_item";
    const isPay = input.action === "pay.link" || input.action === "pay.profile";

    if (isCreate && !policy.allowCreatePaymentLinks) {
      return deny([POLICY_CODES.ACTION_NOT_ALLOWED], policy);
    }
    if (isPay && !policy.allowPay) {
      return deny([POLICY_CODES.ACTION_NOT_ALLOWED], policy);
    }

    const networkId = input.networkId.trim().toLowerCase();
    const tokenId = input.tokenId.trim().toLowerCase();

    if (!policy.allowedNetworkIds.map((id) => id.toLowerCase()).includes(networkId)) {
      return deny([POLICY_CODES.NETWORK_NOT_ALLOWED], policy);
    }
    if (!policy.allowedTokenIds.map((id) => id.toLowerCase()).includes(tokenId)) {
      return deny([POLICY_CODES.TOKEN_NOT_ALLOWED], policy);
    }

    if (
      !Number.isFinite(input.amountUsd) ||
      input.amountUsd < 0 ||
      !Number.isFinite(input.spentDailyUsd) ||
      !Number.isFinite(input.spentMonthlyUsd)
    ) {
      return deny([POLICY_CODES.POLICY_EVAL_ERROR], policy);
    }

    if (input.amountUsd > policy.maxAmountPerPayment) {
      return deny([POLICY_CODES.AMOUNT_ABOVE_MAX], policy);
    }

    const outstandingUsd = Number.isFinite(input.outstandingUsd)
      ? Math.max(0, input.outstandingUsd ?? 0)
      : 0;
    const committedDaily = input.spentDailyUsd + outstandingUsd;
    const committedMonthly = input.spentMonthlyUsd + outstandingUsd;

    const remainingDailyUsd = Math.max(0, policy.dailySpendCap - committedDaily);
    const remainingMonthlyUsd =
      policy.monthlySpendCap === null
        ? undefined
        : Math.max(0, policy.monthlySpendCap - committedMonthly);

    if (committedDaily + input.amountUsd > policy.dailySpendCap) {
      return {
        verdict: "deny",
        codes: [POLICY_CODES.DAILY_CAP_EXCEEDED],
        policyVersion: policy.policyVersion,
        policyId: policy.id,
        remainingDailyUsd,
        remainingMonthlyUsd,
      };
    }

    if (
      policy.monthlySpendCap !== null &&
      committedMonthly + input.amountUsd > policy.monthlySpendCap
    ) {
      return {
        verdict: "deny",
        codes: [POLICY_CODES.MONTHLY_CAP_EXCEEDED],
        policyVersion: policy.policyVersion,
        policyId: policy.id,
        remainingDailyUsd,
        remainingMonthlyUsd,
      };
    }

    if (
      isPay &&
      !input.approvalConsumed &&
      policy.requireApprovalAbove !== null &&
      input.amountUsd >= policy.requireApprovalAbove
    ) {
      return {
        verdict: "require_approval",
        codes: [POLICY_CODES.APPROVAL_REQUIRED],
        policyVersion: policy.policyVersion,
        policyId: policy.id,
        remainingDailyUsd,
        remainingMonthlyUsd,
      };
    }

    return {
      verdict: "allow",
      codes: [],
      policyVersion: policy.policyVersion,
      policyId: policy.id,
      remainingDailyUsd,
      remainingMonthlyUsd,
    };
  } catch {
    return deny([POLICY_CODES.POLICY_EVAL_ERROR], input.policy);
  }
}
