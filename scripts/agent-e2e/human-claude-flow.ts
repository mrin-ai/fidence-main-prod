/**
 * Human-style Claude agent connect E2E — run:
 *   npx tsx scripts/agent-e2e/human-claude-flow.ts
 */

import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import nacl from "tweetnacl";
import { MongoClient } from "mongodb";

import {
  buildSpendingWalletApprovePayload,
  generateSpendingWallets,
} from "../../src/lib/pay/generate-spending-wallets";
import { openSpendingWalletSecret } from "../../src/lib/pay/agent-wallet-crypto";

const BASE =
  process.env.PAYAGENT_BASE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://127.0.0.1:3000";

const findings: string[] = [];
let passed = 0;
let failed = 0;

function ok(label: string) {
  passed += 1;
  console.log(`PASS: ${label}`);
}

function issue(label: string, detail: string) {
  findings.push(`**${label}** — ${detail}`);
  console.log(`ISSUE: ${label} — ${detail}`);
}

function fail(label: string, detail: string) {
  failed += 1;
  findings.push(`**FAIL: ${label}** — ${detail}`);
  console.log(`FAIL: ${label} — ${detail}`);
}

async function getSessionCookie(): Promise<string | null> {
  const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/fidence";
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const session = await client
      .db(process.env.MONGODB_DB ?? "fidence")
      .collection("sessions")
      .findOne({}, { sort: { createdAt: -1 } });
    return session?.token ? `lcx-auth=${session.token as string}` : null;
  } finally {
    await client.close();
  }
}

async function sessionFetch(path: string, cookie: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cookie", cookie);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}

function generateKeyPair() {
  const pair = nacl.box.keyPair();
  return {
    publicKey: Buffer.from(pair.publicKey).toString("base64"),
    secretKey: Buffer.from(pair.secretKey).toString("base64"),
  };
}

async function main() {
  console.log(`Human Claude flow E2E @ ${BASE}\n`);

  const cookie = await getSessionCookie();
  if (!cookie) {
    fail("auth", "No browser session in MongoDB — log into the app first");
    printSummary();
    process.exit(1);
  }
  ok("Found logged-in portal session");

  // --- Step 1: Claude runs `fidence setup` ---
  const keyPair = generateKeyPair();
  const create = await fetch(`${BASE}/api/v1/agent-links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: keyPair.publicKey,
      platform: "claude",
      agentName: "E2E Claude Human",
    }),
  });
  const createBody = (await create.json()) as {
    linkId?: string;
    pollSecret?: string;
    connectUrl?: string;
  };
  if (!create.ok || !createBody.linkId || !createBody.pollSecret) {
    fail("fidence setup", `POST /api/v1/agent-links → ${create.status}`);
    printSummary();
    process.exit(1);
  }
  ok("Step 1 — fidence setup creates link session");

  // --- Step 2: Human approves in browser (simulated with spending wallets) ---
  const generated = generateSpendingWallets();
  const spendingWallets = buildSpendingWalletApprovePayload({
    generated,
    recipientPublicKeyB64: keyPair.publicKey,
  });

  const approve = await sessionFetch(
    `/api/pay/link-sessions/${createBody.linkId}`,
    cookie,
    {
      method: "POST",
      body: JSON.stringify({ action: "approve", spendingWallets }),
    },
  );
  if (!approve.response.ok) {
    fail(
      "browser approve",
      `POST /api/pay/link-sessions/:lid → ${approve.response.status} ${JSON.stringify(approve.data)}`,
    );
  } else {
    ok("Step 2 — browser approve with spending wallets");
  }

  // --- Step 3: Claude runs `fidence setup poll` ---
  const poll = await fetch(`${BASE}/api/v1/agent-links/${createBody.linkId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pollSecret: createBody.pollSecret }),
  });
  const pollBody = (await poll.json()) as {
    status?: string;
    apiKey?: string;
    agent?: { externalAgentId?: string };
    spendingWallets?: Array<{
      networkId: string;
      address: string;
      sealedSecret: string;
      nonce: string;
      ephemeralPublicKey: string;
    }>;
  };

  if (pollBody.status !== "approved" || !pollBody.apiKey?.startsWith("fid_agent_")) {
    fail("fidence setup poll", `Expected approved + fid_agent_ key, got ${JSON.stringify(pollBody)}`);
  } else {
    ok("Step 3 — fidence setup poll returns scoped API key");
  }

  if (!pollBody.spendingWallets?.length) {
    fail("wallet delivery", "Poll did not return spendingWallets (one-time delivery missing)");
  } else {
    ok(`Step 3 — poll delivers ${pollBody.spendingWallets.length} spending wallets`);

    try {
      const evmWallet = pollBody.spendingWallets.find((w) => w.sealedSecret);
      if (evmWallet) {
        openSpendingWalletSecret({
          secretKeyB64: keyPair.secretKey,
          sealedSecretB64: evmWallet.sealedSecret,
          nonceB64: evmWallet.nonce,
          ephemeralPublicKeyB64: evmWallet.ephemeralPublicKey,
        });
        ok("Step 3 — CLI can decrypt EVM spending wallet secret");
      }
    } catch (error) {
      fail("wallet decrypt", error instanceof Error ? error.message : String(error));
    }
  }

  // Second poll should not re-deliver key
  const poll2 = await fetch(`${BASE}/api/v1/agent-links/${createBody.linkId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pollSecret: createBody.pollSecret }),
  });
  const poll2Body = (await poll2.json()) as { apiKey?: string; spendingWallets?: unknown[] };
  if (poll2Body.apiKey) {
    issue("security", "Second poll still returned apiKey — should be one-time delivery only");
  } else {
    ok("Step 3 — second poll does not re-deliver API key");
  }

  const agentId = pollBody.agent?.externalAgentId;
  const scopedKey = pollBody.apiKey;

  // --- Step 4: Portal — linked agents, wallets, mandates ---
  const agentsRes = await sessionFetch("/api/pay/linked-agents", cookie);
  const agentsList = agentsRes.data as { agents?: Array<{ id: string; name: string; wallets: unknown[] }> };
  if (!agentsRes.response.ok) {
    fail("portal agents", `GET /api/pay/linked-agents → ${agentsRes.response.status}`);
  } else {
    ok(`Step 4 — /pay/agents API lists ${agentsList.agents?.length ?? 0} linked agents`);
    const e2eAgent = agentsList.agents?.find((a) => a.name === "E2E Claude Human");
    if (!e2eAgent) {
      issue("portal agents", "Newly connected agent not visible in linked-agents list");
    } else if ((e2eAgent.wallets?.length ?? 0) < 4) {
      issue("portal agents", `E2E agent has ${e2eAgent.wallets?.length ?? 0} wallets, expected 4 (EVM×3 + Solana)`);
    }
  }

  const walletsRes = await sessionFetch("/api/pay/agent-wallets", cookie);
  const walletsData = walletsRes.data as {
    agents?: Array<{ name: string; wallets: Array<{ networkId: string; balances: unknown[]; balanceError?: string }> }>;
  };
  if (!walletsRes.response.ok) {
    fail("portal wallets", `GET /api/pay/agent-wallets → ${walletsRes.response.status}`);
  } else {
    ok("Step 4 — /pay/wallets API returns agent wallet balances");
    const e2eWallets = walletsData.agents?.find((a) => a.name === "E2E Claude Human");
    const solanaWallet = e2eWallets?.wallets.find((w) => w.networkId === "solana");
    if (solanaWallet?.balanceError) {
      issue("solana balance", solanaWallet.balanceError);
    }
  }

  const linkedAgent = agentsList.agents?.find((a) => a.name === "E2E Claude Human");
  if (linkedAgent) {
    const mandatePut = await sessionFetch(`/api/pay/mandates/${linkedAgent.id}`, cookie, {
      method: "PUT",
      body: JSON.stringify({
        status: "active",
        autoPayEnabled: true,
        maxAmountPerPayment: 25,
        dailySpendCap: 100,
        monthlySpendCap: 500,
        allowedNetworkIds: ["sepolia"],
        allowedTokenIds: ["usdt"],
        allowCreatePaymentLinks: true,
        allowPay: true,
        requireApprovalAbove: 50,
      }),
    });
    if (!mandatePut.response.ok) {
      fail("mandate setup", `PUT mandate → ${mandatePut.response.status}`);
    } else {
      ok("Step 4 — user activates mandate + auto-pay on /pay/mandates");
    }
  }

  // --- Step 5: Claude runs preflight + pay ---
  if (scopedKey && agentId) {
    const preflightQuery = new URLSearchParams({
      type: "address",
      agentId,
      recipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      amount: "1",
      tokenId: "usdt",
      networkId: "sepolia",
      dryRun: "1",
    });
    const preflight = await fetch(`${BASE}/api/v1/pay/preflight?${preflightQuery}`, {
      headers: { Authorization: `Bearer ${scopedKey}` },
    });
    const preflightText = await preflight.text();
    let preflightBody: {
      ready?: boolean;
      autoPayEligible?: boolean;
      checks?: Record<string, { ok: boolean; message: string; code?: string }>;
    } = {};
    try {
      preflightBody = JSON.parse(preflightText);
    } catch {
      fail("preflight", `Non-JSON response (${preflight.status}): ${preflightText.slice(0, 80)}`);
    }
    if (preflight.ok && preflightBody) {
      ok(`Step 5 — preflight runs (ready=${preflightBody.ready}, autoPayEligible=${preflightBody.autoPayEligible})`);
      const failing = Object.entries(preflightBody.checks ?? {}).filter(([, c]) => !c.ok);
      for (const [name, check] of failing) {
        issue(`preflight.${name}`, check.message);
      }
    } else if (preflightBody) {
      fail("preflight", `GET preflight → ${preflight.status}`);
    }

    const payIntent = await fetch(`${BASE}/api/v1/payment-intents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${scopedKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `e2e-human-${Date.now()}`,
      },
      body: JSON.stringify({
        type: "address",
        recipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        amount: 0.01,
        tokenId: "usdt",
        networkId: "sepolia",
        autoExecute: true,
      }),
    });
    const payBody = (await payIntent.json()) as {
      intent?: { intentId?: string; status?: string };
      error?: string;
      code?: string;
    };
    if (!payIntent.response.ok) {
      issue("auto pay intent", `${payIntent.status} ${payBody.error ?? JSON.stringify(payBody)}`);
    } else {
      ok(`Step 5 — auto pay intent created (status=${payBody.intent?.status})`);
    }
  }

  // --- UX gaps ---
  if (linkedAgent) {
    const disconnectRoute = await sessionFetch(
      `/api/pay/linked-agents/${linkedAgent.id}/disconnect`,
      cookie,
      { method: "POST" },
    );
    if (disconnectRoute.response.ok) {
      ok("Disconnect API exists for linked agents");
      issue(
        "UX gap",
        "/pay/agents has no Disconnect button in the UI — users must use API or CLI `fidence agent disconnect`",
      );
    }
  }

  // Phase 8 e2e approve without spendingWallets should fail now
  const legacyCreate = await fetch(`${BASE}/api/v1/agent-links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: Buffer.from(new Uint8Array(32)).toString("base64"),
      platform: "e2e",
      agentName: "Legacy E2E",
    }),
  });
  const legacyBody = (await legacyCreate.json()) as { linkId?: string };
  if (legacyBody.linkId) {
    const legacyApprove = await sessionFetch(
      `/api/pay/link-sessions/${legacyBody.linkId}`,
      cookie,
      { method: "POST", body: JSON.stringify({ action: "approve" }) },
    );
    if (legacyApprove.response.ok) {
      issue("e2e tests", "phase-8 approve without spendingWallets still succeeds — test suite is outdated");
    } else {
      ok("Approve correctly rejects missing spendingWallets (phase-8 e2e is outdated)");
    }
  }

  // CLI binary smoke
  try {
    const dir = mkdtempSync(join(tmpdir(), "fidence-e2e-"));
    const configPath = join(dir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        linkId: createBody.linkId,
        pollSecret: createBody.pollSecret,
        linkPublicKey: keyPair.publicKey,
        linkSecretKey: keyPair.secretKey,
        apiKey: scopedKey,
        agentId,
      }),
    );
    const cli = join(process.cwd(), "packages/fidence-cli/dist/index.js");
    const statusOut = execSync(`node "${cli}" status`, {
      env: { ...process.env, HOME: dir, FIDENCE_BASE_URL: BASE },
      encoding: "utf8",
    });
    if (statusOut.includes(agentId ?? "___")) {
      ok("CLI fidence status reads saved agent config");
    }
    rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    issue("CLI", error instanceof Error ? error.message : String(error));
  }

  // Cleanup E2E agent
  if (linkedAgent) {
    await sessionFetch(`/api/pay/linked-agents/${linkedAgent.id}/disconnect`, cookie, {
      method: "POST",
    });
  }

  printSummary();
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  console.log(`\n=== Summary: ${passed} passed, ${failed} failed, ${findings.length} findings ===`);
  if (findings.length) {
    console.log("\nFindings for review:");
    for (const f of findings) console.log(`- ${f}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
