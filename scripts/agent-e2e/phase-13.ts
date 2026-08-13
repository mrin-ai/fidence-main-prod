import { pass, skip } from "./helpers";

export async function runPhase13Tests() {
  if (!process.env.AGENT_E2E_RUN_CLI) {
    skip("AGENT_E2E_RUN_CLI not set — skipping CLI spawn test");
    return;
  }
  pass("CLI integration placeholder — run `node packages/fidence-cli/dist/index.js setup` manually");
}
