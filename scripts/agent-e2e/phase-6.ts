import { getAgentE2eConfig, merchantFetch, pass, fail, skip } from "./helpers";

export async function runPhase6Tests() {
  const config = getAgentE2eConfig();

  const docs = await fetch(`${config.baseUrl}/docs`);
  if (!docs.ok) {
    fail(`GET /docs failed: ${docs.status}`);
  }
  pass("GET /docs");

  const openapi = await fetch(`${config.baseUrl}/api/v1/openapi.json`);
  if (!openapi.ok) {
    fail(`GET /api/v1/openapi.json failed: ${openapi.status}`);
  }
  const spec = (await openapi.json()) as { openapi?: string; paths?: Record<string, unknown> };
  if (!spec.openapi || !spec.paths || Object.keys(spec.paths).length < 10) {
    fail("OpenAPI spec missing paths");
  }
  pass("GET /api/v1/openapi.json");

  if (!config.apiKey) {
    skip("PAYAGENT_API_KEY not set — skipping Phase 6 merchant API reads");
    return;
  }

  const links = await merchantFetch("/api/v1/payment-links?limit=1");
  if (!links.response.ok) {
    fail(`GET /api/v1/payment-links failed: ${links.response.status}`);
  }
  pass("GET /api/v1/payment-links");

  const agents = await merchantFetch("/api/v1/compliance/agents");
  if (!agents.response.ok) {
    fail(`GET /api/v1/compliance/agents failed: ${agents.response.status}`);
  }
  pass("GET /api/v1/compliance/agents");
}
