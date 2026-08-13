/**
 * Agent payment E2E test runner.
 *
 * Usage:
 *   npm run test:agent-e2e -- --phase=1
 *   npm run test:agent-e2e:all
 *   AGENT_E2E_MAINNET=1 npm run test:agent-e2e -- --phase=7
 */

import { runPhase1Tests } from "./phase-1";
import { runPhase2Tests } from "./phase-2";
import { runPhase3Tests } from "./phase-3";
import { runPhase4Tests } from "./phase-4";
import { runPhase5Tests } from "./phase-5";
import { runPhase6Tests } from "./phase-6";
import { runPhase7Tests } from "./phase-7";
import { runPhase8Tests } from "./phase-8";
import { runPhase9Tests } from "./phase-9";
import { runPhase10Tests } from "./phase-10";
import { runPhase11Tests } from "./phase-11";
import { runPhase12Tests } from "./phase-12";
import { runPhase13Tests } from "./phase-13";
import { runPhase14Tests } from "./phase-14";
import { runPhase15Tests } from "./phase-15";
import { runPhase16Tests } from "./phase-16";
import { loadAgentE2eEnv, parseCliArgs } from "./helpers";

type PhaseRunner = {
  phase: number;
  name: string;
  run: () => Promise<void>;
};

const phases: PhaseRunner[] = [
  { phase: 1, name: "Production infrastructure and settlement", run: runPhase1Tests },
  { phase: 2, name: "Idempotency and payment safety", run: runPhase2Tests },
  { phase: 3, name: "Webhooks", run: runPhase3Tests },
  { phase: 4, name: "Programmatic approvals", run: runPhase4Tests },
  { phase: 5, name: "Agent wallet verification", run: runPhase5Tests },
  { phase: 6, name: "Read APIs and DX", run: runPhase6Tests },
  { phase: 7, name: "ETH/SOL valuation and readiness gate", run: runPhase7Tests },
  { phase: 8, name: "Agent link sessions", run: runPhase8Tests },
  { phase: 9, name: "Saved addresses", run: runPhase9Tests },
  { phase: 10, name: "Pay mandates", run: runPhase10Tests },
  { phase: 11, name: "Scoped agent key isolation", run: runPhase11Tests },
  { phase: 12, name: "Payment intents", run: runPhase12Tests },
  { phase: 13, name: "CLI integration", run: runPhase13Tests },
  { phase: 14, name: "Full linked-agent pay path", run: runPhase14Tests },
  { phase: 15, name: "CLI fidence pay smoke", run: runPhase15Tests },
  { phase: 16, name: "Feature flag", run: runPhase16Tests },
];

async function main() {
  loadAgentE2eEnv();
  const { phase, all } = parseCliArgs(process.argv.slice(2));
  const selected = all
    ? phases
    : phases.filter((item) => item.phase === phase);

  if (selected.length === 0) {
    console.error("Specify --phase=1..16 or --all");
    process.exit(1);
  }

  console.log(`Agent E2E runner — ${selected.length} phase(s)`);
  for (const item of selected) {
    console.log(`\n=== Phase ${item.phase}: ${item.name} ===`);
    await item.run();
    console.log(`Phase ${item.phase} complete`);
  }

  console.log("\nAll selected phases finished.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
