export const AUTH_COOKIE = "lcx-auth";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function buildSignInMessage(address: string, timestamp: number) {
  return `Sign in to LCX\n\nWallet: ${address}\nTimestamp: ${timestamp}`;
}

export function normalizeEvmWalletAddress(address: string) {
  return address.trim().toLowerCase();
}

export function buildWalletVerifyMessage(
  address: string,
  networkId: string,
  timestamp: number,
) {
  return `Verify wallet for Fidence\n\nNetwork: ${networkId}\nWallet: ${address}\nTimestamp: ${timestamp}`;
}

export function parseWalletVerifyTimestamp(message: string): number | null {
  const match = message.match(/Timestamp:\s*(\d+)/);
  if (!match) return null;
  const timestamp = Number(match[1]);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function parseWalletVerifyFields(message: string) {
  if (!message.startsWith("Verify wallet for Fidence")) {
    return null;
  }

  const networkMatch = message.match(/Network:\s*(\S+)/);
  const walletMatch = message.match(/Wallet:\s*(0x[a-fA-F0-9]{40})/);
  const timestamp = parseWalletVerifyTimestamp(message);

  if (!networkMatch || !walletMatch || timestamp == null) {
    return null;
  }

  return {
    networkId: networkMatch[1],
    address: walletMatch[1],
    timestamp,
  };
}

export const WALLET_VERIFY_MAX_AGE_MS = 5 * 60 * 1000;

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
