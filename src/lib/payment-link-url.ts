import { randomBytes } from "crypto";

const RESERVED_PATHS = new Set([
  "api",
  "dashboard",
  "settings",
  "sign-in",
  "sign-up",
  "wallets",
  "wallet",
  "invoice",
  "invoices",
  "manage-invoices",
  "activity",
  "payment-links",
  "referrals",
  "rewards",
  "transactions",
  "leaderboard",
  "token",
  "about",
  "changelog",
  "docs",
  "blog",
  "merchant",
  "icon.png",
  "favicon.ico",
]);

export function generatePublicId() {
  return randomBytes(6).toString("hex");
}

export function getPaymentBaseUrl(requestOrigin?: string) {
  const configured =
    process.env.NEXT_PUBLIC_PAYMENT_DOMAIN ??
    process.env.NEXT_PUBLIC_APP_URL;

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (requestOrigin) {
    return requestOrigin.replace(/\/$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

export function buildPaymentLinkPath(username: string, publicId: string) {
  return `/${username}/${publicId}`;
}

export function buildPaymentLinkUrl(username: string, publicId: string) {
  return `${getPaymentBaseUrl()}${buildPaymentLinkPath(username, publicId)}`;
}

export function isReservedPaymentPathSegment(segment: string) {
  return RESERVED_PATHS.has(segment.toLowerCase());
}
