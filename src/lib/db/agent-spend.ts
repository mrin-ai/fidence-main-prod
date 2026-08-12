import type { ObjectId } from "mongodb";

import { toPolicyAmountUsd } from "@/lib/compliance/valuation";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { ensureComplianceIndexes } from "@/lib/db/compliance-indexes";
import type {
  AgentSpendDailyDoc,
  AgentSpendMonthlyDoc,
} from "@/lib/db/compliance-types";
import type { AgentDoc } from "@/lib/db/merchant-types";
import type { PaymentLinkDoc } from "@/lib/db/types";

export function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function utcMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export async function getAgentSpendTotals(
  workspaceId: ObjectId,
  agentId: ObjectId,
  at = new Date(),
) {
  await ensureComplianceIndexes();
  const db = await getDb();
  const day = utcDayKey(at);
  const month = utcMonthKey(at);

  const [daily, monthly] = await Promise.all([
    db.collection<AgentSpendDailyDoc>(COLLECTIONS.agentSpendDaily).findOne({
      workspaceId,
      agentId,
      day,
    }),
    db.collection<AgentSpendMonthlyDoc>(COLLECTIONS.agentSpendMonthly).findOne({
      workspaceId,
      agentId,
      month,
    }),
  ]);

  return {
    day,
    month,
    spentDailyUsd: daily?.amountUsd ?? 0,
    spentMonthlyUsd: monthly?.amountUsd ?? 0,
  };
}

/**
 * Race-safe spend increment. Rejects when daily or monthly would exceed caps.
 * Caps are re-checked in Mongo with conditional updates.
 */
export async function tryIncrementAgentSpend(input: {
  workspaceId: ObjectId;
  agentId: ObjectId;
  amountUsd: number;
  dailySpendCap: number;
  monthlySpendCap: number | null;
  at?: Date;
}): Promise<
  | { ok: true; spentDailyUsd: number; spentMonthlyUsd: number }
  | { ok: false; code: "DAILY_CAP_EXCEEDED" | "MONTHLY_CAP_EXCEEDED" | "SPEND_UPDATE_FAILED" }
> {
  await ensureComplianceIndexes();

  if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0) {
    return { ok: false, code: "SPEND_UPDATE_FAILED" };
  }

  const db = await getDb();
  const at = input.at ?? new Date();
  const day = utcDayKey(at);
  const month = utcMonthKey(at);
  const now = at;

  // Ensure daily doc exists, then conditional $inc under cap.
  await db.collection<AgentSpendDailyDoc>(COLLECTIONS.agentSpendDaily).updateOne(
    { workspaceId: input.workspaceId, agentId: input.agentId, day },
    {
      $setOnInsert: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        day,
        amountUsd: 0,
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  const dailyResult = await db
    .collection<AgentSpendDailyDoc>(COLLECTIONS.agentSpendDaily)
    .findOneAndUpdate(
      {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        day,
        amountUsd: { $lte: input.dailySpendCap - input.amountUsd },
      },
      {
        $inc: { amountUsd: input.amountUsd },
        $set: { updatedAt: now },
      },
      { returnDocument: "after" },
    );

  if (!dailyResult) {
    return { ok: false, code: "DAILY_CAP_EXCEEDED" };
  }

  if (input.monthlySpendCap !== null) {
    await db
      .collection<AgentSpendMonthlyDoc>(COLLECTIONS.agentSpendMonthly)
      .updateOne(
        { workspaceId: input.workspaceId, agentId: input.agentId, month },
        {
          $setOnInsert: {
            workspaceId: input.workspaceId,
            agentId: input.agentId,
            month,
            amountUsd: 0,
            updatedAt: now,
          },
        },
        { upsert: true },
      );

    const monthlyResult = await db
      .collection<AgentSpendMonthlyDoc>(COLLECTIONS.agentSpendMonthly)
      .findOneAndUpdate(
        {
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          month,
          amountUsd: { $lte: input.monthlySpendCap - input.amountUsd },
        },
        {
          $inc: { amountUsd: input.amountUsd },
          $set: { updatedAt: now },
        },
        { returnDocument: "after" },
      );

    if (!monthlyResult) {
      // Roll back daily increment.
      await db.collection<AgentSpendDailyDoc>(COLLECTIONS.agentSpendDaily).updateOne(
        { workspaceId: input.workspaceId, agentId: input.agentId, day },
        {
          $inc: { amountUsd: -input.amountUsd },
          $set: { updatedAt: now },
        },
      );
      return { ok: false, code: "MONTHLY_CAP_EXCEEDED" };
    }

    return {
      ok: true,
      spentDailyUsd: dailyResult.amountUsd,
      spentMonthlyUsd: monthlyResult.amountUsd,
    };
  }

  return {
    ok: true,
    spentDailyUsd: dailyResult.amountUsd,
    spentMonthlyUsd: (
      await db.collection<AgentSpendMonthlyDoc>(COLLECTIONS.agentSpendMonthly).findOne({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        month,
      })
    )?.amountUsd ?? 0,
  };
}

/**
 * Roll back a prior reserve when settlement fails after tryIncrementAgentSpend.
 * Floors at 0 to avoid negative ledgers from races.
 */
export async function decrementAgentSpend(input: {
  workspaceId: ObjectId;
  agentId: ObjectId;
  amountUsd: number;
  at?: Date;
}) {
  await ensureComplianceIndexes();

  if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0) {
    return { ok: false as const };
  }

  const db = await getDb();
  const at = input.at ?? new Date();
  const day = utcDayKey(at);
  const month = utcMonthKey(at);
  const now = at;

  const dailyResult = await db
    .collection<AgentSpendDailyDoc>(COLLECTIONS.agentSpendDaily)
    .updateOne(
      {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        day,
        amountUsd: { $gte: input.amountUsd },
      },
      {
        $inc: { amountUsd: -input.amountUsd },
        $set: { updatedAt: now },
      },
    );

  const monthlyResult = await db
    .collection<AgentSpendMonthlyDoc>(COLLECTIONS.agentSpendMonthly)
    .updateOne(
      {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        month,
        amountUsd: { $gte: input.amountUsd },
      },
      {
        $inc: { amountUsd: -input.amountUsd },
        $set: { updatedAt: now },
      },
    );

  if (dailyResult.modifiedCount === 0 && monthlyResult.modifiedCount === 0) {
    return { ok: false as const, code: "SPEND_ROLLBACK_FAILED" as const };
  }

  return { ok: true as const };
}

/**
 * Sum USD exposure of unpaid pending payment links for an agent.
 * Non-stablecoin pending links contribute 0 here; create already fail-closes those.
 * Includes in-flight create holds so concurrent creates cannot exceed caps.
 */
export async function getAgentOutstandingLinkExposureUsd(
  workspaceId: ObjectId,
  agentId: ObjectId,
) {
  await ensureComplianceIndexes();
  const db = await getDb();
  const now = new Date();

  const [links, agent] = await Promise.all([
    db
      .collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks)
      .find({
        workspaceId,
        agentId,
        status: "pending",
        expiresAt: { $gt: now },
      })
      .project({ amount: 1, tokenId: 1 })
      .toArray(),
    db.collection<AgentDoc>(COLLECTIONS.agents).findOne(
      { _id: agentId, workspaceId },
      { projection: { linkExposureHoldUsd: 1 } },
    ),
  ]);

  let outstandingUsd = 0;
  for (const link of links) {
    const valuation = toPolicyAmountUsd(link.amount, link.tokenId);
    if (valuation.ok) outstandingUsd += valuation.amountUsd;
  }

  const holdUsd = agent?.linkExposureHoldUsd ?? 0;
  if (Number.isFinite(holdUsd) && holdUsd > 0) {
    outstandingUsd += holdUsd;
  }

  return outstandingUsd;
}

/** Reserve in-flight link-create exposure before policy evaluation + insert. */
export async function incrementAgentLinkExposureHold(input: {
  workspaceId: ObjectId;
  agentId: ObjectId;
  amountUsd: number;
}) {
  if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0) {
    return { ok: false as const, code: "EXPOSURE_HOLD_INVALID" as const };
  }

  const db = await getDb();
  const result = await db.collection<AgentDoc>(COLLECTIONS.agents).updateOne(
    { _id: input.agentId, workspaceId: input.workspaceId },
    {
      $inc: { linkExposureHoldUsd: input.amountUsd },
      $set: { updatedAt: new Date() },
    },
  );

  if (result.matchedCount === 0) {
    return { ok: false as const, code: "AGENT_NOT_FOUND" as const };
  }

  return { ok: true as const };
}

/** Release in-flight hold after link insert or when create is denied. */
export async function decrementAgentLinkExposureHold(input: {
  workspaceId: ObjectId;
  agentId: ObjectId;
  amountUsd: number;
}) {
  if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0) {
    return { ok: false as const };
  }

  const db = await getDb();
  const result = await db.collection<AgentDoc>(COLLECTIONS.agents).updateOne(
    {
      _id: input.agentId,
      workspaceId: input.workspaceId,
      linkExposureHoldUsd: { $gte: input.amountUsd },
    },
    {
      $inc: { linkExposureHoldUsd: -input.amountUsd },
      $set: { updatedAt: new Date() },
    },
  );

  return { ok: result.modifiedCount > 0 };
}
