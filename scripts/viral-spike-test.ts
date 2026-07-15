/**
 * Viral spike load test — simulates N brand-new visitors arriving every second.
 * Each visitor makes one request (or a short journey), then leaves. No request loops.
 *
 * Usage:
 *   npm run test:viral
 *   BASE_URL=https://www.payagent.co SPIKE_USERNAME=mrinal SPIKE_LINK_ID=1bf8eceece44 npm run test:viral
 *
 * Env:
 *   BASE_URL              — target (default: http://localhost:3000)
 *   SPIKE_USERNAME        — merchant username (default: mrinal)
 *   SPIKE_LINK_ID         — payment link public id (default: 1bf8eceece44)
 *   SPIKE_ARRIVALS_PER_SEC — new visitors per second (default: 1000)
 *   SPIKE_DURATION_SEC    — how many seconds to sustain arrival rate (default: 10)
 *   SPIKE_MODE            — page | journey (default: journey)
 *                         page = HTML only; journey = HTML + payment link API
 */

import { performance } from "node:perf_hooks";

const BASE_URL =
  process.env.BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const USERNAME = (process.env.SPIKE_USERNAME ?? "mrinal").toLowerCase();
const LINK_ID = process.env.SPIKE_LINK_ID ?? "1bf8eceece44";
const ARRIVALS_PER_SEC = Number(process.env.SPIKE_ARRIVALS_PER_SEC ?? 1000);
const DURATION_SEC = Number(process.env.SPIKE_DURATION_SEC ?? 10);
const MODE = process.env.SPIKE_MODE ?? "journey";

type Sample = {
  ok: boolean;
  status: number;
  ms: number;
  kind: string;
};

type SecondBucket = {
  second: number;
  launched: number;
  completed: number;
  errors: number;
};

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, index)];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOnce(path: string, accept: string): Promise<Sample> {
  const started = performance.now();
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: accept },
    });
    return {
      ok: response.ok,
      status: response.status,
      ms: performance.now() - started,
      kind: path,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      ms: performance.now() - started,
      kind: path,
    };
  }
}

async function visitorJourney(onComplete: (samples: Sample[]) => void) {
  const pagePath = `/${USERNAME}/${LINK_ID}`;
  const apiPath = `/api/pay/${USERNAME}/${LINK_ID}`;

  if (MODE === "page") {
    onComplete([await fetchOnce(pagePath, "text/html")]);
    return;
  }

  const page = await fetchOnce(pagePath, "text/html");
  const api = await fetchOnce(apiPath, "application/json");
  onComplete([page, api]);
}

async function main() {
  const samples: Sample[] = [];
  const buckets: SecondBucket[] = [];
  let inFlight = 0;
  let peakConcurrent = 0;
  let peakConcurrentAtSec = 0;

  const pagePath = `/${USERNAME}/${LINK_ID}`;
  const requestsPerVisitor = MODE === "page" ? 1 : 2;

  console.log(`\nPayAgent viral spike test — ${BASE_URL}`);
  console.log(
    `Arrival rate: ${ARRIVALS_PER_SEC} new visitors/sec for ${DURATION_SEC}s`,
  );
  console.log(`Mode: ${MODE} (${requestsPerVisitor} request(s) per visitor)`);
  console.log(`Payment link: ${pagePath}`);
  console.log(
    `Expected total visitors: ${ARRIVALS_PER_SEC * DURATION_SEC} (~${ARRIVALS_PER_SEC * DURATION_SEC * requestsPerVisitor} requests)\n`,
  );

  const testStart = performance.now();

  for (let second = 0; second < DURATION_SEC; second++) {
    const bucket: SecondBucket = {
      second: second + 1,
      launched: 0,
      completed: 0,
      errors: 0,
    };
    buckets.push(bucket);

    const secondStart = performance.now();

    for (let i = 0; i < ARRIVALS_PER_SEC; i++) {
      bucket.launched++;
      inFlight++;
      if (inFlight > peakConcurrent) {
        peakConcurrent = inFlight;
        peakConcurrentAtSec = second + 1;
      }

      void visitorJourney((visitorSamples) => {
        for (const sample of visitorSamples) {
          samples.push(sample);
          if (!sample.ok) bucket.errors++;
        }
        bucket.completed++;
        inFlight--;
      });
    }

    const elapsedInSecond = performance.now() - secondStart;
    const waitMs = Math.max(0, 1000 - elapsedInSecond);
    if (waitMs > 0) await sleep(waitMs);

    process.stdout.write(
      `  sec ${String(second + 1).padStart(2)}: launched ${bucket.launched}, in-flight ${inFlight}, visitors done ${bucket.completed}, req errors ${bucket.errors}\n`,
    );
  }

  process.stdout.write("\n  waiting for stragglers...");
  const drainStart = performance.now();
  while (inFlight > 0 && performance.now() - drainStart < 120_000) {
    await sleep(250);
  }
  console.log(inFlight > 0 ? ` timed out (${inFlight} still in-flight)` : " done");

  const totalElapsedSec = (performance.now() - testStart) / 1000;
  const latencies = samples.map((s) => s.ms).sort((a, b) => a - b);
  const success = samples.filter((s) => s.ok).length;
  const errors = samples.length - success;
  const visitorsLaunched = ARRIVALS_PER_SEC * DURATION_SEC;
  const achievedArrivalRps = visitorsLaunched / DURATION_SEC;

  const byKind = new Map<string, Sample[]>();
  for (const sample of samples) {
    const key = sample.kind.includes("/api/") ? "api" : "page";
    const list = byKind.get(key) ?? [];
    list.push(sample);
    byKind.set(key, list);
  }

  console.log("\n══════════════════════════════════════════════════════");
  console.log("VIRAL SPIKE RESULTS");
  console.log("══════════════════════════════════════════════════════");
  console.log(`  Visitors launched:     ${visitorsLaunched}`);
  console.log(`  Requests completed:    ${samples.length}`);
  console.log(`  Test wall time:        ${totalElapsedSec.toFixed(1)}s`);
  console.log(`  Arrival rate (target): ${ARRIVALS_PER_SEC}/sec`);
  console.log(`  Arrival rate (achieved): ${achievedArrivalRps.toFixed(0)}/sec`);
  console.log(`  Peak concurrent:       ${peakConcurrent} (at second ${peakConcurrentAtSec})`);
  console.log(`  Error rate:            ${samples.length ? ((errors / samples.length) * 100).toFixed(2) : "0.00"}%`);
  console.log(`  p50 / p95 / p99 / max: ${percentile(latencies, 50).toFixed(0)} / ${percentile(latencies, 95).toFixed(0)} / ${percentile(latencies, 99).toFixed(0)} / ${(latencies[latencies.length - 1] ?? 0).toFixed(0)} ms`);

  for (const [kind, kindSamples] of byKind) {
    const kindLat = kindSamples.map((s) => s.ms).sort((a, b) => a - b);
    const kindErr = kindSamples.filter((s) => !s.ok).length;
    console.log(
      `\n  ${kind.toUpperCase()}: ${kindSamples.length} reqs, err ${((kindErr / kindSamples.length) * 100).toFixed(2)}%, p95 ${percentile(kindLat, 95).toFixed(0)}ms`,
    );
  }

  const statusCounts = new Map<number, number>();
  for (const sample of samples) {
    statusCounts.set(sample.status, (statusCounts.get(sample.status) ?? 0) + 1);
  }
  if (statusCounts.size > 0) {
    console.log("\n  Status codes:");
    for (const [status, count] of [...statusCounts.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`    ${status}: ${count}`);
    }
  }

  const healthy =
    errors / Math.max(samples.length, 1) < 0.01 &&
    percentile(latencies, 95) < 5000 &&
    samples.length >= visitorsLaunched * requestsPerVisitor * 0.95;

  console.log("\n  Verdict:");
  if (healthy) {
    console.log(
      `    PASS — sustained ${ARRIVALS_PER_SEC} new visitors/sec for ${DURATION_SEC}s with <1% errors`,
    );
  } else {
    console.log(
      `    FAIL — errors, timeouts, or p95 too high for ${ARRIVALS_PER_SEC}/sec viral spike`,
    );
  }
  console.log("");

  if (!healthy) process.exit(1);
}

main().catch((error) => {
  console.error("Viral spike test failed:", error);
  process.exit(1);
});
