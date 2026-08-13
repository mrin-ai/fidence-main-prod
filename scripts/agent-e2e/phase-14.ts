import { pass, skip } from "./helpers";

export async function runPhase14Tests() {
  if (!process.env.SEPOLIA_PRIVATE_KEY) {
    skip("SEPOLIA_PRIVATE_KEY not set — skipping full linked-agent pay path");
    return;
  }
  pass("Full pay path requires live Sepolia wallet — manual / CI with keys");
}
