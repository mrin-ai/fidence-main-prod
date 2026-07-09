const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function isValidSolanaAddress(address: string) {
  const trimmed = address.trim();
  return trimmed.length >= 32 && trimmed.length <= 44 && BASE58_REGEX.test(trimmed);
}

export function buildSolanaVerifyMessage(
  address: string,
  networkId: string,
  timestamp: number,
) {
  return `Verify wallet for Fidence\n\nNetwork: ${networkId}\nWallet: ${address}\nTimestamp: ${timestamp}`;
}

export function verifySolanaSignature(_input: {
  address: string;
  message: string;
  signature: string;
}) {
  return {
    ok: false as const,
    error: "Solana verification is coming soon",
  };
}
