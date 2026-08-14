import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { Keypair } from "@solana/web3.js";

import { bytesToHex, openSpendingWalletSecret } from "./agent-wallet-crypto.js";

export type StoredAgentWallet = {
  networkId: string;
  address: string;
  keyType: "evm" | "solana";
  ciphertext: string;
  iv: string;
  tag: string;
};

type AgentWalletsFile = {
  agents: Record<
    string,
    {
      wallets: StoredAgentWallet[];
    }
  >;
};

export type LoadedAgentWallet =
  | { keyType: "evm"; networkId: string; address: `0x${string}`; privateKey: `0x${string}` }
  | { keyType: "solana"; networkId: "solana"; address: string; secretKey: Uint8Array };

function getAgentWalletsPath() {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return `${home}/.fidence/agent-wallets.json`;
}

function deriveStorageKey(linkSecretKeyB64: string) {
  return createHash("sha256").update(linkSecretKeyB64).digest();
}

function encryptAtRest(plaintext: string, linkSecretKeyB64: string) {
  const key = deriveStorageKey(linkSecretKeyB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

function decryptAtRest(stored: StoredAgentWallet, linkSecretKeyB64: string) {
  const key = deriveStorageKey(linkSecretKeyB64);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(stored.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(stored.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(stored.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function readAgentWalletsFile(): AgentWalletsFile {
  try {
    return JSON.parse(readFileSync(getAgentWalletsPath(), "utf8")) as AgentWalletsFile;
  } catch {
    return { agents: {} };
  }
}

function writeAgentWalletsFileAtomic(file: AgentWalletsFile) {
  const path = getAgentWalletsPath();
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = join(dirname(path), `.agent-wallets.${process.pid}.tmp`);
  writeFileSync(tempPath, JSON.stringify(file, null, 2), { mode: 0o600 });
  renameSync(tempPath, path);
  try {
    chmodSync(path, 0o600);
  } catch {
    // Best effort.
  }
}

export function saveAgentWalletsFromPoll(input: {
  agentId: string;
  linkSecretKeyB64: string;
  spendingWallets: Array<{
    networkId: string;
    address: string;
    sealedSecret: string;
    nonce: string;
    ephemeralPublicKey: string;
  }>;
}) {
  const evmEntry = input.spendingWallets.find(
    (wallet) => wallet.sealedSecret && wallet.networkId !== "solana",
  );
  const solanaEntry = input.spendingWallets.find(
    (wallet) => wallet.networkId === "solana" && wallet.sealedSecret,
  );

  if (!evmEntry || !solanaEntry) {
    throw new Error("Poll response missing EVM or Solana spending wallet secrets");
  }

  const decryptArgs = (entry: (typeof input.spendingWallets)[number]) => ({
    secretKeyB64: input.linkSecretKeyB64,
    sealedSecretB64: entry.sealedSecret,
    nonceB64: entry.nonce,
    ephemeralPublicKeyB64: entry.ephemeralPublicKey,
  });

  const evmSecret = openSpendingWalletSecret(decryptArgs(evmEntry));
  const evmPrivateKey = bytesToHex(evmSecret);
  const evmAddress = privateKeyToAccount(evmPrivateKey).address;
  if (evmAddress.toLowerCase() !== evmEntry.address.toLowerCase()) {
    throw new Error("EVM spending wallet address mismatch after decrypt");
  }

  const solanaSecret = openSpendingWalletSecret(decryptArgs(solanaEntry));
  const solanaKeypair = Keypair.fromSecretKey(solanaSecret);
  if (solanaKeypair.publicKey.toBase58() !== solanaEntry.address) {
    throw new Error("Solana spending wallet address mismatch after decrypt");
  }

  const stored: StoredAgentWallet[] = [];

  for (const wallet of input.spendingWallets) {
    const keyType = wallet.networkId === "solana" ? "solana" : "evm";
    const secretPayload =
      keyType === "solana"
        ? Buffer.from(solanaSecret).toString("base64")
        : evmPrivateKey;
    const encrypted = encryptAtRest(secretPayload, input.linkSecretKeyB64);
    stored.push({
      networkId: wallet.networkId,
      address: wallet.address,
      keyType,
      ...encrypted,
    });
  }

  const file = readAgentWalletsFile();
  file.agents[input.agentId] = { wallets: stored };
  writeAgentWalletsFileAtomic(file);
}

export function loadAgentWallet(input: {
  agentId: string;
  networkId: string;
  linkSecretKeyB64: string;
}): LoadedAgentWallet | null {
  const file = readAgentWalletsFile();
  const entry = file.agents[input.agentId];
  if (!entry) return null;

  const stored =
    entry.wallets.find((wallet) => wallet.networkId === input.networkId) ??
    (input.networkId !== "solana"
      ? entry.wallets.find((wallet) => wallet.keyType === "evm")
      : undefined);

  if (!stored) return null;

  const plaintext = decryptAtRest(stored, input.linkSecretKeyB64);
  if (stored.keyType === "solana") {
    return {
      keyType: "solana",
      networkId: "solana",
      address: stored.address,
      secretKey: Buffer.from(plaintext, "base64"),
    };
  }

  return {
    keyType: "evm",
    networkId: stored.networkId,
    address: stored.address as `0x${string}`,
    privateKey: plaintext as `0x${string}`,
  };
}

export function removeAgentWallets(agentId: string) {
  const file = readAgentWalletsFile();
  if (!file.agents[agentId]) return;
  delete file.agents[agentId];
  writeAgentWalletsFileAtomic(file);
}

export function listAgentWalletAddresses(agentId: string) {
  const file = readAgentWalletsFile();
  return file.agents[agentId]?.wallets.map((wallet) => ({
    networkId: wallet.networkId,
    address: wallet.address,
  }));
}

export function hasAgentWallets(agentId: string) {
  return Boolean(readAgentWalletsFile().agents[agentId]?.wallets.length);
}
