import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
function getWalletPath() {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
    return `${home}/.fidence/wallet.json`;
}
function normalizePrivateKey(value) {
    const trimmed = value.trim();
    return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`);
}
export function loadLocalWallet() {
    const fromEnv = process.env.FIDENCE_WALLET_PRIVATE_KEY?.trim();
    if (fromEnv) {
        const privateKey = normalizePrivateKey(fromEnv);
        const account = privateKeyToAccount(privateKey);
        return { privateKey, address: account.address };
    }
    try {
        const raw = JSON.parse(readFileSync(getWalletPath(), "utf8"));
        if (!raw.privateKey)
            return null;
        const privateKey = normalizePrivateKey(raw.privateKey);
        const account = privateKeyToAccount(privateKey);
        return { privateKey, address: account.address };
    }
    catch {
        return null;
    }
}
export function saveLocalWallet(privateKeyInput) {
    const privateKey = normalizePrivateKey(privateKeyInput);
    const account = privateKeyToAccount(privateKey);
    const path = getWalletPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ address: account.address, privateKey }, null, 2), { mode: 0o600 });
    try {
        chmodSync(path, 0o600);
    }
    catch {
        // Best effort on platforms that support it.
    }
    return account.address;
}
export function hasLocalWallet() {
    return loadLocalWallet() != null;
}
