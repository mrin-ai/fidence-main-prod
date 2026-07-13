/**
 * Test Merchant Commerce agent API with two workspace API keys.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const ACCOUNTS = [
  {
    label: "Work profile (mrinal)",
    apiKey: process.env.FIDENCE_TEST_API_KEY_WORK ?? "",
    agentId: "checkout-agent-mrinal",
    agentName: "Mrinal Checkout Agent",
    walletAddress: "0x518b9aba7586542e611909799f6d0b81e9552d9b",
    networkId: "sepolia",
  },
  {
    label: "Ritesh profile (referealtest)",
    apiKey: process.env.FIDENCE_TEST_API_KEY_RITESH ?? "",
    agentId: "checkout-agent-ritesh",
    agentName: "Ritesh Checkout Agent",
    walletAddress: "0xdbe66012ed37caff6663b8db874a810689df6811",
    networkId: "sepolia",
  },
] as const;

async function apiCall(
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
  method = "POST",
) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "PayAgentAgentTest/1.0",
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

function expiresInDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

async function testAccount(account: (typeof ACCOUNTS)[number]) {
  console.log(`\n=== ${account.label} ===`);

  const registerResult = await apiCall(account.apiKey, "/api/v1/agents/register", {
    agentId: account.agentId,
    agentName: account.agentName,
  });
  console.log("Register agent:", registerResult.status, registerResult.data);

  const walletResult = await apiCall(account.apiKey, "/api/v1/agents/wallet", {
    agentId: account.agentId,
    walletAddress: account.walletAddress,
    networkId: account.networkId,
  });
  console.log("Add wallet:", walletResult.status, walletResult.data);

  const profileResult = await apiCall(
    account.apiKey,
    `/api/v1/agents/profile?agentId=${encodeURIComponent(account.agentId)}`,
    {},
    "GET",
  );
  console.log("Agent profile:", profileResult.status, profileResult.data);

  const linkResult = await apiCall(account.apiKey, "/api/v1/payment-links", {
    agentId: account.agentId,
    amount: 1,
    tokenId: "usdc",
    networkId: account.networkId,
    expiresAt: expiresInDays(7),
  });
  console.log("Create payment link:", linkResult.status, linkResult.data);
}

async function main() {
  console.log(`Testing against ${BASE_URL}`);

  const missing = ACCOUNTS.filter((account) => !account.apiKey);
  if (missing.length > 0) {
    console.error(
      "Set FIDENCE_TEST_API_KEY_WORK and FIDENCE_TEST_API_KEY_RITESH in your environment.",
    );
    process.exit(1);
  }

  for (const account of ACCOUNTS) {
    await testAccount(account);
  }

  console.log("\nDone. Check /merchant/agents and Payment Links → Agent mode in the app.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
