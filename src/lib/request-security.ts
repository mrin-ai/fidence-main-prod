import { getClientIp } from "@/lib/rate-limit";
import type { SecurityContext } from "@/lib/db/merchant-types";

function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function parseBrowser(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("chrome/") && !ua.includes("chromium")) return "Chrome";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  if (ua.includes("curl/")) return "cURL";
  if (ua.includes("postman")) return "Postman";
  return "Unknown";
}

function parseDevice(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android")) {
    return "Mobile";
  }
  if (ua.includes("ipad") || ua.includes("tablet")) {
    return "Tablet";
  }
  if (ua.includes("bot") || ua.includes("agent")) {
    return "Bot";
  }
  return "Desktop";
}

export function extractSecurityContext(
  request: Request,
  timestamp = new Date(),
): SecurityContext {
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const country =
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("x-country") ??
    undefined;

  return {
    ip: getClientIp(request),
    userAgent,
    device: parseDevice(userAgent),
    browser: parseBrowser(userAgent),
    country: country && country !== "XX" ? country : undefined,
    timestamp,
    date: utcDateKey(timestamp),
  };
}

export function extractClientSecurityContext(input?: {
  userAgent?: string;
  country?: string;
}) {
  const timestamp = new Date();
  const userAgent = input?.userAgent ?? "unknown";

  return {
    ip: "client",
    userAgent,
    device: parseDevice(userAgent),
    browser: parseBrowser(userAgent),
    country: input?.country,
    timestamp,
    date: utcDateKey(timestamp),
  } satisfies SecurityContext;
}
