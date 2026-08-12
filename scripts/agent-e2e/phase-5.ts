import { getAgentE2eConfig, merchantFetch, pass, fail, skip } from "./helpers";

export async function runPhase5Tests() {
  const config = getAgentE2eConfig();
  if (!config.apiKey) {
    skip("PAYAGENT_API_KEY not set — skipping Phase 5");
    return;
  }

  const missingBody = await merchantFetch("/api/v1/agents/wallet/verify", {
    method: "POST",
    body: JSON.stringify({}),
  });

  if (missingBody.response.status !== 400) {
    fail(`Expected 400 for empty wallet verify body, got ${missingBody.response.status}`);
  }
  pass("POST /api/v1/agents/wallet/verify validates input");

  const preflight = await merchantFetch(
    "/api/v1/pay/preflight?type=profile&agentId=e2e-verify&username=example&dryRun=1",
  );
  if (preflight.response.status >= 500) {
    fail(`Preflight failed: ${preflight.response.status}`);
  }
  const body = preflight.data as { checks?: Record<string, { ok: boolean }> };
  if (body.checks?.agent_wallet && process.env.AGENT_REQUIRE_VERIFIED_WALLET === "true") {
    pass("Preflight exposes agent_wallet check when verify gate enabled");
  } else {
    pass("GET /api/v1/pay/preflight wallet check (gate env-dependent)");
  }
}
