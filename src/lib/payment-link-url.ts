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
  "onboarding",
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

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function normalizeLocalOrigin(origin: string) {
  try {
    const url = new URL(origin);
    if (url.hostname === "127.0.0.1") {
      url.hostname = "localhost";
    }
    return url.origin.replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

/** Base URL for agent connect links — prefers configured domain in prod, request origin locally. */
export function getPayConnectBaseUrl(requestOrigin?: string) {
  const configured =
    process.env.NEXT_PUBLIC_PAYMENT_DOMAIN ??
    process.env.NEXT_PUBLIC_APP_URL;

  if (configured) {
    try {
      const configuredUrl = new URL(configured);
      const originUrl = requestOrigin ? new URL(requestOrigin) : null;
      if (
        originUrl &&
        isLocalHostname(configuredUrl.hostname) &&
        isLocalHostname(originUrl.hostname) &&
        configuredUrl.port !== originUrl.port
      ) {
        return normalizeLocalOrigin(requestOrigin) ?? getPaymentBaseUrl(requestOrigin);
      }
      if (!isLocalHostname(configuredUrl.hostname)) {
        return configured.replace(/\/$/, "");
      }
    } catch {
      return configured.replace(/\/$/, "");
    }
    return configured.replace(/\/$/, "");
  }

  if (requestOrigin) {
    return normalizeLocalOrigin(requestOrigin) ?? requestOrigin.replace(/\/$/, "");
  }

  return getPaymentBaseUrl();
}

export function buildPayConnectPath(linkId: string) {
  return `/pay/connect?lid=${encodeURIComponent(linkId)}`;
}

export function buildPayConnectUrl(linkId: string, requestOrigin?: string) {
  return `${getPayConnectBaseUrl(requestOrigin)}${buildPayConnectPath(linkId)}`;
}

export function isReservedPaymentPathSegment(segment: string) {
  return RESERVED_PATHS.has(segment.toLowerCase());
}
