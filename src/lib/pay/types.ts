import type { ObjectId } from "mongodb";

import type { PendingSpendingWallet } from "@/lib/pay/spending-wallet-types";

export type AgentRegistrationSource = "api" | "linked";

export type AgentLinkSessionStatus = "pending" | "approved" | "expired" | "rejected" | "cancelled";

export type AgentSigningMode = "agent_wallet" | "browser_only";

export type AgentLinkSessionDoc = {
  _id: ObjectId;
  linkId: string;
  publicKey: string;
  pollSecretHash: string;
  platform: string;
  agentName: string;
  description?: string;
  status: AgentLinkSessionStatus;
  workspaceId?: ObjectId;
  agentObjectId?: ObjectId;
  apiKeyId?: ObjectId;
  scopedKeyDeliveredAt?: Date;
  spendingWalletDeliveredAt?: Date;
  signingMode?: "agent_wallet";
  pendingSpendingWallets?: PendingSpendingWallet[];
  expiresAt: Date;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type SavedAddressDoc = {
  _id: ObjectId;
  workspaceId: ObjectId;
  name: string;
  email?: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentIntentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "consumed";

export type PaymentIntentDoc = {
  _id: ObjectId;
  intentId: string;
  workspaceId: ObjectId;
  agentObjectId: ObjectId;
  externalAgentId: string;
  status: PaymentIntentStatus;
  type: "link" | "profile" | "address";
  linkUsername?: string;
  linkPublicId?: string;
  recipientUsername?: string;
  recipientAddress?: string;
  amount?: number;
  tokenId?: string;
  networkId?: string;
  savedAddressId?: ObjectId;
  idempotencyKey?: string;
  approvalId?: string;
  complianceDecisionId?: string;
  /** When true, portal runs wallet sign in background without approval modal. */
  autoExecute?: boolean;
  txHash?: string;
  expiresAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  consumedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type SavedAddressSummary = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  createdAt: string;
  updatedAt: string;
};

export type LinkedAgentSummary = {
  id: string;
  publicId: string;
  externalAgentId: string;
  name: string;
  platform?: string;
  status: "active" | "inactive";
  defaultPayerWalletId?: string;
  wallets: Array<{
    id: string;
    networkId: string;
    address: string;
    verifiedAt?: string;
  }>;
  linkedAt?: string;
  lastActiveAt: string;
};
