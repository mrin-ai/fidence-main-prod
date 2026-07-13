export const AUTH_COOKIE = "lcx-auth";
export const REFERRAL_COOKIE = "lcx-ref";
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function buildSignInMessage(address: string, timestamp: number) {
  return `Sign in to PayAgent\n\nWallet: ${address}\nTimestamp: ${timestamp}`;
}

export function normalizeEvmWalletAddress(address: string) {
  return address.trim().toLowerCase();
}

export function buildWalletVerifyMessage(
  address: string,
  networkId: string,
  timestamp: number,
) {
  return `Verify wallet for PayAgent\n\nNetwork: ${networkId}\nWallet: ${address}\nTimestamp: ${timestamp}`;
}

export function parseWalletVerifyTimestamp(message: string): number | null {
  const match = message.match(/Timestamp:\s*(\d+)/);
  if (!match) return null;
  const timestamp = Number(match[1]);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function parseWalletVerifyFields(message: string) {
  if (!message.startsWith("Verify wallet for PayAgent")) {
    return null;
  }

  const networkMatch = message.match(/Network:\s*(\S+)/);
  const timestamp = parseWalletVerifyTimestamp(message);

  if (!networkMatch || timestamp == null) {
    return null;
  }

  const networkId = networkMatch[1];
  const walletMatch =
    networkId === "solana"
      ? message.match(/Wallet:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/)
      : message.match(/Wallet:\s*(0x[a-fA-F0-9]{40})/);

  if (!walletMatch) {
    return null;
  }

  return {
    networkId,
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
