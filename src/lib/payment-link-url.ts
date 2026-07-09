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
  "_next",
  "icon.png",
  "favicon.ico",
]);

export function generatePublicId() {
  return randomBytes(6).toString("hex");
}

export function getPaymentBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_PAYMENT_DOMAIN ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  return configured.replace(/\/$/, "");
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
