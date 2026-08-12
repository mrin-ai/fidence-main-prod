import type { ObjectId } from "mongodb";

import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

/** 100 requests/sec sustained (single-link creates, pay, register, etc.) */
export const MERCHANT_API_RATE_LIMIT = {
  max: 6000,
  windowMs: 60_000,
} as const;

/** Batch endpoint: up to 50 links/request → 120 req/min ≈ 100 links/sec */
export const MERCHANT_BATCH_RATE_LIMIT = {
  max: 120,
  windowMs: 60_000,
} as const;

export const PAYMENT_LINK_BATCH_MAX = 50;

export async function enforceMerchantApiRateLimit(workspaceId: ObjectId) {
  const result = await checkRateLimit(
    `merchant-api:${workspaceId.toString()}`,
    MERCHANT_API_RATE_LIMIT,
  );

  if (!result.allowed) {
    return rateLimitResponse(result);
  }

  return null;
}

export async function enforceMerchantBatchRateLimit(workspaceId: ObjectId) {
  const result = await checkRateLimit(
    `merchant-api-batch:${workspaceId.toString()}`,
    MERCHANT_BATCH_RATE_LIMIT,
  );

  if (!result.allowed) {
    return rateLimitResponse(result);
  }

  return null;
}

/** Policy writes: lower volume than pay traffic */
export const COMPLIANCE_POLICY_RATE_LIMIT = {
  max: 60,
  windowMs: 60_000,
} as const;

export async function enforceCompliancePolicyRateLimit(workspaceId: ObjectId) {
  const result = await checkRateLimit(
    `compliance-policy:${workspaceId.toString()}`,
    COMPLIANCE_POLICY_RATE_LIMIT,
  );

  if (!result.allowed) {
    return rateLimitResponse(result);
  }

  return null;
}

/** Compliance read endpoints (catalog, audit, decisions, approvals list) */
export const COMPLIANCE_READ_RATE_LIMIT = {
  max: 120,
  windowMs: 60_000,
} as const;

export async function enforceComplianceReadRateLimit(workspaceId: ObjectId) {
  const result = await checkRateLimit(
    `compliance-read:${workspaceId.toString()}`,
    COMPLIANCE_READ_RATE_LIMIT,
  );

  if (!result.allowed) {
    return rateLimitResponse(result);
  }

  return null;
}
