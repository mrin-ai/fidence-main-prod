import type { PaymentLinkStatus } from "@/lib/db/types";

export const PAYMENT_LINKS_PAGE_SIZE = 10;

export type PaymentLinkFilterStatus = "all" | "pending" | "paid" | "failed";
export type PaymentLinkSort = "newest" | "oldest";

export function getPaymentLinkDisplayStatus(
  status: PaymentLinkStatus,
): "pending" | "paid" | "failed" {
  if (status === "paid") return "paid";
  if (status === "pending") return "pending";
  return "failed";
}

export function matchesPaymentLinkFilter(
  status: PaymentLinkStatus,
  filter: PaymentLinkFilterStatus,
) {
  if (filter === "all") return true;
  return getPaymentLinkDisplayStatus(status) === filter;
}
