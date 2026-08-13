import type { ObjectId } from "mongodb";

export type SecurityContext = {
  ip: string;
  userAgent: string;
  device: string;
  browser: string;
  country?: string;
  timestamp: Date;
  date: string;
};

export type SecurityActorType = "user" | "agent" | "api_key" | "system";

export type SecurityAuditDoc = {
  _id?: ObjectId;
  workspaceId: ObjectId;
  actorType: SecurityActorType;
  actorId?: string;
  agentId?: ObjectId;
  action: string;
  resourceType?: string;
  resourceId?: string;
  security: SecurityContext;
  occurredAt: Date;
  date: string;
  createdAt: Date;
};

export type CommerceSource = "human" | "agent";

export type AgentStatus = "active" | "inactive";

export type AgentRegistrationSource = "api" | "linked";

export type AgentWallet = {
  id: string;
  networkId: string;
  address: string;
  addedAt: Date;
  verifiedAt?: Date;
  verificationMethod?: "eip191" | "solana";
};

export type AgentDoc = {
  _id: ObjectId;
  workspaceId: ObjectId;
  externalAgentId: string;
  publicId: string;
  name?: string;
  walletAddress?: string;
  networkId?: string;
  wallets?: AgentWallet[];
  status: AgentStatus;
  linksCreated: number;
  amountPaid: number;
  amountReceived: number;
  /** In-flight link create exposure (released after insert or on failure). */
  linkExposureHoldUsd?: number;
  registrationSource?: AgentRegistrationSource;
  platform?: string;
  linkedAt?: Date;
  linkSessionId?: string;
  defaultPayerWalletId?: string;
  registeredAt: Date;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ApiKeyType = "workspace" | "admin" | "agent";
export type ApiKeyEnvironment = "live" | "test";

export type ApiKeyDoc = {
  _id: ObjectId;
  workspaceId: ObjectId;
  createdBy: ObjectId;
  keyHash: string;
  keyPrefix: string;
  keyLast4: string;
  keyType?: ApiKeyType;
  environment?: ApiKeyEnvironment;
  permissions?: string[];
  agentId?: ObjectId;
  name?: string;
  /** Temporary storage until first poll delivery; never returned after delivery. */
  plaintextKey?: string;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
};
