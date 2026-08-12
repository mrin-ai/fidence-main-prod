import { getAgentE2eConfig, merchantFetch, pass, fail, skip } from "./helpers";

export async function runPhase2Tests() {
  const config = getAgentE2eConfig();
  if (!config.apiKey) {
    skip("PAYAGENT_API_KEY not set — skipping Phase 2");
    return;
  }

  const missingKey = await merchantFetch("/api/v1/pay", {
    method: "POST",
    body: JSON.stringify({
      agentId: "e2e-agent",
      payerAddress: "0x0000000000000000000000000000000000000001",
      txHash: "0x" + "c".repeat(64),
      type: "profile",
      recipientUsername: "example",
      amount: 1,
      tokenId: "usdc",
      networkId: "sepolia",
    }),
  });

  if (missingKey.response.status !== 400) {
    fail(`Expected 400 without Idempotency-Key, got ${missingKey.response.status}`);
  }
  const missingBody = missingKey.data as { code?: string };
  if (missingBody.code !== "IDEMPOTENCY_KEY_REQUIRED") {
    fail(`Expected IDEMPOTENCY_KEY_REQUIRED, got ${missingBody.code}`);
  }
  pass("POST /api/v1/pay requires Idempotency-Key");

  const idempotencyKey = `e2e-replay-${Date.now()}`;
  const payload = {
    agentId: "e2e-agent",
    payerAddress: "0x0000000000000000000000000000000000000001",
    txHash: "0x" + "d".repeat(64),
    type: "profile",
    recipientUsername: "example",
    amount: 1,
    tokenId: "usdc",
    networkId: "sepolia",
  };

  const first = await merchantFetch("/api/v1/pay", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });

  const second = await merchantFetch("/api/v1/pay", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });

  if (first.response.status !== second.response.status) {
    fail("Idempotency replay returned different status codes");
  }
  pass("Idempotency-Key replay returns cached response status");
}
