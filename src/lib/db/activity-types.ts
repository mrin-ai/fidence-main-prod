import type { ActivityStatus } from "@/lib/db/types";

export const ACTIVITY_EVENT_TYPES = {
  login: "login",
  logout: "logout",
  paymentLinkCreated: "payment_link_created",
  paymentReceived: "payment_received",
  invoiceCreated: "invoice_created",
} as const;

export type ActivityEventType =
  | (typeof ACTIVITY_EVENT_TYPES)[keyof typeof ACTIVITY_EVENT_TYPES]
  | "agent_spend"
  | "blocked"
  | "approval"
  | "wallet_funded";

export function loginActivitySummary(method: "google" | "wallet") {
  return method === "google" ? "Logged in via Google" : "Logged in via wallet";
}

export function paymentLinkCreatedSummary(amount: number, tokenSymbol: string) {
  return `Payment link created · ${amount} ${tokenSymbol}`;
}

export function paymentReceivedSummary(amount: number, tokenSymbol: string) {
  return `Payment received · ${amount} ${tokenSymbol}`;
}

export function invoiceCreatedSummary(reference: string) {
  return `Invoice created · ${reference}`;
}

export type ActivityLogInput = {
  workspaceId: import("mongodb").ObjectId;
  type: ActivityEventType;
  summary: string;
  status?: ActivityStatus;
  occurredAt?: Date;
};
