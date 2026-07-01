export const AUTH_COOKIE = "lcx-auth";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function buildSignInMessage(address: string, timestamp: number) {
  return `Sign in to LCX\n\nWallet: ${address}\nTimestamp: ${timestamp}`;
}

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
