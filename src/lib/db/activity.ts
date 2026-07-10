import type { ObjectId } from "mongodb";

import type { ActivityLogInput } from "@/lib/db/activity-types";
import {
  drainActivityQueue,
  enqueueActivity,
  writeActivityDirect,
} from "@/lib/db/activity-queue";

export async function logActivity(input: ActivityLogInput) {
  try {
    await enqueueActivity(input);
    await drainActivityQueue(50);
    return null;
  } catch {
    return writeActivityDirect(input);
  }
}

export async function logLoginActivity(
  workspaceId: ObjectId,
  method: "google" | "wallet",
) {
  const summary =
    method === "google" ? "Logged in via Google" : "Logged in via wallet";

  return writeActivityDirect({
    workspaceId,
    type: "login",
    summary,
  });
}

export async function logLogoutActivity(workspaceId: ObjectId) {
  return writeActivityDirect({
    workspaceId,
    type: "logout",
    summary: "Logged out",
  });
}

export async function logPaymentLinkCreatedActivity(input: {
  workspaceId: ObjectId;
  amount: number;
  tokenSymbol: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "payment_link_created",
    summary: `Payment link created · ${input.amount} ${input.tokenSymbol}`,
  });
}

export async function logInvoicePaymentLinkCreatedActivity(input: {
  workspaceId: ObjectId;
  reference: string;
  amount: number;
  tokenSymbol: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "invoice_payment_link_created",
    summary: `Invoice payment link created · ${input.reference} · ${input.amount} ${input.tokenSymbol}`,
  });
}

export async function logInvoicePaymentLinkUpdatedActivity(input: {
  workspaceId: ObjectId;
  reference: string;
  amount: number;
  tokenSymbol: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "invoice_updated",
    summary: `Invoice payment link updated · ${input.reference} · ${input.amount} ${input.tokenSymbol}`,
  });
}

export async function logPaymentReceivedActivity(input: {
  workspaceId: ObjectId;
  amount: number;
  tokenSymbol: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "payment_received",
    summary: `Payment received · ${input.amount} ${input.tokenSymbol}`,
    status: "settled",
  });
}

export async function logPaymentSentActivity(input: {
  workspaceId: ObjectId;
  amount: number;
  tokenSymbol: string;
  merchantLabel: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "payment_sent",
    summary: `Payment sent · ${input.amount} ${input.tokenSymbol} · ${input.merchantLabel}`,
    status: "settled",
  });
}

export async function logProfilePaymentReceivedActivity(input: {
  workspaceId: ObjectId;
  amount: number;
  tokenSymbol: string;
  username: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "profile_payment",
    summary: `Profile payment received · ${input.amount} ${input.tokenSymbol} · @${input.username}`,
    status: "settled",
  });
}

export async function logInvoiceCreatedActivity(input: {
  workspaceId: ObjectId;
  reference: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "invoice_created",
    summary: `Invoice created · ${input.reference}`,
  });
}

export async function logInvoiceSentActivity(input: {
  workspaceId: ObjectId;
  reference: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "invoice_sent",
    summary: `Invoice sent · ${input.reference}`,
  });
}

export async function logInvoiceUpdatedActivity(input: {
  workspaceId: ObjectId;
  reference: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "invoice_updated",
    summary: `Invoice updated · ${input.reference}`,
  });
}

export async function logInvoicePaidActivity(input: {
  workspaceId: ObjectId;
  reference: string;
  amount: number;
  tokenSymbol: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "invoice_paid",
    summary: `Invoice paid · ${input.reference} · ${input.amount} ${input.tokenSymbol}`,
    status: "settled",
  });
}

export async function logInvoiceDeletedActivity(input: {
  workspaceId: ObjectId;
  reference: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "invoice_deleted",
    summary: `Invoice deleted · ${input.reference}`,
  });
}

export async function logWalletVerifiedActivity(input: {
  workspaceId: ObjectId;
  networkLabel: string;
  address: string;
}) {
  const shortAddress = `${input.address.slice(0, 6)}…${input.address.slice(-4)}`;
  return logActivity({
    workspaceId: input.workspaceId,
    type: "wallet_verified",
    summary: `Wallet verified · ${input.networkLabel} · ${shortAddress}`,
  });
}

export async function logWalletRemovedActivity(input: {
  workspaceId: ObjectId;
  networkLabel: string;
  address: string;
}) {
  const shortAddress = `${input.address.slice(0, 6)}…${input.address.slice(-4)}`;
  return logActivity({
    workspaceId: input.workspaceId,
    type: "wallet_removed",
    summary: `Wallet removed · ${input.networkLabel} · ${shortAddress}`,
  });
}

export async function logUsernameUpdatedActivity(input: {
  workspaceId: ObjectId;
  username: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "username_updated",
    summary: `Username updated · @${input.username}`,
  });
}

export async function logProfileUpdatedActivity(workspaceId: ObjectId) {
  return logActivity({
    workspaceId,
    type: "profile_updated",
    summary: "Profile details updated",
  });
}
