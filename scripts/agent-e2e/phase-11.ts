import { fail, merchantFetch, pass, skip } from "./helpers";

export async function runPhase11Tests() {
  const scopedKey = process.env.AGENT_E2E_SCOPED_KEY ?? "";
  if (!scopedKey) {
    skip("AGENT_E2E_SCOPED_KEY not set — run phase 8 and export key");
    return;
  }

  if (!process.env.PAYAGENT_API_KEY) {
    skip("PAYAGENT_API_KEY not set");
    return;
  }

  const scopedAgents = await merchantFetch("/api/v1/agents/e2e-other-agent", {
    apiKey: scopedKey,
  });
  if (scopedAgents.response.ok) {
    fail("Scoped key should not read unrelated agent profile");
  }
  pass("Scoped key denied for other agent routes");

  const workspaceAgents = await merchantFetch("/api/v1/compliance/catalog");
  if (!workspaceAgents.response.ok) {
    fail("Workspace key should still access compliance catalog");
  }
  pass("Workspace key still works");
}
