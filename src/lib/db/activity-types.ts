import type { ActivityStatus } from "@/lib/db/types";

export const ACTIVITY_EVENT_TYPES = {
  login: "login",
  logout: "logout",
  paymentLinkCreated: "payment_link_created",
  invoicePaymentLinkCreated: "invoice_payment_link_created",
  paymentReceived: "payment_received",
  paymentSent: "payment_sent",
  profilePayment: "profile_payment",
  invoiceCreated: "invoice_created",
  invoiceUpdated: "invoice_updated",
  invoiceSent: "invoice_sent",
  invoicePaid: "invoice_paid",
  invoiceDeleted: "invoice_deleted",
  walletVerified: "wallet_verified",
  walletRemoved: "wallet_removed",
  usernameUpdated: "username_updated",
  profileUpdated: "profile_updated",
  agentRegistered: "agent_registered",
  agentEnabled: "agent_enabled",
  agentDisabled: "agent_disabled",
  agentLinkCreated: "agent_link_created",
  agentPaymentSent: "agent_payment_sent",
  agentPaymentReceived: "agent_payment_received",
  apiKeyRotated: "api_key_rotated",
  agentConnected: "agent_connected",
  agentDisconnected: "agent_disconnected",
  agentLinkExpired: "agent_link_expired",
  savedAddressCreated: "saved_address_created",
  savedAddressUpdated: "saved_address_updated",
  savedAddressDeleted: "saved_address_deleted",
  paymentIntentCreated: "payment_intent_created",
  paymentIntentApproved: "payment_intent_approved",
  paymentIntentRejected: "payment_intent_rejected",
} as const;

export type ActivityEventType =
  | (typeof ACTIVITY_EVENT_TYPES)[keyof typeof ACTIVITY_EVENT_TYPES]
  | "agent_spend"
  | "blocked"
  | "approval"
  | "wallet_funded"
  | "payment_sent"
  | "agent_connected"
  | "agent_disconnected"
  | "agent_link_expired"
  | "saved_address_created"
  | "saved_address_updated"
  | "saved_address_deleted"
  | "payment_intent_created"
  | "payment_intent_approved"
  | "payment_intent_rejected";

export type ActivityLogInput = {
  workspaceId: import("mongodb").ObjectId;
  type: ActivityEventType;
  summary: string;
  status?: ActivityStatus;
  occurredAt?: Date;
};
