/**
 * PayAgent end-to-end test suite.
 *
 * Usage:
 *   npm run test:e2e
 *   BASE_URL=https://payagent.co npm run test:e2e
 *
 * Optional env (loaded from .env.local when present):
 *   E2E_USERNAME          — merchant username (default: referealtest)
 *   E2E_LINK_ID           — specific payment link public id
 *   SEPOLIA_PRIVATE_KEY   — runs a real Sepolia USDC payment + record flow
 *   FIDENCE_TEST_API_KEY_RITESH — runs agent API tests for referealtest
 *   FIDENCE_TEST_API_KEY_WORK   — runs agent API tests for work profile
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createPublicClient,
  erc20Abi,
  getAddress,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import {
  getNetworksForToken,
  getTokensForNetwork,
  isPaymentTokenNetworkSupported,
  paymentNetworks,
} from "../src/lib/create-payment-link-data";
import { getDb } from "../src/lib/db/client";
import { COLLECTIONS } from "../src/lib/db/collections";
import type { PaymentLinkDoc } from "../src/lib/db/types";
import {
  erc20TransferAbi,
  getChainIdForNetwork,
  getTokenContract,
  supportsOnChainPayment,
} from "../src/lib/payment-contracts";

function loadEnvFile() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Optional in CI.
  }
}

loadEnvFile();

const BASE_URL = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const E2E_USERNAME = (process.env.E2E_USERNAME ?? "referealtest").toLowerCase();

const EXPECTED_SEPOLIA = {
  usdc: "0x3402d41AA8e34e0DF605c12109de2f8F4FF33A87",
  usdt: "0xF9E0643Ba46eeaf4e1059775567f67F5c867bbfc",
} as const;

type TestResult = {
  name: string;
  ok: boolean;
  detail?: string;
  skipped?: boolean;
};

const results: TestResult[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail?: string) {
  results.push({ name, ok: false, detail });
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function skip(name: string, detail?: string) {
  results.push({ name, ok: true, skipped: true, detail });
  console.log(`  ○ ${name} (skipped${detail ? ` — ${detail}` : ""})`);
}

async function api(
  path: string,
  init?: RequestInit & { apiKey?: string },
) {
  const headers = new Headers(init?.headers);
  if (init?.apiKey) {
    headers.set("Authorization", `Bearer ${init.apiKey}`);
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data, ok: response.ok };
}

function sepoliaRpcUrl() {
  const key = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY?.trim();
  if (key) return `https://eth-sepolia.g.alchemy.com/v2/${key}`;
  return process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim() ?? sepolia.rpcUrls.default.http[0];
}

async function testContracts() {
  console.log("\n[1] Token contracts");

  const networks = ["base", "ethereum", "arbitrum", "polygon", "sepolia"] as const;

  for (const networkId of networks) {
    for (const tokenId of ["usdc", "usdt"] as const) {
      const contract = getTokenContract(networkId, tokenId);
      if (!contract) {
        fail(`${networkId}/${tokenId} configured`, "missing");
        continue;
      }
      try {
        getAddress(contract.address);
        pass(`${networkId}/${tokenId} checksum`, contract.address);
      } catch (error) {
        fail(
          `${networkId}/${tokenId} checksum`,
          error instanceof Error ? error.message : "invalid",
        );
      }
    }
  }

  const sepoliaUsdc = getTokenContract("sepolia", "usdc");
  const sepoliaUsdt = getTokenContract("sepolia", "usdt");

  if (sepoliaUsdc?.address === EXPECTED_SEPOLIA.usdc) {
    pass("Sepolia USDC address", sepoliaUsdc.address);
  } else {
    fail("Sepolia USDC address", `expected ${EXPECTED_SEPOLIA.usdc}, got ${sepoliaUsdc?.address}`);
  }

  if (sepoliaUsdt?.address === getAddress(EXPECTED_SEPOLIA.usdt)) {
    pass("Sepolia USDT address", sepoliaUsdt.address);
  } else {
    fail("Sepolia USDT address", `expected ${EXPECTED_SEPOLIA.usdt}, got ${sepoliaUsdt?.address}`);
  }
}

async function testPaymentMatrix() {
  console.log("\n[2] Payment token/network matrix");

  let unsupported = 0;
  for (const network of paymentNetworks) {
    const tokens = getTokensForNetwork(network.id);
    if (tokens.length === 0) {
      fail(`network ${network.id} has tokens`, "none configured");
      unsupported += 1;
      continue;
    }
    pass(`network ${network.id} tokens`, tokens.map((t) => t.id).join(", "));

    for (const token of tokens) {
      if (!isPaymentTokenNetworkSupported(token.id, network.id)) {
        fail(`supports ${network.id}/${token.id}`, "not supported");
        unsupported += 1;
      }
    }
  }

  if (supportsOnChainPayment("sepolia", "usdc") && supportsOnChainPayment("sepolia", "usdt")) {
    pass("Sepolia on-chain payments", "usdc + usdt enabled");
  } else {
    fail("Sepolia on-chain payments", "usdc or usdt disabled");
  }

  const sepoliaChainId = getChainIdForNetwork("sepolia");
  if (sepoliaChainId === 11155111) {
    pass("Sepolia chain id", String(sepoliaChainId));
  } else {
    fail("Sepolia chain id", `expected 11155111, got ${sepoliaChainId}`);
  }

  const usdcNetworks = getNetworksForToken("usdc").map((n) => n.id);
  if (usdcNetworks.includes("sepolia")) {
    pass("USDC includes Sepolia", usdcNetworks.join(", "));
  } else {
    fail("USDC includes Sepolia", usdcNetworks.join(", "));
  }

  if (unsupported === 0) {
    pass("payment matrix", "all configured pairs supported");
  }
}

async function testSepoliaOnChain() {
  console.log("\n[3] Sepolia on-chain (RPC)");

  const client = createPublicClient({
    chain: sepolia,
    transport: http(sepoliaRpcUrl()),
  });

  try {
    const block = await client.getBlockNumber();
    pass("Sepolia RPC reachable", `block ${block}`);
  } catch (error) {
    fail(
      "Sepolia RPC reachable",
      error instanceof Error ? error.message : "connection failed",
    );
    return;
  }

  for (const [tokenId, address] of Object.entries(EXPECTED_SEPOLIA)) {
    try {
      const code = await client.getBytecode({ address: getAddress(address) });
      if (code && code !== "0x") {
        pass(`Sepolia ${tokenId} contract deployed`, address);
      } else {
        fail(`Sepolia ${tokenId} contract deployed`, "no bytecode");
      }
    } catch (error) {
      fail(
        `Sepolia ${tokenId} contract deployed`,
        error instanceof Error ? error.message : "lookup failed",
      );
    }
  }
}

async function testApiHealth() {
  console.log("\n[4] API health");

  try {
    const { status, data } = await api("/api/health");
    if (status === 200 && data.db === "ok") {
      pass("GET /api/health", `db=${data.db}, redis=${data.redis}`);
    } else {
      fail("GET /api/health", JSON.stringify(data));
    }
  } catch (error) {
    fail(
      "GET /api/health",
      error instanceof Error ? error.message : `server not reachable at ${BASE_URL}`,
    );
  }
}

async function findPendingSepoliaLink(): Promise<PaymentLinkDoc | null> {
  if (process.env.E2E_LINK_ID) {
    const db = await getDb();
    return db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).findOne({
      username: E2E_USERNAME,
      publicId: process.env.E2E_LINK_ID,
    });
  }

  const db = await getDb();
  return db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).findOne(
    {
      username: E2E_USERNAME,
      status: "pending",
      networkId: "sepolia",
      expiresAt: { $gt: new Date() },
      recipientAddress: { $exists: true, $ne: "" },
    },
    { sort: { createdAt: -1 } },
  );
}

async function testLeaderboard() {
  console.log("\n[5] Leaderboard");

  try {
    const page = await fetch(`${BASE_URL}/leaderboard`, {
      headers: { Accept: "text/html" },
    });
    if (page.status === 200) {
      pass("GET /leaderboard page", "200");
    } else {
      fail("GET /leaderboard page", `status ${page.status}`);
    }
  } catch (error) {
    fail(
      "GET /leaderboard page",
      error instanceof Error ? error.message : "request failed",
    );
  }

  try {
    const { status, data } = await api("/api/public/leaderboard");
    if (status !== 200) {
      fail("GET /api/public/leaderboard", `status ${status}`);
      return;
    }

    const hasSummary =
      typeof data.summary?.totalValue === "number" &&
      typeof data.summary?.totalTxns === "number" &&
      typeof data.summary?.activeAgents === "number";
    const hasRows = Array.isArray(data.rows);

    if (hasSummary && hasRows) {
      pass(
        "leaderboard API shape",
        `${data.rows.length} agents, $${data.summary.totalValue} volume, ${data.summary.totalTxns} txns`,
      );
    } else {
      fail("leaderboard API shape", JSON.stringify(data).slice(0, 200));
    }

    if (data.rows.length > 0) {
      const row = data.rows[0];
      if (
        typeof row.rank === "number" &&
        typeof row.publicId === "string" &&
        typeof row.totalValue === "number"
      ) {
        pass("leaderboard row shape", `#${row.rank} ${row.publicId}`);
      } else {
        fail("leaderboard row shape", JSON.stringify(row).slice(0, 200));
      }
    } else {
      pass("leaderboard rows", "empty (no agent activity yet)");
    }
  } catch (error) {
    fail(
      "GET /api/public/leaderboard",
      error instanceof Error ? error.message : "request failed",
    );
  }
}

async function testPublicProfile() {
  console.log("\n[6] Public profile");

  const { status, data } = await api(`/api/public/users/${E2E_USERNAME}`);
  if (status !== 200 || !data.profile) {
    fail("GET public profile", JSON.stringify(data));
    return null;
  }

  pass("GET public profile", `@${data.profile.username}`);
  const sepoliaWallet = data.profile.wallets?.find(
    (w: { networkId: string }) => w.networkId === "sepolia",
  );
  if (sepoliaWallet?.address) {
    pass("Profile Sepolia wallet", sepoliaWallet.address);
  } else {
    fail("Profile Sepolia wallet", "not configured");
  }

  return data.profile as {
    username: string;
    wallets: Array<{ networkId: string; address: string }>;
  };
}

async function testPaymentLinkFlow() {
  console.log("\n[7] Payment link flow");

  const linkDoc = await findPendingSepoliaLink();
  if (!linkDoc) {
    skip(
      "payment link tests",
      `no pending Sepolia link for @${E2E_USERNAME} — create one in the app or set E2E_LINK_ID`,
    );
    return null;
  }

  pass("discovered pending link", `${linkDoc.publicId} (${linkDoc.amount} ${linkDoc.tokenId})`);

  const { status, data } = await api(`/api/pay/${E2E_USERNAME}/${linkDoc.publicId}`);
  if (status !== 200) {
    fail("GET payment link", JSON.stringify(data));
    return null;
  }

  if (data.status !== "pending") {
    fail("link status pending", data.status);
  } else {
    pass("link status", "pending");
  }

  if (!data.canPay) {
    fail("link canPay", "false");
  } else {
    pass("link canPay", "true");
  }

  if (!data.recipientAddress) {
    fail("link recipientAddress", "missing");
  } else {
    pass("link recipientAddress", data.recipientAddress);
  }

  const token = getTokenContract(data.networkId, data.tokenId);
  if (token) {
    pass("link token contract", `${data.tokenId} → ${token.address}`);
  } else {
    fail("link token contract", `${data.networkId}/${data.tokenId}`);
  }

  const page = await fetch(`${BASE_URL}/${E2E_USERNAME}/${linkDoc.publicId}`);
  if (page.status === 200) {
    pass("payment page loads", `/${E2E_USERNAME}/${linkDoc.publicId}`);
  } else {
    fail("payment page loads", `status ${page.status}`);
  }

  const bogusTx = `0x${"a".repeat(64)}` as const;
  const bogusPayer = "0x518b9aba7586542e611909799f6d0b81e9552d9b";
  const post = await api(`/api/pay/${E2E_USERNAME}/${linkDoc.publicId}`, {
    method: "POST",
    body: JSON.stringify({
      payerAddress: bogusPayer,
      txHash: bogusTx,
    }),
  });

  if (post.status === 400 && post.data.error === "Payment verification failed") {
    pass("POST bogus tx rejected", post.data.error);
  } else {
    fail("POST bogus tx rejected", `${post.status} ${JSON.stringify(post.data)}`);
  }

  const missing = await api(`/api/pay/${E2E_USERNAME}/${linkDoc.publicId}`, {
    method: "POST",
    body: JSON.stringify({ payerAddress: bogusPayer }),
  });
  if (missing.status === 400) {
    pass("POST missing txHash rejected", String(missing.data.error ?? missing.status));
  } else {
    fail("POST missing txHash rejected", `${missing.status}`);
  }

  return linkDoc;
}

async function testAgentApi() {
  console.log("\n[8] Agent API (optional)");

  const apiKey = process.env.FIDENCE_TEST_API_KEY_RITESH?.trim();
  if (!apiKey) {
    skip("agent API", "set FIDENCE_TEST_API_KEY_RITESH to run");
    return null;
  }

  const agentId = "e2e-checkout-agent";
  const register = await api("/api/v1/agents/register", {
    method: "POST",
    apiKey,
    body: JSON.stringify({
      agentId,
      agentName: "E2E Test Agent",
    }),
  });
  if (register.status === 200 || register.status === 201) {
    pass("agent register", String(register.status));
  } else {
    fail("agent register", `${register.status} ${JSON.stringify(register.data)}`);
    return null;
  }

  const wallet = await api("/api/v1/agents/wallet", {
    method: "POST",
    apiKey,
    body: JSON.stringify({
      agentId,
      walletAddress: "0x518b9aba7586542e611909799f6d0b81e9552d9b",
      networkId: "sepolia",
    }),
  });
  if (wallet.status === 200) {
    pass("agent wallet", "sepolia configured");
  } else {
    fail("agent wallet", `${wallet.status} ${JSON.stringify(wallet.data)}`);
  }

  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 1);

  const createLink = await api("/api/v1/payment-links", {
    method: "POST",
    apiKey,
    body: JSON.stringify({
      agentId,
      amount: 0.01,
      tokenId: "usdc",
      networkId: "sepolia",
      expiresAt: expiresAt.toISOString(),
    }),
  });

  if (createLink.status === 200 || createLink.status === 201) {
    pass("agent create payment link", createLink.data.publicId ?? createLink.data.url);
    return createLink.data as { publicId?: string; username?: string };
  }

  fail("agent create payment link", `${createLink.status} ${JSON.stringify(createLink.data)}`);
  return null;
}

async function testOnChainPayment(linkDoc: PaymentLinkDoc | null) {
  console.log("\n[9] On-chain payment (optional)");

  const privateKey = process.env.SEPOLIA_PRIVATE_KEY?.trim() as `0x${string}` | undefined;
  if (!privateKey) {
    skip("on-chain payment", "set SEPOLIA_PRIVATE_KEY to run real transfer");
    return;
  }

  if (!linkDoc) {
    skip("on-chain payment", "no pending link available");
    return;
  }

  const account = privateKeyToAccount(privateKey);
  const transport = http(sepoliaRpcUrl());
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const { createWalletClient } = await import("viem");
  const walletClient = createWalletClient({ account, chain: sepolia, transport });

  const token = getTokenContract(linkDoc.networkId, linkDoc.tokenId);
  if (!token || !linkDoc.recipientAddress) {
    fail("on-chain payment setup", "token or recipient missing");
    return;
  }

  const amount = parseUnits(linkDoc.amount.toString(), token.decimals);
  const balance = await publicClient.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (balance < amount) {
    fail(
      "payer token balance",
      `have ${balance} need ${amount} at ${token.address}`,
    );
    return;
  }
  pass("payer token balance", `sufficient for ${linkDoc.amount} ${linkDoc.tokenId}`);

  await publicClient.simulateContract({
    account: account.address,
    address: token.address,
    abi: erc20TransferAbi,
    functionName: "transfer",
    args: [getAddress(linkDoc.recipientAddress), amount],
  });
  pass("transfer simulation", "ok");

  const txHash = await walletClient.writeContract({
    address: token.address,
    abi: erc20TransferAbi,
    functionName: "transfer",
    args: [getAddress(linkDoc.recipientAddress), amount],
  });
  pass("transfer submitted", txHash);

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  pass("transfer confirmed", txHash);

  const record = await api(`/api/pay/${E2E_USERNAME}/${linkDoc.publicId}`, {
    method: "POST",
    body: JSON.stringify({
      payerAddress: account.address,
      txHash,
    }),
  });

  if (record.status === 200 && record.data.status === "paid") {
    pass("payment recorded", `link ${linkDoc.publicId} marked paid`);
  } else {
    fail("payment recorded", `${record.status} ${JSON.stringify(record.data)}`);
  }
}

async function main() {
  console.log(`\nPayAgent E2E — ${BASE_URL}`);
  console.log(`User: @${E2E_USERNAME}`);

  await testContracts();
  await testPaymentMatrix();
  await testSepoliaOnChain();
  await testApiHealth();
  await testLeaderboard();
  await testPublicProfile();
  const linkDoc = await testPaymentLinkFlow();
  await testAgentApi();
  await testOnChainPayment(linkDoc);

  const failed = results.filter((r) => !r.ok);
  const skipped = results.filter((r) => r.skipped);
  const passed = results.filter((r) => r.ok && !r.skipped);

  console.log("\n────────────────────────────────────");
  console.log(
    `Results: ${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped`,
  );

  if (failed.length > 0) {
    console.log("\nFailed:");
    for (const result of failed) {
      console.log(`  • ${result.name}${result.detail ? `: ${result.detail}` : ""}`);
    }
    process.exit(1);
  }

  console.log("\nAll required tests passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("\nE2E runner crashed:", error);
  process.exit(1);
});
