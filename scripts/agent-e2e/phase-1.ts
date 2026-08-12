import {
  fail,
  getAgentE2eConfig,
  merchantFetch,
  pass,
  skip,
} from "./helpers";

export async function runPhase1Tests() {
  const config = getAgentE2eConfig();

  const health = await fetch(`${config.baseUrl}/api/health`);
  if (!health.ok) {
    fail(`Health check failed: ${health.status}`);
  }
  const healthBody = (await health.json()) as { db?: string; redis?: string };
  if (healthBody.db !== "ok") {
    fail(`Health db check failed: ${JSON.stringify(healthBody)}`);
  }
  pass("GET /api/health");

  if (!config.apiKey) {
    skip("PAYAGENT_API_KEY not set — skipping merchant API tests");
    return;
  }

  const catalog = await merchantFetch("/api/v1/compliance/catalog");
  if (!catalog.response.ok) {
    fail(`Compliance catalog failed: ${catalog.response.status}`);
  }
  pass("GET /api/v1/compliance/catalog");

  const bogusPay = await merchantFetch("/api/v1/pay", {
    method: "POST",
    headers: { "Idempotency-Key": `e2e-bogus-${Date.now()}` },
    body: JSON.stringify({
      agentId: "e2e-nonexistent-agent",
      payerAddress: "0x0000000000000000000000000000000000000001",
      txHash: "0x" + "b".repeat(64),
      type: "link",
      linkUsername: "nonexistent-user-e2e",
      linkId: "nonexistent-link",
    }),
  });

  if (bogusPay.response.ok) {
    fail("Bogus pay should not succeed");
  }
  pass("POST /api/v1/pay rejects invalid settlement");

  const preflight = await merchantFetch(
    "/api/v1/pay/preflight?type=profile&agentId=e2e-smoke&username=example&dryRun=1",
  );
  if (preflight.response.status >= 500) {
    fail(`Preflight dry-run failed: ${preflight.response.status}`);
  }
  pass("GET /api/v1/pay/preflight?dryRun=1");
}
