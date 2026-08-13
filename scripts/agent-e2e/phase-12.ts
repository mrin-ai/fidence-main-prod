import { fail, pass, publicFetch, sessionFetch, skip } from "./helpers";

export async function runPhase12Tests() {
  const scopedKey = process.env.AGENT_E2E_SCOPED_KEY ?? "";
  if (!scopedKey) {
    skip("AGENT_E2E_SCOPED_KEY not set");
    return;
  }
  if (!process.env.AGENT_E2E_SESSION_TOKEN) {
    skip("AGENT_E2E_SESSION_TOKEN not set");
    return;
  }

  const create = await publicFetch("/api/v1/payment-intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${scopedKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `e2e-intent-${Date.now()}`,
    },
    body: JSON.stringify({
      type: "profile",
      recipientUsername: "example",
      amount: 1,
      tokenId: "usdc",
      networkId: "base",
    }),
  });

  if (!create.response.ok) {
    fail(`Create payment intent failed: ${create.response.status} ${JSON.stringify(create.data)}`);
  }

  const created = create.data as { intent?: { intentId?: string } };
  const intentId = created.intent?.intentId;
  if (!intentId) {
    fail("Missing intentId");
  }
  pass("POST /api/v1/payment-intents");

  const reject = await sessionFetch(`/api/pay/payment-intents/${intentId}`, {
    method: "POST",
    body: JSON.stringify({ action: "reject" }),
  });
  if (!reject.response.ok) {
    fail(`Reject intent failed: ${reject.response.status}`);
  }
  pass("POST /api/pay/payment-intents/:id reject");

  const poll = await publicFetch(`/api/v1/payment-intents/${intentId}/poll`, {
    headers: { Authorization: `Bearer ${scopedKey}` },
  });
  const pollBody = poll.data as { status?: string };
  if (pollBody.status !== "rejected") {
    fail(`Expected rejected status, got ${pollBody.status}`);
  }
  pass("GET /api/v1/payment-intents/:id/poll rejected");
}
