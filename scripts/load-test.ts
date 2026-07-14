/**
 * PayAgent load test — measures throughput and latency under concurrent users.
 *
 * Usage:
 *   npm run test:load
 *   BASE_URL=https://payagent.co LOAD_MAX_USERS=200 npm run test:load
 *
 * Env:
 *   BASE_URL          — target (default: http://localhost:3000)
 *   E2E_USERNAME      — test merchant (default: referealtest)
 *   E2E_LINK_ID       — payment link id (auto-discovered from DB if unset)
 *   LOAD_MAX_USERS    — highest concurrency step (default: 100)
 *   LOAD_STEP         — concurrency increment per step (default: 10)
 *   LOAD_DURATION_SEC — seconds per step (default: 8)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { getDb } from "../src/lib/db/client";
import { COLLECTIONS } from "../src/lib/db/collections";
import type { PaymentLinkDoc } from "../src/lib/db/types";

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

const BASE_URL = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const E2E_USERNAME = (process.env.E2E_USERNAME ?? "referealtest").toLowerCase();
const MAX_USERS = Number(process.env.LOAD_MAX_USERS ?? 100);
const STEP = Number(process.env.LOAD_STEP ?? 10);
const DURATION_SEC = Number(process.env.LOAD_DURATION_SEC ?? 8);

type Scenario = {
  id: string;
  label: string;
  path: string;
};

type RequestSample = {
  ok: boolean;
  status: number;
  ms: number;
};

type StepResult = {
  scenario: string;
  concurrency: number;
  total: number;
  success: number;
  errors: number;
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  errorRate: number;
};

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, index)];
}

async function discoverLinkId() {
  if (process.env.E2E_LINK_ID) return process.env.E2E_LINK_ID;

  const db = await getDb();
  const link = await db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).findOne(
    { username: E2E_USERNAME, status: "pending" },
    { sort: { createdAt: -1 }, projection: { publicId: 1 } },
  );
  return link?.publicId ?? "7250a9af9c9f";
}

async function runWorker(
  scenario: Scenario,
  stopAt: number,
  sink: RequestSample[],
) {
  while (performance.now() < stopAt) {
    const started = performance.now();
    try {
      const response = await fetch(`${BASE_URL}${scenario.path}`, {
        headers: { Accept: "application/json" },
      });
      const ms = performance.now() - started;
      sink.push({ ok: response.ok, status: response.status, ms });
    } catch {
      const ms = performance.now() - started;
      sink.push({ ok: false, status: 0, ms });
    }
  }
}

async function runStep(scenario: Scenario, concurrency: number) {
  const samples: RequestSample[] = [];
  const started = performance.now();
  const stopAt = started + DURATION_SEC * 1000;

  const workers = Array.from({ length: concurrency }, () =>
    runWorker(scenario, stopAt, samples),
  );
  await Promise.all(workers);

  const elapsedSec = (performance.now() - started) / 1000;
  const latencies = samples.map((s) => s.ms).sort((a, b) => a - b);
  const success = samples.filter((s) => s.ok).length;
  const errors = samples.length - success;

  return {
    scenario: scenario.id,
    concurrency,
    total: samples.length,
    success,
    errors,
    rps: samples.length / elapsedSec,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: latencies[latencies.length - 1] ?? 0,
    errorRate: samples.length ? (errors / samples.length) * 100 : 0,
  } satisfies StepResult;
}

function printTable(rows: StepResult[]) {
  const header =
    "Concurrency  Requests   RPS     Err%    p50     p95     p99     max";
  console.log(header);
  console.log("-".repeat(header.length));

  for (const row of rows) {
    const line = [
      String(row.concurrency).padStart(11),
      String(row.total).padStart(10),
      row.rps.toFixed(1).padStart(7),
      `${row.errorRate.toFixed(1)}%`.padStart(7),
      `${row.p50.toFixed(0)}ms`.padStart(7),
      `${row.p95.toFixed(0)}ms`.padStart(7),
      `${row.p99.toFixed(0)}ms`.padStart(7),
      `${row.max.toFixed(0)}ms`.padStart(7),
    ].join("  ");
    console.log(line);
  }
}

function estimateCapacity(rows: StepResult[]) {
  const healthy = rows.filter((r) => r.errorRate < 1 && r.p95 < 3000);
  if (healthy.length === 0) {
    return { concurrentUsers: 0, rps: 0, note: "errors or high latency at lowest step" };
  }

  const best = healthy[healthy.length - 1];
  return {
    concurrentUsers: best.concurrency,
    rps: best.rps,
    p95: best.p95,
    note: "last step with <1% errors and p95 < 3s",
  };
}

async function main() {
  const linkId = await discoverLinkId();

  const scenarios: Scenario[] = [
    { id: "health", label: "Health check", path: "/api/health" },
    {
      id: "payment-link",
      label: "Payment link API",
      path: `/api/pay/${E2E_USERNAME}/${linkId}`,
    },
    {
      id: "public-profile",
      label: "Public profile API",
      path: `/api/public/users/${E2E_USERNAME}`,
    },
    {
      id: "pay-page",
      label: "Payment page (HTML)",
      path: `/${E2E_USERNAME}/${linkId}`,
    },
  ];

  console.log(`\nPayAgent load test — ${BASE_URL}`);
  console.log(`Duration per step: ${DURATION_SEC}s | Steps: ${STEP} → ${MAX_USERS} concurrent users`);
  console.log(`Payment link: /${E2E_USERNAME}/${linkId}\n`);

  const allResults: StepResult[] = [];

  for (const scenario of scenarios) {
    console.log(`\n▶ ${scenario.label} (${scenario.path})`);
    const rows: StepResult[] = [];

    for (let concurrency = STEP; concurrency <= MAX_USERS; concurrency += STEP) {
      process.stdout.write(`  testing ${concurrency} users...`);
      const result = await runStep(scenario, concurrency);
      rows.push(result);
      allResults.push(result);
      process.stdout.write(
        ` ${result.rps.toFixed(0)} req/s, p95 ${result.p95.toFixed(0)}ms, err ${result.errorRate.toFixed(1)}%\n`,
      );

      if (result.errorRate >= 5 || result.p95 >= 5000) {
        console.log(`  ⚠ stopping ramp — errors or latency too high`);
        break;
      }
    }

    printTable(rows);
    const capacity = estimateCapacity(rows);
    console.log(
      `\n  Estimated comfortable load: ~${capacity.concurrentUsers} concurrent users (~${capacity.rps.toFixed(0)} req/s, p95 ${capacity.p95?.toFixed(0) ?? "?"}ms)`,
    );
  }

  const paymentRows = allResults.filter((r) => r.scenario === "payment-link");
  const payCapacity = estimateCapacity(paymentRows);

  console.log("\n══════════════════════════════════════════════════════");
  console.log("SUMMARY (payment link API — payer checkout path)");
  console.log("══════════════════════════════════════════════════════");
  console.log(`  Comfortable concurrent payers:  ~${payCapacity.concurrentUsers}`);
  console.log(`  Throughput at that level:     ~${payCapacity.rps.toFixed(0)} requests/sec`);
  console.log(`  p95 latency at that level:    ~${payCapacity.p95?.toFixed(0) ?? "?"} ms`);

  const healthRows = allResults.filter((r) => r.scenario === "health");
  const healthBest = estimateCapacity(healthRows);
  console.log(`\n  Health endpoint headroom:     ~${healthBest.concurrentUsers} users (~${healthBest.rps.toFixed(0)} req/s)`);

  console.log("\nNotes:");
  console.log("  • Local dev (single Next.js process) ≠ production Vercel + MongoDB server.");
  console.log("  • POST /api/pay is rate-limited (10/min per IP) — not included in this read load test.");
  console.log("  • Run against production: BASE_URL=https://payagent.co npm run test:load");
  console.log("");
}

main().catch((error) => {
  console.error("Load test failed:", error);
  process.exit(1);
});
