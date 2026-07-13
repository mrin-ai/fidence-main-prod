import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function isValidSolanaAddress(address: string) {
  const trimmed = address.trim();
  if (trimmed.length < 32 || trimmed.length > 44 || !BASE58_REGEX.test(trimmed)) {
    return false;
  }

  try {
    new PublicKey(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function buildSolanaVerifyMessage(
  address: string,
  networkId: string,
  timestamp: number,
) {
  return `Verify wallet for PayAgent\n\nNetwork: ${networkId}\nWallet: ${address}\nTimestamp: ${timestamp}`;
}

export function verifySolanaSignature(input: {
  address: string;
  message: string;
  signature: string;
}) {
  try {
    if (!isValidSolanaAddress(input.address)) {
      return { ok: false as const, error: "Invalid Solana address" };
    }

    const messageBytes = new TextEncoder().encode(input.message);
    const signatureBytes = bs58.decode(input.signature);
    const publicKeyBytes = new PublicKey(input.address).toBytes();
    const valid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes,
    );

    if (!valid) {
      return { ok: false as const, error: "Invalid signature" };
    }

    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Invalid signature" };
  }
}
