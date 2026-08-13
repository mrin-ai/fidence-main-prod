import { fail, pass, sessionFetch, skip } from "./helpers";

export async function runPhase10Tests() {
  if (!process.env.AGENT_E2E_SESSION_TOKEN) {
    skip("AGENT_E2E_SESSION_TOKEN not set — skipping mandates");
    return;
  }

  const agents = await sessionFetch("/api/pay/linked-agents");
  if (!agents.response.ok) {
    fail(`List linked agents failed: ${agents.response.status}`);
  }

  const list = agents.data as { agents?: Array<{ id: string }> };
  if (!list.agents?.length) {
    skip("No linked agents — run phase 8 approve first");
    return;
  }

  const agentId = list.agents[0].id;
  const put = await sessionFetch(`/api/pay/mandates/${agentId}`, {
    method: "PUT",
    body: JSON.stringify({
      status: "active",
      maxAmountPerPayment: 25,
      dailySpendCap: 100,
      monthlySpendCap: 500,
      allowedNetworkIds: ["base"],
      allowedTokenIds: ["usdc"],
      allowCreatePaymentLinks: true,
      allowPay: true,
      requireApprovalAbove: 50,
    }),
  });

  if (!put.response.ok) {
    fail(`PUT mandate failed: ${put.response.status} ${JSON.stringify(put.data)}`);
  }
  pass("PUT /api/pay/mandates/:agentId");

  const get = await sessionFetch(`/api/pay/mandates/${agentId}`);
  if (!get.response.ok) {
    fail(`GET mandate failed: ${get.response.status}`);
  }
  pass("GET /api/pay/mandates/:agentId");
}
