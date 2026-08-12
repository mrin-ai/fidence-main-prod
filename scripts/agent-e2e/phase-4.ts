import { getAgentE2eConfig, merchantFetch, pass, fail, skip } from "./helpers";

export async function runPhase4Tests() {
  const config = getAgentE2eConfig();
  if (!config.apiKey) {
    skip("PAYAGENT_API_KEY not set — skipping Phase 4");
    return;
  }

  const approvals = await merchantFetch("/api/v1/compliance/approvals?limit=5");
  if (!approvals.response.ok) {
    fail(`GET /api/v1/compliance/approvals failed: ${approvals.response.status}`);
  }
  pass("GET /api/v1/compliance/approvals");

  const fakeApprove = await merchantFetch(
    "/api/v1/compliance/approvals/apr_nonexistent/approve",
    { method: "POST" },
  );
  if (fakeApprove.response.status !== 403 && fakeApprove.response.status !== 404) {
    fail(
      `Expected 403/404 for approve without admin key or missing approval, got ${fakeApprove.response.status}`,
    );
  }
  pass("POST approve route is permission-gated or returns not found");
}
