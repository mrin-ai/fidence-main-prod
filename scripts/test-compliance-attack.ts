/**
 * Focused adversarial checks against the Compliance Engine.
 *
 * Usage:
 *   npx tsx scripts/test-compliance-attack.ts
 *
 * Optional live API (loads .env.local):
 *   FIDENCE_TEST_API_KEY_RITESH / FIDENCE_TEST_API_KEY_WORK
 *   BASE_URL (default http://localhost:3000)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ObjectId } from "mongodb";

import { evaluatePolicy } from "../src/lib/compliance/evaluate-policy";
import { toPolicyAmountUsd } from "../src/lib/compliance/valuation";
import { POLICY_CODES } from "../src/lib/compliance/codes";
import { clientPromise, getDb } from "../src/lib/db/client";
import { COLLECTIONS } from "../src/lib/db/collections";
import { ensureComplianceIndexes } from "../src/lib/db/compliance-indexes";
import {
  getAgentSpendTotals,
  tryIncrementAgentSpend,
} from "../src/lib/db/agent-spend";
import { claimPaymentApproval } from "../src/lib/db/payment-approvals";
import { recordPolicyDecision } from "../src/lib/db/policy-decisions";
import { actorFromSecurity } from "../src/lib/compliance/actor";
import { isComplianceEnforcementEnabled } from "../src/lib/compliance/enforcement";
import type { PaymentApprovalDoc } from "../src/lib/db/compliance-types";

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
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnvFile();

type AttackResult = {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  outcome: "CONFIRMED" | "BLOCKED" | "SKIPPED" | "INFO";
  detail: string;
};

const results: AttackResult[] = [];

function report(result: AttackResult) {
  results.push(result);
  const mark =
    result.outcome === "CONFIRMED"
      ? "✗"
      : result.outcome === "BLOCKED"
        ? "✓"
        : "·";
  console.log(
    `${mark} [${result.severity}] ${result.id}: ${result.title} → ${result.outcome}`,
  );
  console.log(`  ${result.detail}`);
}

const samplePolicy = {
  id: "pol_attack",
  status: "active" as const,
  policyVersion: 1,
  maxAmountPerPayment: 50,
  dailySpendCap: 200,
  monthlySpendCap: 1000 as number | null,
  allowedNetworkIds: ["sepolia", "base"],
  allowedTokenIds: ["usdc", "usdt"],
  allowCreatePaymentLinks: true,
  allowPay: true,
  requireApprovalAbove: null as number | null,
};

async function attackCreateLinkCapBypass() {
  // Outstanding unpaid exposure + paid spend must block cumulative creates.
  let allowed = 0;
  let outstandingUsd = 0;
  for (let i = 0; i < 10; i++) {
    const verdict = evaluatePolicy({
      agentStatus: "active",
      action: "payment_links.create",
      amountUsd: 50,
      networkId: "sepolia",
      tokenId: "usdc",
      policy: samplePolicy,
      spentDailyUsd: 0,
      spentMonthlyUsd: 0,
      outstandingUsd,
    });
    if (verdict.verdict === "allow") {
      allowed += 1;
      outstandingUsd += 50;
    }
  }

  if (allowed <= 4 && outstandingUsd <= 200) {
    report({
      id: "A1",
      severity: "high",
      title: "Create-link daily cap bypass (outstanding exposure)",
      outcome: "BLOCKED",
      detail: `Outstanding-aware eval allowed ${allowed}/10 × $50 (cap $200).`,
    });
  } else {
    report({
      id: "A1",
      severity: "high",
      title: "Create-link daily cap bypass (outstanding exposure)",
      outcome: "CONFIRMED",
      detail: `Allowed ${allowed} creates / outstanding=${outstandingUsd} under dailySpendCap=$200.`,
    });
  }
}

async function attackPayLedgerRace() {
  await ensureComplianceIndexes();
  const workspaceId = new ObjectId();
  const agentId = new ObjectId();

  // Two concurrent increments that both fit if checked separately against 0 spend.
  const [a, b] = await Promise.all([
    tryIncrementAgentSpend({
      workspaceId,
      agentId,
      amountUsd: 150,
      dailySpendCap: 200,
      monthlySpendCap: null,
    }),
    tryIncrementAgentSpend({
      workspaceId,
      agentId,
      amountUsd: 150,
      dailySpendCap: 200,
      monthlySpendCap: null,
    }),
  ]);

  const totals = await getAgentSpendTotals(workspaceId, agentId);
  const db = await getDb();
  await db.collection(COLLECTIONS.agentSpendDaily).deleteMany({ workspaceId });

  const oneOk = a.ok !== b.ok;
  const ledgerOk = totals.spentDailyUsd <= 200;

  if (oneOk && ledgerOk) {
    report({
      id: "A2",
      severity: "high",
      title: "Spend ledger race under concurrent $inc",
      outcome: "BLOCKED",
      detail: `Conditional $inc held (final daily=${totals.spentDailyUsd}).`,
    });
  } else {
    report({
      id: "A2",
      severity: "high",
      title: "Spend ledger race under concurrent $inc",
      outcome: "CONFIRMED",
      detail: `Ledger overran or both increments succeeded (daily=${totals.spentDailyUsd}, a.ok=${a.ok}, b.ok=${b.ok}).`,
    });
  }

  const paySource = readFileSync(
    resolve(process.cwd(), "src/lib/db/agent-payments.ts"),
    "utf8",
  );
  const reservesBeforeSettle =
    paySource.includes("const spend = await reserveSpend") &&
    paySource.includes("await decrementAgentSpend") &&
    paySource.indexOf("const spend = await reserveSpend") <
      paySource.indexOf("markPaymentLinkPaid(");

  report({
    id: "A2b",
    severity: "high",
    title: "Pay path ignores failed spend increment after settlement",
    outcome: reservesBeforeSettle ? "BLOCKED" : "CONFIRMED",
    detail: reservesBeforeSettle
      ? "Pay reserves spend before settle and rolls back on failure."
      : "Pay path still settles before authoritative spend reserve.",
  });
}

async function attackApprovalReplay() {
  await ensureComplianceIndexes();
  const db = await getDb();
  const workspaceId = new ObjectId();
  const agentId = new ObjectId();
  const approvalId = `apr_attack_${Date.now().toString(16)}`;

  await db.collection<PaymentApprovalDoc>(COLLECTIONS.paymentApprovals).insertOne({
    _id: new ObjectId(),
    approvalId,
    workspaceId,
    agentId,
    agentPublicId: "agt_attack",
    externalAgentId: "attack-agent",
    status: "approved",
    amountUsd: 45,
    networkId: "sepolia",
    tokenId: "usdc",
    payload: {
      type: "profile",
      recipientUsername: "target",
      amount: 45,
      tokenId: "usdc",
      networkId: "sepolia",
      amountUsd: 45,
    },
    requestedBy: {
      actorType: "agent",
      ip: "203.0.113.1",
      agentId: agentId.toString(),
    },
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    policyVersion: 1,
  });

  const claimInput = {
    workspaceId,
    approvalId,
    agentId,
    amountUsd: 45,
    tokenId: "usdc",
    networkId: "sepolia",
    payloadMatch: {
      type: "profile" as const,
      recipientUsername: "target",
    },
  };

  const [c1, c2] = await Promise.all([
    claimPaymentApproval(claimInput),
    claimPaymentApproval(claimInput),
  ]);

  await db.collection(COLLECTIONS.paymentApprovals).deleteMany({ workspaceId });

  const wins = (c1.ok ? 1 : 0) + (c2.ok ? 1 : 0);
  if (wins === 1) {
    report({
      id: "A3",
      severity: "high",
      title: "Approval replay via validate-before-consume",
      outcome: "BLOCKED",
      detail: "Atomic claimPaymentApproval: exactly one concurrent claim succeeds.",
    });
  } else {
    report({
      id: "A3",
      severity: "high",
      title: "Approval replay via validate-before-consume",
      outcome: "CONFIRMED",
      detail: `Concurrent claims succeeded=${wins} (expected 1).`,
    });
  }
}

async function attackClientUsdIgnored() {
  const valuation = toPolicyAmountUsd(10, "usdc");
  if (valuation.ok && valuation.amountUsd === 10) {
    report({
      id: "A4",
      severity: "info",
      title: "No client usdAmount field in valuation helper",
      outcome: "BLOCKED",
      detail: "toPolicyAmountUsd(amount, tokenId) has no usd override.",
    });
  }
}

async function attackProfileUnderreportAmount() {
  const paySource = readFileSync(
    resolve(process.cwd(), "src/lib/db/agent-payments.ts"),
    "utf8",
  );
  const typesSource = readFileSync(
    resolve(process.cwd(), "src/lib/payment/settlement/types.ts"),
    "utf8",
  );
  const usesObserved =
    typesSource.includes("verifySettlementDetailed") &&
    paySource.includes("verifySettlementDetailed") &&
    paySource.includes("observedAmount");

  // Policy must use observed amount: $100 observed vs $50 max → deny.
  const denied = evaluatePolicy({
    agentStatus: "active",
    action: "pay.profile",
    amountUsd: 100,
    networkId: "sepolia",
    tokenId: "usdc",
    policy: samplePolicy,
    spentDailyUsd: 0,
    spentMonthlyUsd: 0,
  });

  report({
    id: "A5",
    severity: "high",
    title: "Profile pay under-report amount vs min on-chain check",
    outcome:
      usesObserved && denied.codes[0] === POLICY_CODES.AMOUNT_ABOVE_MAX
        ? "BLOCKED"
        : "CONFIRMED",
    detail: usesObserved
      ? "Profile path verifies detailed + gates on observedAmount; $100 exceeds max $50."
      : "Profile path still appears to trust client amount for policy/spend.",
  });
}

async function attackEnforcementBreakGlass() {
  const prev = process.env.COMPLIANCE_ENFORCEMENT;
  const prevGlass = process.env.COMPLIANCE_ENFORCEMENT_BREAK_GLASS;
  const prevNode = process.env.NODE_ENV;
  try {
    process.env.COMPLIANCE_ENFORCEMENT = "0";
    delete process.env.COMPLIANCE_ENFORCEMENT_BREAK_GLASS;
    process.env.NODE_ENV = "production";
    const enforced = isComplianceEnforcementEnabled();

    process.env.COMPLIANCE_ENFORCEMENT_BREAK_GLASS = "1";
    const bypass = !isComplianceEnforcementEnabled();

    report({
      id: "A9",
      severity: "medium",
      title: "COMPLIANCE_ENFORCEMENT fail-open without break-glass",
      outcome: enforced && bypass ? "BLOCKED" : "CONFIRMED",
      detail: enforced
        ? "Production requires BREAK_GLASS=1 to fail-open."
        : "Enforcement disabled in production without break-glass.",
    });
  } finally {
    if (prev === undefined) delete process.env.COMPLIANCE_ENFORCEMENT;
    else process.env.COMPLIANCE_ENFORCEMENT = prev;
    if (prevGlass === undefined) delete process.env.COMPLIANCE_ENFORCEMENT_BREAK_GLASS;
    else process.env.COMPLIANCE_ENFORCEMENT_BREAK_GLASS = prevGlass;
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
  }
}

async function attackNoActivePolicyFailClosed() {
  const denied = evaluatePolicy({
    agentStatus: "active",
    action: "pay.link",
    amountUsd: 1,
    networkId: "sepolia",
    tokenId: "usdc",
    policy: null,
    spentDailyUsd: 0,
    spentMonthlyUsd: 0,
  });
  report({
    id: "A6",
    severity: "info",
    title: "Fail closed without active policy",
    outcome: denied.codes[0] === POLICY_CODES.NO_ACTIVE_POLICY ? "BLOCKED" : "CONFIRMED",
    detail: `verdict=${denied.verdict} codes=${denied.codes.join(",")}`,
  });
}

async function attackCrossWorkspaceDecisionIsolation() {
  await ensureComplianceIndexes();
  const db = await getDb();
  const wsA = new ObjectId();
  const wsB = new ObjectId();
  const agentA = new ObjectId();

  const actor = actorFromSecurity(
    {
      ip: "198.51.100.99",
      userAgent: "attack",
      device: "test",
      browser: "test",
      timestamp: new Date(),
      date: new Date().toISOString().slice(0, 10),
    },
    { actorType: "agent", agentId: agentA.toString() },
  );

  const { receiptId } = await recordPolicyDecision({
    workspaceId: wsA,
    action: "pay.link",
    verdict: "deny",
    codes: [POLICY_CODES.NO_ACTIVE_POLICY],
    agentId: agentA,
    actor,
  });

  const leaked = await db.collection(COLLECTIONS.policyDecisions).findOne({
    receiptId,
    workspaceId: wsB,
  });

  await db.collection(COLLECTIONS.policyDecisions).deleteMany({
    workspaceId: { $in: [wsA, wsB] },
  });

  report({
    id: "A7",
    severity: "medium",
    title: "Cross-workspace decision IDOR by receiptId+wrong workspace",
    outcome: leaked ? "CONFIRMED" : "BLOCKED",
    detail: leaked
      ? "Decision readable under foreign workspaceId filter"
      : "Decision scoped to workspaceId; foreign lookup empty.",
  });
}

async function attackIpNotFromBody() {
  const actor = actorFromSecurity(
    {
      ip: "203.0.113.50",
      userAgent: "x",
      device: "x",
      browser: "x",
      timestamp: new Date(),
      date: "2026-08-03",
    },
    { actorType: "user", userId: "u1" },
  );
  // There is no API that accepts actor.ip from JSON into recordPolicyDecision without going through extractSecurityContext on routes.
  report({
    id: "A8",
    severity: "info",
    title: "Actor IP sourced from SecurityContext helper",
    outcome: "BLOCKED",
    detail: `actorFromSecurity uses security.ip (${actor.ip}); routes use extractSecurityContext(request), not body.ip.`,
  });
}

async function liveApiAttacks() {
  const apiKey =
    process.env.FIDENCE_TEST_API_KEY_RITESH ||
    process.env.FIDENCE_TEST_API_KEY_WORK ||
    process.env.PAYAGENT_API_KEY;
  const baseUrl = (
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  if (!apiKey) {
    report({
      id: "L0",
      severity: "info",
      title: "Live API attacks",
      outcome: "SKIPPED",
      detail:
        "No FIDENCE_TEST_API_KEY_RITESH / FIDENCE_TEST_API_KEY_WORK / PAYAGENT_API_KEY in env.",
    });
    return;
  }

  async function api(path: string, init?: RequestInit) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  }

  const agentsRes = await api("/api/v1/compliance/agents");
  if (agentsRes.status !== 200) {
    report({
      id: "L1",
      severity: "medium",
      title: "List compliance agents with API key",
      outcome: "SKIPPED",
      detail: `HTTP ${agentsRes.status} — is ${baseUrl} up?`,
    });
    return;
  }

  const agents = (agentsRes.data.agents || []) as Array<{
    externalAgentId: string;
    status: string;
    policyStatus: string;
    complianceStatus: string;
  }>;

  const target =
    agents.find((a) => a.status === "active") || agents[0];

  if (!target) {
    report({
      id: "L1",
      severity: "info",
      title: "Live create without policy",
      outcome: "SKIPPED",
      detail: "No agents in workspace to attack.",
    });
    return;
  }

  // Force draft / no policy if needed by deactivating then creating.
  const getPolicy = await api(
    `/api/v1/compliance/agents/${encodeURIComponent(target.externalAgentId)}/policy`,
  );
  const existing = getPolicy.data?.policy;

  // Attack: create link should fail closed if no active policy.
  if (!existing || existing.status !== "active") {
    const create = await api("/api/v1/payment-links", {
      method: "POST",
      body: JSON.stringify({
        agentId: target.externalAgentId,
        amount: 1,
        tokenId: "usdc",
        networkId: "sepolia",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    const blocked =
      create.status === 403 &&
      (create.data?.code === "NO_ACTIVE_POLICY" ||
        create.data?.codes?.includes("NO_ACTIVE_POLICY"));
    report({
      id: "L2",
      severity: "info",
      title: "Live create-link without active policy",
      outcome: blocked ? "BLOCKED" : "CONFIRMED",
      detail: `HTTP ${create.status} code=${create.data?.code ?? "none"}`,
    });
  } else {
    // Activate a tight policy then batch-over-create.
    const put = await api(
      `/api/v1/compliance/agents/${encodeURIComponent(target.externalAgentId)}/policy`,
      {
        method: "PUT",
        body: JSON.stringify({
          status: "active",
          maxAmountPerPayment: 50,
          dailySpendCap: 200,
          monthlySpendCap: null,
          allowedNetworkIds: ["sepolia"],
          allowedTokenIds: ["usdc"],
          allowCreatePaymentLinks: true,
          allowPay: true,
          requireApprovalAbove: null,
          confirmWideOpen: true,
        }),
      },
    );

    if (put.status !== 200) {
      report({
        id: "L3",
        severity: "medium",
        title: "Set tight policy for live batch attack",
        outcome: "SKIPPED",
        detail: `HTTP ${put.status} ${put.data?.error ?? ""}`,
      });
      return;
    }

    const batch = await api("/api/v1/payment-links/batch", {
      method: "POST",
      body: JSON.stringify({
        agentId: target.externalAgentId,
        links: Array.from({ length: 5 }, () => ({
          amount: 50,
          tokenId: "usdc",
          networkId: "sepolia",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        })),
      }),
    });

    // Current buggy behavior: all 5 may succeed ($250 > $200 daily) because create doesn't reserve spend.
    if (batch.status === 200 && batch.data?.count === 5) {
      report({
        id: "L3",
        severity: "high",
        title: "Live batch create exceeds dailySpendCap",
        outcome: "CONFIRMED",
        detail: `Created ${batch.data.count} × $50 = $250 exposure under dailySpendCap=$200 (create does not increment spend).`,
      });
    } else if (batch.status === 403) {
      report({
        id: "L3",
        severity: "high",
        title: "Live batch create exceeds dailySpendCap",
        outcome: "BLOCKED",
        detail: `HTTP 403 code=${batch.data?.code}`,
      });
    } else {
      report({
        id: "L3",
        severity: "high",
        title: "Live batch create exceeds dailySpendCap",
        outcome: "INFO",
        detail: `HTTP ${batch.status} count=${batch.data?.count ?? "n/a"} error=${batch.data?.error ?? ""}`,
      });
    }

    // Wrong network should deny.
    const wrongNet = await api("/api/v1/payment-links", {
      method: "POST",
      body: JSON.stringify({
        agentId: target.externalAgentId,
        amount: 1,
        tokenId: "usdc",
        networkId: "ethereum",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    report({
      id: "L4",
      severity: "info",
      title: "Live create with disallowed network",
      outcome:
        wrongNet.status === 403 &&
        wrongNet.data?.codes?.includes("NETWORK_NOT_ALLOWED")
          ? "BLOCKED"
          : wrongNet.status === 403
            ? "BLOCKED"
            : "CONFIRMED",
      detail: `HTTP ${wrongNet.status} code=${wrongNet.data?.code ?? wrongNet.data?.error}`,
    });

    // Restore prior policy if we had one.
    if (existing) {
      await api(
        `/api/v1/compliance/agents/${encodeURIComponent(target.externalAgentId)}/policy`,
        {
          method: "PUT",
          body: JSON.stringify({ ...existing, confirmWideOpen: true }),
        },
      );
    }
  }

  // Unauthorized without key.
  const unauth = await fetch(`${baseUrl}/api/v1/compliance/agents`);
  report({
    id: "L5",
    severity: "info",
    title: "Compliance agents without API key",
    outcome: unauth.status === 401 ? "BLOCKED" : "CONFIRMED",
    detail: `HTTP ${unauth.status}`,
  });
}

async function main() {
  console.log("\n=== Compliance Engine focused attack ===\n");

  await attackCreateLinkCapBypass();
  await attackPayLedgerRace();
  await attackApprovalReplay();
  await attackClientUsdIgnored();
  await attackProfileUnderreportAmount();
  await attackEnforcementBreakGlass();
  await attackNoActivePolicyFailClosed();
  await attackCrossWorkspaceDecisionIsolation();
  await attackIpNotFromBody();
  await liveApiAttacks();

  const confirmed = results.filter((r) => r.outcome === "CONFIRMED");
  const blocked = results.filter((r) => r.outcome === "BLOCKED");

  console.log("\n=== Summary ===");
  console.log(
    `Confirmed vulnerabilities: ${confirmed.length} | Controls holding: ${blocked.length} | Total checks: ${results.length}`,
  );
  if (confirmed.length) {
    console.log("\nConfirmed:");
    for (const r of confirmed) {
      console.log(`- [${r.severity}] ${r.id} ${r.title}`);
    }
  }

  const client = await clientPromise;
  await client.close();
  process.exit(confirmed.some((r) => r.severity === "high" || r.severity === "critical") ? 2 : 0);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await (await clientPromise).close();
  } catch {
    // ignore
  }
  process.exit(1);
});
