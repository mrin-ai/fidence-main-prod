"use client";

import { Keypair } from "@solana/web3.js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { evmWalletNetworks } from "@/lib/evm-networks";
import { sealSpendingWalletSecret } from "@/lib/pay/agent-wallet-crypto";
import type { PendingSpendingWallet } from "@/lib/pay/spending-wallet-types";

const STORAGE_PREFIX = "fidence:spending-wallets:";

export type GeneratedSpendingWallets = {
  evmAddress: string;
  solanaAddress: string;
  evmPrivateKey: `0x${string}`;
  solanaSecretKey: Uint8Array;
};

export function getSpendingWalletNetworks() {
  return [
    ...evmWalletNetworks.map((network) => network.id),
    "solana",
  ] as const;
}

export function generateSpendingWallets(): GeneratedSpendingWallets {
  const evmPrivateKey = generatePrivateKey();
  const evmAddress = privateKeyToAccount(evmPrivateKey).address;
  const solanaKeypair = Keypair.generate();

  return {
    evmAddress,
    solanaAddress: solanaKeypair.publicKey.toBase58(),
    evmPrivateKey,
    solanaSecretKey: solanaKeypair.secretKey,
  };
}

export function buildSpendingWalletApprovePayload(input: {
  generated: GeneratedSpendingWallets;
  recipientPublicKeyB64: string;
}): PendingSpendingWallet[] {
  const evmSecretBytes = hexToBytes(input.generated.evmPrivateKey);

  const wallets: PendingSpendingWallet[] = [];
  for (const networkId of evmWalletNetworks.map((network) => network.id)) {
    const sealed =
      networkId === evmWalletNetworks[0]?.id
        ? sealSpendingWalletSecret({
            recipientPublicKeyB64: input.recipientPublicKeyB64,
            secretBytes: evmSecretBytes,
          })
        : null;
    wallets.push({
      networkId,
      address: input.generated.evmAddress,
      sealedSecret: sealed?.sealedSecret ?? "",
      nonce: sealed?.nonce ?? "",
      ephemeralPublicKey: sealed?.ephemeralPublicKey ?? "",
    });
  }

  const solanaSealed = sealSpendingWalletSecret({
    recipientPublicKeyB64: input.recipientPublicKeyB64,
    secretBytes: input.generated.solanaSecretKey,
  });

  wallets.push({
    networkId: "solana",
    address: input.generated.solanaAddress,
    sealedSecret: solanaSealed.sealedSecret,
    nonce: solanaSealed.nonce,
    ephemeralPublicKey: solanaSealed.ephemeralPublicKey,
  });

  return wallets;
}

export function saveGeneratedWalletsToSession(linkId: string, generated: GeneratedSpendingWallets) {
  if (typeof window === "undefined") return;
  const payload = {
    evmAddress: generated.evmAddress,
    solanaAddress: generated.solanaAddress,
    evmPrivateKey: generated.evmPrivateKey,
    solanaSecretKey: Array.from(generated.solanaSecretKey),
  };
  window.sessionStorage.setItem(`${STORAGE_PREFIX}${linkId}`, JSON.stringify(payload));
}

export function loadGeneratedWalletsFromSession(linkId: string): GeneratedSpendingWallets | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${linkId}`);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      evmAddress: string;
      solanaAddress: string;
      evmPrivateKey: `0x${string}`;
      solanaSecretKey: number[];
    };
    return {
      evmAddress: parsed.evmAddress,
      solanaAddress: parsed.solanaAddress,
      evmPrivateKey: parsed.evmPrivateKey,
      solanaSecretKey: Uint8Array.from(parsed.solanaSecretKey),
    };
  } catch {
    return null;
  }
}

export function clearGeneratedWalletsFromSession(linkId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`${STORAGE_PREFIX}${linkId}`);
}

function hexToBytes(hex: string) {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
