#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { sendLocalEvmPayment } from "./evm-pay.js";
import { supportsOnChainPayment } from "./contracts.js";
import { apiFetch, generateKeyPair, getBaseUrl, getConfigPath, sleep } from "./lib.js";
import { hasLocalWallet, loadLocalWallet, saveLocalWallet } from "./wallet.js";
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
    writeFileSync(path, JSON.stringify(config, null, 2));
}
function usage() {
    console.log(`Fidence CLI

Usage:
  fidence setup [--platform NAME] [--name NAME]
  fidence setup poll [--link-id LID]
  fidence status
  fidence preflight [--type link|profile|address] [--username USER] [--to ADDRESS] [--amount N] [--network ID] [--token ID]
  fidence pay [--to ADDRESS | --username USER] [--amount N] [--network ID] [--token ID] [--auto] [--intent-id ID]
  fidence wallet import --private-key 0x...
  fidence clear-intents

Headless auto-pay (no browser, no MetaMask popup):
  1. Import the same wallet you verified on Fidence: fidence wallet import --private-key 0x...
  2. Enable "Automatic payments" on /pay/mandates
  3. fidence pay --auto --to 0x… --amount 10 --network sepolia --token usdt

Environment:
  FIDENCE_BASE_URL  API base (default http://localhost:3000)
  FIDENCE_WALLET_PRIVATE_KEY  Optional alternative to wallet import
  FIDENCE_SEPOLIA_RPC_URL  RPC for local signing (recommended)
  FIDENCE_RPC_URL  Fallback RPC for all networks
`);
}
async function cmdSetup(args) {
    const platformIdx = args.indexOf("--platform");
    const nameIdx = args.indexOf("--name");
    const platform = platformIdx >= 0 ? args[platformIdx + 1] : "cursor";
    const agentName = nameIdx >= 0 ? args[nameIdx + 1] : "My Agent";
    const { publicKey } = generateKeyPair();
    const result = await apiFetch("/api/v1/agent-links", {
        method: "POST",
        body: JSON.stringify({ publicKey, platform, agentName }),
    });
    if (!result.response.ok) {
        console.error("Setup failed:", result.data);
        process.exit(1);
    }
    const body = result.data;
    saveConfig({ linkId: body.linkId, pollSecret: body.pollSecret });
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
    for (let attempt = 0; attempt < 120; attempt += 1) {
        const result = await apiFetch(`/api/v1/agent-links/${encodeURIComponent(linkId)}?pollSecret=${encodeURIComponent(pollSecret)}`);
        const body = result.data;
        if (body.status === "approved") {
            if (body.apiKey) {
                saveConfig({
                    ...config,
                    apiKey: body.apiKey,
                    agentId: body.agent?.externalAgentId,
                    linkId,
                    pollSecret,
                });
                console.log("Agent connected. Scoped API key saved to ~/.fidence/config.json");
                return;
            }
            if (config.apiKey) {
                console.log("Agent already connected. Scoped API key is in ~/.fidence/config.json");
                return;
            }
            console.error("Link is approved but the scoped key was already delivered. Run `fidence setup` again for a new link.");
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
    let query;
    if (type === "link") {
        query = `type=link&agentId=${agentId}&linkUsername=${encodeURIComponent(username)}&linkId=example&dryRun=1`;
    }
    else if (type === "address") {
        if (!to) {
            console.error("--to ADDRESS is required for type=address");
            process.exit(1);
        }
        query = `type=address&agentId=${agentId}&recipientAddress=${encodeURIComponent(to)}&amount=${amount}&tokenId=${encodeURIComponent(tokenId)}&networkId=${encodeURIComponent(networkId)}&dryRun=1`;
    }
    else {
        query = `type=profile&agentId=${agentId}&recipientUsername=${encodeURIComponent(username)}&amount=${amount}&tokenId=${encodeURIComponent(tokenId)}&networkId=${encodeURIComponent(networkId)}&dryRun=1`;
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
    if (!config.apiKey) {
        console.error("No scoped API key.");
        process.exit(1);
    }
    const wallet = loadLocalWallet();
    if (!wallet) {
        console.error("Headless pay requires a local wallet.\n" +
            "  fidence wallet import --private-key 0x...\n" +
            "  or set FIDENCE_WALLET_PRIVATE_KEY");
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
    const agentId = encodeURIComponent(config.agentId ?? "");
    if (!supportsOnChainPayment(networkId, tokenId)) {
        console.error(`Unsupported token/network: ${tokenId}/${networkId}`);
        process.exit(1);
    }
    const preflightQuery = `type=address&agentId=${agentId}&recipientAddress=${encodeURIComponent(to)}&amount=${amount}&tokenId=${encodeURIComponent(tokenId)}&networkId=${encodeURIComponent(networkId)}&dryRun=1`;
    const preflight = await apiFetch(`/api/v1/pay/preflight?${preflightQuery}`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!preflight.response.ok) {
        console.error("Preflight failed:", preflight.data);
        process.exit(1);
    }
    const pf = preflight.data;
    if (!pf.autoPayEligible) {
        console.error("Not eligible for headless auto-pay. Enable Automatic payments on /pay/mandates or amount may exceed limits.");
        console.error(JSON.stringify(pf, null, 2));
        process.exit(1);
    }
    console.log(`Sending ${amount} ${tokenId.toUpperCase()} to ${to} on ${networkId}…`);
    const txHash = await sendLocalEvmPayment({
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
async function cmdWalletImport(args) {
    const keyIdx = args.indexOf("--private-key");
    const privateKey = keyIdx >= 0 ? args[keyIdx + 1] : process.env.FIDENCE_WALLET_PRIVATE_KEY;
    if (!privateKey) {
        console.error("Usage: fidence wallet import --private-key 0x...");
        process.exit(1);
    }
    const address = saveLocalWallet(privateKey);
    console.log("Wallet saved to ~/.fidence/wallet.json");
    console.log("Address:", address);
    console.log("Use the same wallet you verified on Fidence /wallets.");
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
    const useHeadless = args.includes("--auto") ||
        (args.includes("--to") && hasLocalWallet() && !args.includes("--username"));
    if (useHeadless && args.includes("--to")) {
        await cmdPayHeadless(args);
        return;
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
        await cmdWalletImport(commandArgs.slice(1));
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
