import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

function isPrivateOrReservedIpv4(part: number[]) {
  const [a, b] = part;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateOrReservedIpv6(normalized: string) {
  const lower = normalized.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  return false;
}

function hostnameIsBlocked(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost")) return true;
  if (host.endsWith(".local")) return true;
  if (host.endsWith(".internal")) return true;

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const parts = host.split(".").map(Number);
    return isPrivateOrReservedIpv4(parts);
  }
  if (ipVersion === 6) {
    return isPrivateOrReservedIpv6(host);
  }
  return false;
}

export type WebhookUrlValidationResult =
  | { ok: true; url: string }
  | { ok: false; error: string; code: "WEBHOOK_URL_INVALID" | "WEBHOOK_URL_FORBIDDEN" };

/** Reject webhook targets that could SSRF internal networks or cloud metadata. */
export function validateWebhookUrl(raw: string): WebhookUrlValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "url is required", code: "WEBHOOK_URL_INVALID" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "url must be a valid URL", code: "WEBHOOK_URL_INVALID" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      ok: false,
      error: "Webhook URL must use http or https",
      code: "WEBHOOK_URL_FORBIDDEN",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      error: "Webhook URL must not include credentials",
      code: "WEBHOOK_URL_FORBIDDEN",
    };
  }

  if (hostnameIsBlocked(parsed.hostname)) {
    return {
      ok: false,
      error: "Webhook URL must be a public HTTPS endpoint",
      code: "WEBHOOK_URL_FORBIDDEN",
    };
  }

  return { ok: true, url: parsed.toString() };
}
