#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { hasAgentWallets, listAgentWalletAddresses, loadAgentWallet, removeAgentWallets, saveAgentWalletsFromPoll, } from "./agent-wallets.js";
import { sendLocalEvmPayment } from "./evm-pay.js";
import { supportsOnChainPayment } from "./contracts.js";
import { sendLocalSolanaPayment } from "./solana-pay.js";
import { apiFetch, generateKeyPair, getBaseUrl, getConfigPath, sleep } from "./lib.js";
function loadConfig() {
    try {
        return JSON.parse(readFileSync(getConfigPath(), "utf8"));
    }
    catch {
        return {};
    }
}
function saveConfig(config) {
    const path = getConfigPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(config, null, 2), { mode: 0o600 });
    try {
        chmodSync(path, 0o600);
    }
    catch {
        // Best effort.
    }
}
function usage() {
    console.log(`Fidence CLI

Usage:
  fidence setup [--platform NAME] [--name NAME]
  fidence setup poll [--link-id LID]
  fidence status
  fidence preflight [--type link|profile|address] [--username USER] [--to ADDRESS] [--amount N] [--network ID] [--token ID]
  fidence pay --to ADDRESS --amount N --network ID --token ID --auto
  fidence wallet status
  fidence agent disconnect
  fidence clear-intents

Headless auto-pay (agent spending wallet — no MetaMask export):
  1. fidence setup && approve in browser (creates spending wallets)
  2. fidence setup poll
  3. Enable "Automatic payments" on /pay/mandates
  4. fidence pay --auto --to 0x… --amount 10 --network sepolia --token usdt

Environment:
  FIDENCE_BASE_URL  API base (default http://localhost:3000)
  FIDENCE_SEPOLIA_RPC_URL  RPC for EVM signing
  FIDENCE_SOLANA_RPC_URL  RPC for Solana signing
  FIDENCE_RPC_URL  Fallback RPC for all networks
`);
}
async function cmdSetup(args) {
    const platformIdx = args.indexOf("--platform");
    const nameIdx = args.indexOf("--name");
    const platform = platformIdx >= 0 ? args[platformIdx + 1] : "cursor";
    const agentName = nameIdx >= 0 ? args[nameIdx + 1] : "My Agent";
    const keyPair = generateKeyPair();
    const result = await apiFetch("/api/v1/agent-links", {
        method: "POST",
        body: JSON.stringify({ publicKey: keyPair.publicKey, platform, agentName }),
    });
    if (!result.response.ok) {
        console.error("Setup failed:", result.data);
        process.exit(1);
    }
    const body = result.data;
    saveConfig({
        linkId: body.linkId,
        pollSecret: body.pollSecret,
        linkPublicKey: keyPair.publicKey,
        linkSecretKey: keyPair.secretKey,
    });
    const connect = body.connectUrl.startsWith("http")
        ? body.connectUrl
        : `${getBaseUrl()}${body.connectUrl}`;
    console.log("Open this URL in your browser to approve:");
    console.log(connect);
    console.log("\nThen run: fidence setup poll");
}
async function cmdSetupPoll(args) {
    const config = loadConfig();
    const lidIdx = args.indexOf("--link-id");
    const linkId = lidIdx >= 0 ? args[lidIdx + 1] : config.linkId;
    const pollSecret = config.pollSecret;
    if (!linkId || !pollSecret) {
        console.error("Missing link session. Run `fidence setup` first.");
        process.exit(1);
    }
    if (!config.linkSecretKey) {
        console.error("Missing link secret key. Run `fidence setup` again to generate a new link.");
        process.exit(1);
    }
    for (let attempt = 0; attempt < 120; attempt += 1) {
        const result = await apiFetch(`/api/v1/agent-links/${encodeURIComponent(linkId)}`, {
            method: "POST",
            body: JSON.stringify({ pollSecret }),
        });
        const body = result.data;
        if (body.status === "approved") {
            const agentId = body.agent?.externalAgentId ?? config.agentId;
            if (body.apiKey && body.spendingWallets?.length && agentId && config.linkSecretKey) {
                saveAgentWalletsFromPoll({
                    agentId,
                    linkSecretKeyB64: config.linkSecretKey,
                    spendingWallets: body.spendingWallets,
                });
                saveConfig({
                    ...config,
                    apiKey: body.apiKey,
                    agentId,
                    linkId,
                    pollSecret,
                });
                console.log("Agent connected. API key and spending wallets saved locally.");
                return;
            }
            if (config.apiKey && agentId && hasAgentWallets(agentId)) {
                console.log("Agent already connected. Credentials are in ~/.fidence/");
                return;
            }
            if (body.apiKey && !body.spendingWallets?.length) {
                console.error("Link approved but spending wallets were already delivered. Run `fidence setup` again.");
                process.exit(1);
            }
            if (!body.apiKey && config.apiKey) {
                console.log("Agent already connected. Credentials are in ~/.fidence/");
                return;
            }
            console.error("Link is approved but secrets were already delivered. Run `fidence setup` again for a new link.");
            process.exit(1);
        }
        if (body.status === "rejected" || body.status === "expired" || body.status === "cancelled") {
            console.error(`Link session ${body.status}`);
            process.exit(1);
        }
        await sleep(3000);
    }
    console.error("Timed out waiting for approval");
    process.exit(1);
}
async function cmdStatus() {
    const config = loadConfig();
    console.log(JSON.stringify({ baseUrl: getBaseUrl(), ...config, apiKey: config.apiKey ? "***" : undefined }, null, 2));
}
async function cmdPreflight(args) {
    const config = loadConfig();
    if (!config.apiKey) {
        console.error("No scoped API key. Run setup + poll first.");
        process.exit(1);
    }
    const typeArg = args.includes("--type") ? args[args.indexOf("--type") + 1] : undefined;
    const to = args.includes("--to") ? args[args.indexOf("--to") + 1] : undefined;
    const type = typeArg ?? (to ? "address" : "profile");
    const username = args.includes("--username") ? args[args.indexOf("--username") + 1] : "example";
    const amount = args.includes("--amount") ? args[args.indexOf("--amount") + 1] : "1";
    const networkId = args.includes("--network") ? args[args.indexOf("--network") + 1] : "base";
    const tokenId = args.includes("--token") ? args[args.indexOf("--token") + 1] : "usdc";
    const agentId = encodeURIComponent(config.agentId ?? "");
    const loadedWallet = config.agentId && config.linkSecretKey
        ? loadAgentWallet({
            agentId: config.agentId,
            networkId,
            linkSecretKeyB64: config.linkSecretKey,
        })
        : null;
    const payerParam = loadedWallet
        ? `&payerAddress=${encodeURIComponent(loadedWallet.address)}`
        : "";
    let query;
    if (type === "link") {
        query = `type=link&agentId=${agentId}&linkUsername=${encodeURIComponent(username)}&linkId=example&dryRun=1${payerParam}`;
    }
    else if (type === "address") {
        if (!to) {
            console.error("--to ADDRESS is required for type=address");
            process.exit(1);
        }
        query = `type=address&agentId=${agentId}&recipientAddress=${encodeURIComponent(to)}&amount=${amount}&tokenId=${encodeURIComponent(tokenId)}&networkId=${encodeURIComponent(networkId)}&dryRun=1${payerParam}`;
    }
    else {
        query = `type=profile&agentId=${agentId}&recipientUsername=${encodeURIComponent(username)}&amount=${amount}&tokenId=${encodeURIComponent(tokenId)}&networkId=${encodeURIComponent(networkId)}&dryRun=1${payerParam}`;
    }
    const result = await apiFetch(`/api/v1/pay/preflight?${query}`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    console.log(JSON.stringify(result.data, null, 2));
    if (!result.response.ok)
        process.exit(1);
}
async function cmdPayHeadless(args) {
    const config = loadConfig();
    if (!config.apiKey || !config.agentId || !config.linkSecretKey) {
        console.error("No scoped API key or spending wallet. Run setup + poll first.");
        process.exit(1);
    }
    if (!args.includes("--auto")) {
        console.error("Linked agents require explicit --auto for headless pay.");
        process.exit(1);
    }
    const to = args.includes("--to") ? args[args.indexOf("--to") + 1] : undefined;
    if (!to) {
        console.error("--to ADDRESS is required for headless pay");
        process.exit(1);
    }
    const amount = args.includes("--amount") ? Number(args[args.indexOf("--amount") + 1]) : 1;
    const networkId = args.includes("--network") ? args[args.indexOf("--network") + 1] : "base";
    const tokenId = args.includes("--token") ? args[args.indexOf("--token") + 1] : "usdc";
    const agentId = encodeURIComponent(config.agentId);
    if (!supportsOnChainPayment(networkId, tokenId)) {
        console.error(`Unsupported token/network: ${tokenId}/${networkId}`);
        process.exit(1);
    }
    const wallet = loadAgentWallet({
        agentId: config.agentId,
        networkId,
        linkSecretKeyB64: config.linkSecretKey,
    });
    if (!wallet) {
        console.error(`No agent spending wallet for network ${networkId}. Re-run setup poll.`);
        process.exit(1);
    }
    const preflightQuery = `type=address&agentId=${agentId}&recipientAddress=${encodeURIComponent(to)}&amount=${amount}&tokenId=${encodeURIComponent(tokenId)}&networkId=${encodeURIComponent(networkId)}&payerAddress=${encodeURIComponent(wallet.address)}&dryRun=1`;
    const preflight = await apiFetch(`/api/v1/pay/preflight?${preflightQuery}`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!preflight.response.ok) {
        console.error("Preflight failed:", preflight.data);
        process.exit(1);
    }
    const pf = preflight.data;
    if (!pf.autoPayEligible) {
        console.error("Not eligible for headless auto-pay. Enable Automatic payments on /pay/mandates or fund your spending wallet.");
        console.error(JSON.stringify(pf, null, 2));
        process.exit(1);
    }
    console.log(`Sending ${amount} ${tokenId.toUpperCase()} to ${to} on ${networkId}…`);
    const txHash = wallet.keyType === "solana"
        ? await sendLocalSolanaPayment({
            secretKey: wallet.secretKey,
            tokenId,
            recipientAddress: to,
            amount,
        })
        : await sendLocalEvmPayment({
            wallet,
            networkId,
            tokenId,
            recipientAddress: to,
            amount,
        });
    console.log("Transaction confirmed:", txHash);
    const record = await apiFetch("/api/v1/pay", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Idempotency-Key": `cli-pay-${txHash}`,
        },
        body: JSON.stringify({
            agentId: config.agentId,
            payerAddress: wallet.address,
            txHash,
            type: "address",
            recipientAddress: to,
            amount,
            tokenId,
            networkId,
        }),
    });
    if (!record.response.ok) {
        console.error("Payment sent on-chain but recording failed:", record.data);
        console.error("Save tx hash:", txHash);
        process.exit(1);
    }
    console.log(JSON.stringify(record.data, null, 2));
}
async function cmdWalletStatus() {
    const config = loadConfig();
    if (!config.agentId) {
        console.error("No agent connected.");
        process.exit(1);
    }
    const wallets = listAgentWalletAddresses(config.agentId) ?? [];
    console.log(JSON.stringify({
        agentId: config.agentId,
        wallets,
        hint: "Fund these addresses before auto-pay. Enable Automatic payments on /pay/mandates.",
    }, null, 2));
}
async function cmdAgentDisconnect() {
    const config = loadConfig();
    if (config.agentId) {
        removeAgentWallets(config.agentId);
    }
    saveConfig({
        linkId: config.linkId,
        pollSecret: config.pollSecret,
        linkPublicKey: config.linkPublicKey,
        linkSecretKey: config.linkSecretKey,
    });
    console.log("Local agent credentials cleared. Disconnect the agent in the Fidence portal if needed.");
}
async function cmdWalletImport() {
    console.error("wallet import is deprecated.\n" +
        "Reconnect your agent: fidence setup → approve in browser → fidence setup poll");
    process.exit(1);
}
async function cmdPay(args) {
    const config = loadConfig();
    if (!config.apiKey) {
        console.error("No scoped API key.");
        process.exit(1);
    }
    const intentIdx = args.indexOf("--intent-id");
    if (intentIdx >= 0) {
        const intentId = args[intentIdx + 1];
        for (let i = 0; i < 120; i += 1) {
            const poll = await apiFetch(`/api/v1/payment-intents/${intentId}/poll`, {
                headers: { Authorization: `Bearer ${config.apiKey}` },
            });
            const body = poll.data;
            if (body.status && body.status !== "pending") {
                console.log(JSON.stringify(body, null, 2));
                return;
            }
            await sleep(3000);
        }
        process.exit(1);
    }
    const useHeadless = args.includes("--auto") && args.includes("--to");
    if (useHeadless) {
        await cmdPayHeadless(args);
        return;
    }
    if (args.includes("--to") && !args.includes("--auto")) {
        console.error("Linked agents pay via the spending wallet. Use: fidence pay --auto --to ADDRESS ...");
        process.exit(1);
    }
    const amount = args.includes("--amount") ? Number(args[args.indexOf("--amount") + 1]) : 1;
    const networkId = args.includes("--network") ? args[args.indexOf("--network") + 1] : "base";
    const tokenId = args.includes("--token") ? args[args.indexOf("--token") + 1] : "usdc";
    const to = args.includes("--to") ? args[args.indexOf("--to") + 1] : undefined;
    const username = args.includes("--username") ? args[args.indexOf("--username") + 1] : undefined;
    const body = to != null
        ? {
            type: "address",
            recipientAddress: to,
            amount,
            tokenId,
            networkId,
        }
        : {
            type: "profile",
            recipientUsername: username ?? "example",
            amount,
            tokenId,
            networkId,
        };
    const create = await apiFetch("/api/v1/payment-intents", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Idempotency-Key": `cli-${Date.now()}`,
        },
        body: JSON.stringify(body),
    });
    if (!create.response.ok) {
        console.error(create.data);
        process.exit(1);
    }
    const created = create.data;
    const intentId = created.intent?.intentId;
    console.log("Payment intent created:", intentId);
    if (created.autoExecute || created.autoApproved) {
        console.log("Within mandate — confirm in your wallet (Fidence tab open, no approval popup).");
    }
    else {
        console.log("Approve in the Fidence portal, then polling…");
    }
    await cmdPay(["--intent-id", intentId ?? ""]);
}
async function cmdClearIntents() {
    const config = loadConfig();
    if (!config.apiKey) {
        console.error("No scoped API key.");
        process.exit(1);
    }
    const result = await apiFetch("/api/v1/payment-intents/clear", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    console.log(JSON.stringify(result.data, null, 2));
    if (!result.response.ok)
        process.exit(1);
}
async function main() {
    const [, , command, ...commandArgs] = process.argv;
    if (!command || command === "--help" || command === "-h") {
        usage();
        return;
    }
    if (command === "setup" && commandArgs[0] === "poll") {
        await cmdSetupPoll(commandArgs.slice(1));
        return;
    }
    if (command === "setup") {
        await cmdSetup(commandArgs);
        return;
    }
    if (command === "status") {
        await cmdStatus();
        return;
    }
    if (command === "preflight") {
        await cmdPreflight(commandArgs);
        return;
    }
    if (command === "pay") {
        await cmdPay(commandArgs);
        return;
    }
    if (command === "wallet" && commandArgs[0] === "import") {
        await cmdWalletImport();
        return;
    }
    if (command === "wallet" && commandArgs[0] === "status") {
        await cmdWalletStatus();
        return;
    }
    if (command === "agent" && commandArgs[0] === "disconnect") {
        await cmdAgentDisconnect();
        return;
    }
    if (command === "clear-intents") {
        await cmdClearIntents();
        return;
    }
    usage();
    process.exit(1);
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
