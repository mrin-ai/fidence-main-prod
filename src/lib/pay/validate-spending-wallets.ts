import { isSupportedEvmWalletNetworkId } from "@/lib/evm-networks";
import { normalizePaymentAddress } from "@/lib/payment/normalize";
import type { PendingSpendingWallet } from "@/lib/pay/spending-wallet-types";
import {
  MAX_SEALED_SECRET_LENGTH,
  MAX_SPENDING_WALLETS_PER_CONNECT,
} from "@/lib/pay/spending-wallet-types";
import { isSupportedWalletNetworkId } from "@/lib/wallet-networks";
import { validateRecipientAddress } from "@/lib/pay/recipient-address";

export function validateSpendingWalletsPayload(
  spendingWallets: PendingSpendingWallet[] | undefined,
): { ok: true; wallets: PendingSpendingWallet[] } | { ok: false; error: string } {
  if (!spendingWallets?.length) {
    return { ok: false, error: "spendingWallets are required for agent connect approval" };
  }

  if (spendingWallets.length > MAX_SPENDING_WALLETS_PER_CONNECT) {
    return { ok: false, error: `Maximum ${MAX_SPENDING_WALLETS_PER_CONNECT} spending wallets allowed` };
  }

  const seenNetworks = new Set<string>();
  let hasEvm = false;
  let hasSolana = false;
  let evmSealedCount = 0;
  let solanaSealedCount = 0;

  for (const wallet of spendingWallets) {
    const networkId = wallet.networkId?.trim();
    const address = wallet.address?.trim();
    const sealedSecret = wallet.sealedSecret?.trim() ?? "";

    if (!networkId || !address) {
      return { ok: false, error: "Each spending wallet requires networkId and address" };
    }

    if (!isSupportedWalletNetworkId(networkId)) {
      return { ok: false, error: `Unsupported network: ${networkId}` };
    }

    if (seenNetworks.has(networkId)) {
      return { ok: false, error: `Duplicate network in spending wallets: ${networkId}` };
    }
    seenNetworks.add(networkId);

    const addressCheck = validateRecipientAddress(address, networkId);
    if (!addressCheck.ok) {
      return { ok: false, error: addressCheck.error ?? `Invalid address for ${networkId}` };
    }

    const normalized = normalizePaymentAddress(address, networkId);

    if (networkId === "solana") {
      hasSolana = true;
    if (!sealedSecret) {
      return { ok: false, error: "Solana spending wallet requires sealedSecret" };
    }
    if (!wallet.nonce?.trim() || !wallet.ephemeralPublicKey?.trim()) {
      return { ok: false, error: "Solana spending wallet requires nonce and ephemeralPublicKey" };
    }
      solanaSealedCount += 1;
    } else if (isSupportedEvmWalletNetworkId(networkId)) {
      hasEvm = true;
      if (sealedSecret) {
        evmSealedCount += 1;
        if (!wallet.nonce?.trim() || !wallet.ephemeralPublicKey?.trim()) {
          return {
            ok: false,
            error: "EVM spending wallet entry with sealedSecret requires nonce and ephemeralPublicKey",
          };
        }
      }
    }

    if (sealedSecret.length > MAX_SEALED_SECRET_LENGTH) {
      return { ok: false, error: "sealedSecret exceeds maximum length" };
    }

    wallet.networkId = networkId;
    wallet.address = normalized;
    wallet.sealedSecret = sealedSecret;
  }

  if (!hasEvm || !hasSolana) {
    return { ok: false, error: "Spending wallets must include at least one EVM network and Solana" };
  }

  if (evmSealedCount !== 1) {
    return { ok: false, error: "Exactly one EVM spending wallet entry must include sealedSecret" };
  }

  if (solanaSealedCount !== 1) {
    return { ok: false, error: "Solana spending wallet must include sealedSecret" };
  }

  return { ok: true, wallets: spendingWallets };
}

export function pickDefaultPayerWalletId(
  wallets: Array<{ id: string; networkId: string }>,
) {
  const priority = ["ethereum", "base", "sepolia", "solana"];
  for (const networkId of priority) {
    const match = wallets.find((wallet) => wallet.networkId === networkId);
    if (match) return match.id;
  }
  return wallets[0]?.id;
}
