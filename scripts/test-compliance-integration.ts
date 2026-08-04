/**
 * Compliance integration smoke checks (requires MONGODB_URI).
 *
 * Usage:
 *   npm run test:compliance
 */

import { ObjectId } from "mongodb";

import { evaluatePolicy } from "../src/lib/compliance/evaluate-policy";
import { POLICY_CODES } from "../src/lib/compliance/codes";
import { actorFromSecurity } from "../src/lib/compliance/actor";
import { clientPromise, getDb } from "../src/lib/db/client";
import { COLLECTIONS } from "../src/lib/db/collections";
import { ensureComplianceIndexes } from "../src/lib/db/compliance-indexes";
import { recordPolicyDecision } from "../src/lib/db/policy-decisions";
import { tryIncrementAgentSpend, getAgentSpendTotals } from "../src/lib/db/agent-spend";

async function main() {
  await ensureComplianceIndexes();
  const db = await getDb();

  const workspaceId = new ObjectId();
  const agentId = new ObjectId();

  const actor = actorFromSecurity(
    {
      ip: "198.51.100.20",
      userAgent: "compliance-integration-test",
      device: "test",
      browser: "test",
      timestamp: new Date(),
      date: new Date().toISOString().slice(0, 10),
    },
    {
      actorType: "agent",
      agentId: agentId.toString(),
      agentPublicId: "agt_test",
      externalAgentId: "compliance-test-agent",
    },
  );

  if (!actor.ip) {
    throw new Error("actor.ip must be present");
  }

  const { receiptId } = await recordPolicyDecision({
    workspaceId,
    action: "pay.link",
    verdict: "deny",
    codes: [POLICY_CODES.NO_ACTIVE_POLICY],
    agentId,
    agentPublicId: "agt_test",
    externalAgentId: "compliance-test-agent",
    actor,
  });

  const stored = await db.collection(COLLECTIONS.policyDecisions).findOne({
    receiptId,
  });
  if (!stored?.actor?.ip) {
    throw new Error("decision missing actor.ip");
  }

  const first = await tryIncrementAgentSpend({
    workspaceId,
    agentId,
    amountUsd: 80,
    dailySpendCap: 100,
    monthlySpendCap: 500,
  });
  if (!first.ok) throw new Error("first spend should succeed");

  const second = await tryIncrementAgentSpend({
    workspaceId,
    agentId,
    amountUsd: 30,
    dailySpendCap: 100,
    monthlySpendCap: 500,
  });
  if (second.ok || second.code !== "DAILY_CAP_EXCEEDED") {
    throw new Error("second spend should hit daily cap");
  }

  const totals = await getAgentSpendTotals(workspaceId, agentId);
  if (totals.spentDailyUsd !== 80) {
    throw new Error(`expected daily 80, got ${totals.spentDailyUsd}`);
  }

  const denied = evaluatePolicy({
    agentStatus: "active",
    action: "pay.link",
    amountUsd: 10,
    networkId: "base",
    tokenId: "usdc",
    policy: null,
    spentDailyUsd: totals.spentDailyUsd,
    spentMonthlyUsd: totals.spentMonthlyUsd,
  });
  if (denied.codes[0] !== POLICY_CODES.NO_ACTIVE_POLICY) {
    throw new Error("expected NO_ACTIVE_POLICY");
  }

  // Cleanup test docs
  await Promise.all([
    db.collection(COLLECTIONS.policyDecisions).deleteMany({ workspaceId }),
    db.collection(COLLECTIONS.agentSpendDaily).deleteMany({ workspaceId }),
    db.collection(COLLECTIONS.agentSpendMonthly).deleteMany({ workspaceId }),
  ]);

  console.log("Compliance integration checks passed");
  console.log(`  receiptId=${receiptId}`);
  console.log(`  actor.ip=${stored.actor.ip}`);

  const client = await clientPromise;
  await client.close();
  process.exit(0);
}

main().catch(async (error) => {
  console.error(error);
  try {
    const client = await clientPromise;
    await client.close();
  } catch {
    // ignore close errors on failure path
  }
  process.exit(1);
});
