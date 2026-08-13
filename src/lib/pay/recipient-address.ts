import { getAddress, isAddress } from "viem";

import { isSolanaNetwork, normalizePaymentAddress } from "@/lib/payment/normalize";

function normalizeEvmRecipientAddress(address: string, networkId: string) {
  try {
    return normalizePaymentAddress(getAddress(address), networkId);
  } catch {
    return normalizePaymentAddress(address.trim().toLowerCase(), networkId);
  }
}

export function validateRecipientAddress(address: string, networkId: string) {
  const trimmed = address.trim();
  if (!trimmed) {
    return { ok: false as const, error: "Recipient address is required" };
  }

  if (isSolanaNetwork(networkId)) {
    if (trimmed.length < 32 || trimmed.length > 44) {
      return { ok: false as const, error: "Invalid Solana recipient address" };
    }
    return { ok: true as const, address: trimmed };
  }

  if (!isAddress(trimmed)) {
    return { ok: false as const, error: "Invalid EVM recipient address" };
  }

  return {
    ok: true as const,
    address: normalizeEvmRecipientAddress(trimmed, networkId),
  };
}
