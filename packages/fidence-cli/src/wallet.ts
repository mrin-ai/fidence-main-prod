import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";

import { privateKeyToAccount } from "viem/accounts";

export type LocalWallet = {
  privateKey: `0x${string}`;
  address: `0x${string}`;
};

function getWalletPath() {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return `${home}/.fidence/wallet.json`;
}

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim();
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as `0x${string}`;
}

export function loadLocalWallet(): LocalWallet | null {
  const fromEnv = process.env.FIDENCE_WALLET_PRIVATE_KEY?.trim();
  if (fromEnv) {
    const privateKey = normalizePrivateKey(fromEnv);
    const account = privateKeyToAccount(privateKey);
    return { privateKey, address: account.address };
  }

  try {
    const raw = JSON.parse(readFileSync(getWalletPath(), "utf8")) as {
      privateKey?: string;
    };
    if (!raw.privateKey) return null;
    const privateKey = normalizePrivateKey(raw.privateKey);
    const account = privateKeyToAccount(privateKey);
    return { privateKey, address: account.address };
  } catch {
    return null;
  }
}

export function saveLocalWallet(privateKeyInput: string) {
  const privateKey = normalizePrivateKey(privateKeyInput);
  const account = privateKeyToAccount(privateKey);
  const path = getWalletPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({ address: account.address, privateKey }, null, 2),
    { mode: 0o600 },
  );
  try {
    chmodSync(path, 0o600);
  } catch {
    // Best effort on platforms that support it.
  }
  return account.address;
}

export function hasLocalWallet() {
  return loadLocalWallet() != null;
}
