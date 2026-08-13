/**
 * Unit tests for leaderboard, PAYAGENT oracle/token helpers, and route guards.
 *
 * Usage:
 *   npm run test:unit
 */

import {
  capLeaderboardLimit,
  compareLeaderboardEntries,
  sortLeaderboardEntries,
} from "../src/lib/agent-leaderboard-rank";
import {
  formatOracleUsdPrice,
  PAYAGENT_ORACLE_ADDRESS,
  PAYAGENT_ORACLE_PRICE_DECIMALS,
  tokenUsdValue,
} from "../src/lib/payagent-oracle";
import {
  PAYAGENT_TOKEN_ADDRESS,
  PAYAGENT_TOKEN_DECIMALS,
  PAYAGENT_TOKEN_SYMBOL,
} from "../src/lib/payagent-token";
import { validateRecipientAddress } from "../src/lib/pay/recipient-address";
import { isReservedPaymentPathSegment } from "../src/lib/payment-link-url";
import { evaluatePolicy } from "../src/lib/compliance/evaluate-policy";
import { toPolicyAmountUsd } from "../src/lib/compliance/valuation";
import { POLICY_CODES } from "../src/lib/compliance/codes";
import { redactSecretsForLogs } from "../src/lib/compliance/content-guard";
import {
  getSettlementVerifyMode,
  isContractSettlementVerification,
  isFormatOnlySettlementVerification,
} from "../src/lib/payment/settlement/mode";
import { validateWebhookUrl } from "../src/lib/webhooks/validate-url";
import { savedAddressInputSchema } from "../src/lib/pay/saved-address-schema";
import { isPayAgentConnectEnabled, AGENT_SCOPED_KEY_PERMISSIONS } from "../src/lib/pay/config";
import { hashPollSecret } from "../src/lib/db/agent-links";
import { apiKeyHasPermission } from "../src/lib/db/api-keys";

type TestCase = {
  name: string;
  run: () => void;
};

const samplePolicy = {
  id: "pol_1",
  status: "active" as const,
  policyVersion: 2,
  maxAmountPerPayment: 50,
  dailySpendCap: 200,
  monthlySpendCap: 1000 as number | null,
  allowedNetworkIds: ["ethereum", "base"],
  allowedTokenIds: ["usdc", "usdt"],
  allowCreatePaymentLinks: true,
  allowPay: true,
  requireApprovalAbove: 40 as number | null,
};

const tests: TestCase[] = [
  {
    name: "formatOracleUsdPrice formats $1.00 at 8 decimals",
    run: () => {
      assertEqual(formatOracleUsdPrice(BigInt(100_000_000)), "$1.00");
    },
  },
  {
    name: "formatOracleUsdPrice returns null when price is undefined",
    run: () => {
      assertEqual(formatOracleUsdPrice(undefined), null);
    },
  },
  {
    name: "tokenUsdValue multiplies token amount by oracle price",
    run: () => {
      assertEqual(tokenUsdValue(1_000, BigInt(100_000_000)), "$1,000.00");
      assertEqual(tokenUsdValue(0.5, BigInt(200_000_000)), "$1.00");
    },
  },
  {
    name: "PAYAGENT oracle uses 8 price decimals",
    run: () => {
      assertEqual(PAYAGENT_ORACLE_PRICE_DECIMALS, 8);
    },
  },
  {
    name: "PAYAGENT token metadata is configured",
    run: () => {
      assertEqual(PAYAGENT_TOKEN_DECIMALS, 6);
      assertEqual(PAYAGENT_TOKEN_SYMBOL, "PAYAGENT");
      assertAddress(PAYAGENT_TOKEN_ADDRESS);
      assertAddress(PAYAGENT_ORACLE_ADDRESS);
    },
  },
  {
    name: "leaderboard and token paths are reserved",
    run: () => {
      assertEqual(isReservedPaymentPathSegment("leaderboard"), true);
      assertEqual(isReservedPaymentPathSegment("blog"), true);
      assertEqual(isReservedPaymentPathSegment("about"), true);
      assertEqual(isReservedPaymentPathSegment("referealtest"), false);
    },
  },
  {
    name: "compareLeaderboardEntries sorts by volume, then txns, then links",
    run: () => {
      const higherVolume = { totalValue: 200, txnCount: 1, linksCreated: 1 };
      const lowerVolume = { totalValue: 100, txnCount: 99, linksCreated: 99 };
      assertTrue(compareLeaderboardEntries(lowerVolume, higherVolume) > 0);

      const moreTxns = { totalValue: 100, txnCount: 5, linksCreated: 1 };
      const fewerTxns = { totalValue: 100, txnCount: 2, linksCreated: 99 };
      assertTrue(compareLeaderboardEntries(fewerTxns, moreTxns) > 0);

      const moreLinks = { totalValue: 100, txnCount: 2, linksCreated: 10 };
      const fewerLinks = { totalValue: 100, txnCount: 2, linksCreated: 3 };
      assertTrue(compareLeaderboardEntries(fewerLinks, moreLinks) > 0);
    },
  },
  {
    name: "sortLeaderboardEntries returns highest volume first",
    run: () => {
      const sorted = sortLeaderboardEntries([
        { id: "b", totalValue: 50, txnCount: 1, linksCreated: 1 },
        { id: "a", totalValue: 500, txnCount: 1, linksCreated: 1 },
        { id: "c", totalValue: 150, txnCount: 1, linksCreated: 1 },
      ]);
      assertJsonEqual(
        sorted.map((entry) => entry.id),
        ["a", "c", "b"],
      );
    },
  },
  {
    name: "capLeaderboardLimit clamps between 1 and 100",
    run: () => {
      assertEqual(capLeaderboardLimit(0), 1);
      assertEqual(capLeaderboardLimit(50), 50);
      assertEqual(capLeaderboardLimit(500), 100);
    },
  },
  {
    name: "toPolicyAmountUsd treats USDC/USDT as 1:1",
    run: () => {
      const usdc = toPolicyAmountUsd(12.5, "usdc");
      assertTrue(usdc.ok);
      if (usdc.ok) assertEqual(usdc.amountUsd, 12.5);
      const usdt = toPolicyAmountUsd(1, "USDT");
      assertTrue(usdt.ok);
    },
  },
  {
    name: "toPolicyAmountUsd fails closed for ETH/SOL",
    run: () => {
      const eth = toPolicyAmountUsd(1, "eth");
      assertTrue(!eth.ok);
      if (!eth.ok) assertEqual(eth.code, POLICY_CODES.AMOUNT_VALUATION_UNAVAILABLE);
    },
  },
  {
    name: "evaluatePolicy denies when no active policy",
    run: () => {
      const result = evaluatePolicy({
        agentStatus: "active",
        action: "payment_links.create",
        amountUsd: 10,
        networkId: "base",
        tokenId: "usdc",
        policy: null,
        spentDailyUsd: 0,
        spentMonthlyUsd: 0,
      });
      assertEqual(result.verdict, "deny");
      assertEqual(result.codes[0], POLICY_CODES.NO_ACTIVE_POLICY);
    },
  },
  {
    name: "evaluatePolicy allows within caps",
    run: () => {
      const result = evaluatePolicy({
        agentStatus: "active",
        action: "payment_links.create",
        amountUsd: 10,
        networkId: "base",
        tokenId: "usdc",
        policy: samplePolicy,
        spentDailyUsd: 20,
        spentMonthlyUsd: 100,
      });
      assertEqual(result.verdict, "allow");
      assertEqual(result.remainingDailyUsd, 180);
    },
  },
  {
    name: "evaluatePolicy denies daily cap exceeded",
    run: () => {
      const result = evaluatePolicy({
        agentStatus: "active",
        action: "pay.link",
        amountUsd: 50,
        networkId: "base",
        tokenId: "usdc",
        policy: { ...samplePolicy, requireApprovalAbove: null },
        spentDailyUsd: 160,
        spentMonthlyUsd: 0,
      });
      assertEqual(result.verdict, "deny");
      assertEqual(result.codes[0], POLICY_CODES.DAILY_CAP_EXCEEDED);
    },
  },
  {
    name: "evaluatePolicy counts outstanding unpaid link exposure",
    run: () => {
      const result = evaluatePolicy({
        agentStatus: "active",
        action: "payment_links.create",
        amountUsd: 50,
        networkId: "base",
        tokenId: "usdc",
        policy: samplePolicy,
        spentDailyUsd: 0,
        spentMonthlyUsd: 0,
        outstandingUsd: 180,
      });
      assertEqual(result.verdict, "deny");
      assertEqual(result.codes[0], POLICY_CODES.DAILY_CAP_EXCEEDED);
    },
  },
  {
    name: "evaluatePolicy requires approval above threshold",
    run: () => {
      const result = evaluatePolicy({
        agentStatus: "active",
        action: "pay.link",
        amountUsd: 45,
        networkId: "base",
        tokenId: "usdc",
        policy: samplePolicy,
        spentDailyUsd: 0,
        spentMonthlyUsd: 0,
      });
      assertEqual(result.verdict, "require_approval");
      assertEqual(result.codes[0], POLICY_CODES.APPROVAL_REQUIRED);
    },
  },
  {
    name: "evaluatePolicy skips approval when already consumed",
    run: () => {
      const result = evaluatePolicy({
        agentStatus: "active",
        action: "pay.link",
        amountUsd: 45,
        networkId: "base",
        tokenId: "usdc",
        policy: samplePolicy,
        spentDailyUsd: 0,
        spentMonthlyUsd: 0,
        approvalConsumed: true,
      });
      assertEqual(result.verdict, "allow");
    },
  },
  {
    name: "evaluatePolicy allows pay.address within caps",
    run: () => {
      const result = evaluatePolicy({
        agentStatus: "active",
        action: "pay.address",
        amountUsd: 10,
        networkId: "base",
        tokenId: "usdc",
        policy: {
          id: "pol_1",
          status: "active",
          policyVersion: 1,
          maxAmountPerPayment: 50,
          dailySpendCap: 200,
          monthlySpendCap: null,
          allowedNetworkIds: ["base"],
          allowedTokenIds: ["usdc"],
          allowCreatePaymentLinks: true,
          allowPay: true,
          requireApprovalAbove: null,
        },
        spentDailyUsd: 0,
        spentMonthlyUsd: 0,
      });
      assertEqual(result.verdict, "allow");
    },
  },
  {
    name: "validateRecipientAddress accepts checksummed EVM address",
    run: () => {
      const result = validateRecipientAddress(
        "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        "sepolia",
      );
      assertTrue(result.ok);
    },
  },
  {
    name: "redactSecretsForLogs keeps IP and strips bearer tokens",
    run: () => {
      const redacted = redactSecretsForLogs({
        ip: "203.0.113.10",
        authorization: "Bearer secret-token-value",
        note: "Bearer abc.def.ghi",
      }) as Record<string, string>;
      assertEqual(redacted.ip, "203.0.113.10");
      assertEqual(redacted.authorization, "[REDACTED]");
      assertTrue(redacted.note.includes("[REDACTED]"));
    },
  },
  {
    name: "settlement mode: unset is full verify (not format-only)",
    run: () => {
      const prev = process.env.PAYMENT_SETTLEMENT_VERIFY_MODE;
      delete process.env.PAYMENT_SETTLEMENT_VERIFY_MODE;
      assertEqual(getSettlementVerifyMode(), null);
      assertEqual(isFormatOnlySettlementVerification(), false);
      if (prev) process.env.PAYMENT_SETTLEMENT_VERIFY_MODE = prev;
    },
  },
  {
    name: "settlement mode: wagmi is full verify (not format-only)",
    run: () => {
      const prev = process.env.PAYMENT_SETTLEMENT_VERIFY_MODE;
      process.env.PAYMENT_SETTLEMENT_VERIFY_MODE = "wagmi";
      assertEqual(getSettlementVerifyMode(), "wagmi");
      assertEqual(isFormatOnlySettlementVerification(), false);
      if (prev) process.env.PAYMENT_SETTLEMENT_VERIFY_MODE = prev;
      else delete process.env.PAYMENT_SETTLEMENT_VERIFY_MODE;
    },
  },
  {
    name: "settlement mode: format skips on-chain verify",
    run: () => {
      const prev = process.env.PAYMENT_SETTLEMENT_VERIFY_MODE;
      process.env.PAYMENT_SETTLEMENT_VERIFY_MODE = "format";
      assertEqual(isFormatOnlySettlementVerification(), true);
      if (prev) process.env.PAYMENT_SETTLEMENT_VERIFY_MODE = prev;
      else delete process.env.PAYMENT_SETTLEMENT_VERIFY_MODE;
    },
  },
  {
    name: "settlement mode: contract routes to contract verifier",
    run: () => {
      const prev = process.env.PAYMENT_SETTLEMENT_VERIFY_MODE;
      process.env.PAYMENT_SETTLEMENT_VERIFY_MODE = "contract";
      assertEqual(isContractSettlementVerification(), true);
      if (prev) process.env.PAYMENT_SETTLEMENT_VERIFY_MODE = prev;
      else delete process.env.PAYMENT_SETTLEMENT_VERIFY_MODE;
    },
  },
  {
    name: "validateWebhookUrl allows public https",
    run: () => {
      const result = validateWebhookUrl("https://example.com/webhooks/fidence");
      assertEqual(result.ok, true);
    },
  },
  {
    name: "validateWebhookUrl rejects localhost",
    run: () => {
      const result = validateWebhookUrl("http://localhost:3000/hook");
      assertEqual(result.ok, false);
      if (!result.ok) assertEqual(result.code, "WEBHOOK_URL_FORBIDDEN");
    },
  },
  {
    name: "validateWebhookUrl rejects metadata IP",
    run: () => {
      const result = validateWebhookUrl("http://169.254.169.254/latest/meta-data");
      assertEqual(result.ok, false);
    },
  },
  {
    name: "saved address schema requires country ISO-2",
    run: () => {
      const parsed = savedAddressInputSchema.safeParse({
        name: "Test",
        line1: "1 Main",
        city: "NYC",
        country: "US",
      });
      assertTrue(parsed.success);
    },
  },
  {
    name: "saved address schema rejects invalid email",
    run: () => {
      const parsed = savedAddressInputSchema.safeParse({
        name: "Test",
        email: "not-an-email",
        line1: "1 Main",
        city: "NYC",
        country: "US",
      });
      assertTrue(!parsed.success);
    },
  },
  {
    name: "isPayAgentConnectEnabled defaults true",
    run: () => {
      const prev = process.env.PAY_AGENT_CONNECT_ENABLED;
      delete process.env.PAY_AGENT_CONNECT_ENABLED;
      assertTrue(isPayAgentConnectEnabled());
      if (prev) process.env.PAY_AGENT_CONNECT_ENABLED = prev;
    },
  },
  {
    name: "agent scoped permissions include payment_intents.create",
    run: () => {
      assertTrue(AGENT_SCOPED_KEY_PERMISSIONS.includes("payment_intents.create"));
      assertTrue(
        apiKeyHasPermission(
          { permissions: [...AGENT_SCOPED_KEY_PERMISSIONS] } as import("../src/lib/db/merchant-types").ApiKeyDoc,
          "payment_intents.create",
        ),
      );
    },
  },
  {
    name: "hashPollSecret is deterministic",
    run: () => {
      assertEqual(hashPollSecret("abc"), hashPollSecret("abc"));
      assertTrue(hashPollSecret("abc") !== hashPollSecret("def"));
    },
  },
];

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertTrue(value: boolean) {
  if (!value) {
    throw new Error("Expected condition to be true");
  }
}

function assertJsonEqual<T>(actual: T, expected: T) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) {
    throw new Error(`Expected ${right}, received ${left}`);
  }
}

function assertAddress(value: string) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Invalid address: ${value}`);
  }
}

async function main() {
  let passed = 0;
  const failures: string[] = [];

  for (const test of tests) {
    try {
      test.run();
      passed += 1;
      console.log(`  ✓ ${test.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${test.name}: ${message}`);
      console.log(`  ✗ ${test.name}`);
    }
  }

  console.log(`\n${passed}/${tests.length} unit tests passed`);

  if (failures.length > 0) {
    console.error("\nFailures:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
