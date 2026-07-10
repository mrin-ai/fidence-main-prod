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
} as const;

export type ActivityEventType =
  | (typeof ACTIVITY_EVENT_TYPES)[keyof typeof ACTIVITY_EVENT_TYPES]
  | "agent_spend"
  | "blocked"
  | "approval"
  | "wallet_funded"
  | "payment_sent";

export type ActivityLogInput = {
  workspaceId: import("mongodb").ObjectId;
  type: ActivityEventType;
  summary: string;
  status?: ActivityStatus;
  occurredAt?: Date;
};
