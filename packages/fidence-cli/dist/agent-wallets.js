import { createCipheriv, createDecipheriv, createHash, randomBytes, } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { Keypair } from "@solana/web3.js";
import { bytesToHex, openSpendingWalletSecret } from "./agent-wallet-crypto.js";
function getAgentWalletsPath() {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
    return `${home}/.fidence/agent-wallets.json`;
}
function deriveStorageKey(linkSecretKeyB64) {
    return createHash("sha256").update(linkSecretKeyB64).digest();
}
function encryptAtRest(plaintext, linkSecretKeyB64) {
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
function decryptAtRest(stored, linkSecretKeyB64) {
    const key = deriveStorageKey(linkSecretKeyB64);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(stored.iv, "base64"));
    decipher.setAuthTag(Buffer.from(stored.tag, "base64"));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(stored.ciphertext, "base64")),
        decipher.final(),
    ]);
    return decrypted.toString("utf8");
}
function readAgentWalletsFile() {
    try {
        return JSON.parse(readFileSync(getAgentWalletsPath(), "utf8"));
    }
    catch {
        return { agents: {} };
    }
}
function writeAgentWalletsFileAtomic(file) {
    const path = getAgentWalletsPath();
    mkdirSync(dirname(path), { recursive: true });
    const tempPath = join(dirname(path), `.agent-wallets.${process.pid}.tmp`);
    writeFileSync(tempPath, JSON.stringify(file, null, 2), { mode: 0o600 });
    renameSync(tempPath, path);
    try {
        chmodSync(path, 0o600);
    }
    catch {
        // Best effort.
    }
}
export function saveAgentWalletsFromPoll(input) {
    const evmEntry = input.spendingWallets.find((wallet) => wallet.sealedSecret && wallet.networkId !== "solana");
    const solanaEntry = input.spendingWallets.find((wallet) => wallet.networkId === "solana" && wallet.sealedSecret);
    if (!evmEntry || !solanaEntry) {
        throw new Error("Poll response missing EVM or Solana spending wallet secrets");
    }
    const decryptArgs = (entry) => ({
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
    const stored = [];
    for (const wallet of input.spendingWallets) {
        const keyType = wallet.networkId === "solana" ? "solana" : "evm";
        const secretPayload = keyType === "solana"
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
export function loadAgentWallet(input) {
    const file = readAgentWalletsFile();
    const entry = file.agents[input.agentId];
    if (!entry)
        return null;
    const stored = entry.wallets.find((wallet) => wallet.networkId === input.networkId) ??
        (input.networkId !== "solana"
            ? entry.wallets.find((wallet) => wallet.keyType === "evm")
            : undefined);
    if (!stored)
        return null;
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
        address: stored.address,
        privateKey: plaintext,
    };
}
export function removeAgentWallets(agentId) {
    const file = readAgentWalletsFile();
    if (!file.agents[agentId])
        return;
    delete file.agents[agentId];
    writeAgentWalletsFileAtomic(file);
}
export function listAgentWalletAddresses(agentId) {
    const file = readAgentWalletsFile();
    return file.agents[agentId]?.wallets.map((wallet) => ({
        networkId: wallet.networkId,
        address: wallet.address,
    }));
}
export function hasAgentWallets(agentId) {
    return Boolean(readAgentWalletsFile().agents[agentId]?.wallets.length);
}
