import type { ObjectId } from "mongodb";

import type { ComplianceActor } from "@/lib/compliance/actor";
import type { PolicyCode } from "@/lib/compliance/codes";
import type { ComplianceDecisionAction } from "@/lib/compliance/actions";
import type { PolicyVerdict } from "@/lib/compliance/evaluate-policy";

export type AgentPolicyDoc = {
  _id: ObjectId;
  workspaceId: ObjectId;
  agentId: ObjectId;
  externalAgentId: string;
  publicId: string;
  status: "draft" | "active";
  policyVersion: number;
  maxAmountPerPayment: number;
  dailySpendCap: number;
  monthlySpendCap: number | null;
  allowedNetworkIds: string[];
  allowedTokenIds: string[];
  allowCreatePaymentLinks: boolean;
  allowPay: boolean;
  autoPayEnabled?: boolean;
  requireApprovalAbove: number | null;
  createdAt: Date;
  updatedAt: Date;
  activatedAt?: Date;
  lastUpdatedByUserId?: string;
  lastUpdatedIp?: string;
  lastUpdatedAt?: Date;
};

export type PolicyDecisionDoc = {
  _id?: ObjectId;
  receiptId: string;
  workspaceId: ObjectId;
  action: ComplianceDecisionAction | string;
  verdict: PolicyVerdict | "recorded";
  codes: PolicyCode[] | string[];
  policyVersion: number | null;
  policyId?: string | null;
  amountUsd?: number;
  networkId?: string;
  tokenId?: string;
  requestId?: string;
  agentId?: ObjectId;
  agentPublicId?: string;
  externalAgentId?: string;
  actor: ComplianceActor;
  createdAt: Date;
  note?: string;
};

export type AgentSpendDailyDoc = {
  _id?: ObjectId;
  workspaceId: ObjectId;
  agentId: ObjectId;
  day: string;
  amountUsd: number;
  updatedAt: Date;
};

export type AgentSpendMonthlyDoc = {
  _id?: ObjectId;
  workspaceId: ObjectId;
  agentId: ObjectId;
  month: string;
  amountUsd: number;
  updatedAt: Date;
};

export type PaymentApprovalStatus =
  | "pending"
  | "approved"
  | "claimed"
  | "rejected"
  | "expired"
  | "consumed";

export type PaymentApprovalPayload = {
  type: "link" | "profile" | "address";
  linkUsername?: string;
  linkPublicId?: string;
  recipientUsername?: string;
  recipientAddress?: string;
  amount: number;
  tokenId: string;
  networkId: string;
  amountUsd: number;
  payerAddress?: string;
};

export type PaymentApprovalDoc = {
  _id: ObjectId;
  approvalId: string;
  workspaceId: ObjectId;
  agentId: ObjectId;
  agentPublicId: string;
  externalAgentId: string;
  status: PaymentApprovalStatus;
  amountUsd: number;
  networkId: string;
  tokenId: string;
  payload: PaymentApprovalPayload;
  requestedBy: ComplianceActor;
  resolvedBy?: ComplianceActor;
  createdAt: Date;
  expiresAt: Date;
  resolvedAt?: Date;
  claimedAt?: Date;
  policyVersion: number | null;
  receiptId?: string;
};
