import { getAgentE2eConfig, merchantFetch, pass, skip, fail } from "./helpers";

export async function runPhase7Tests() {
  const config = getAgentE2eConfig();

  const health = await fetch(`${config.baseUrl}/api/health`);
  if (!health.ok) {
    fail(`Health check failed: ${health.status}`);
  }
  const healthBody = (await health.json()) as {
    db?: string;
    settlement_sepolia?: string;
  };
  if (healthBody.db !== "ok") {
    fail("Health db check failed");
  }
  if (healthBody.settlement_sepolia) {
    pass("GET /api/health includes settlement probes");
  } else {
    pass("GET /api/health ok");
  }

  if (config.mainnetSmoke) {
    if (!config.apiKey) {
      skip("PAYAGENT_API_KEY not set — skipping mainnet preflight smoke");
      return;
    }

    const preflight = await merchantFetch(
      "/api/v1/pay/preflight?type=profile&agentId=smoke&username=example&dryRun=1",
    );
    if (preflight.response.status >= 500) {
      fail(`Mainnet preflight smoke failed: ${preflight.response.status}`);
    }
    pass("Mainnet preflight smoke (read-only dry-run)");
    return;
  }

  if (!config.apiKey) {
    skip("PAYAGENT_API_KEY not set — skipping valuation API checks");
    return;
  }

  const catalog = await merchantFetch("/api/v1/compliance/catalog");
  if (!catalog.response.ok) {
    fail(`Compliance catalog failed: ${catalog.response.status}`);
  }
  pass("Compliance catalog available for ETH/SOL cap configuration");
}
