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
import { isReservedPaymentPathSegment } from "../src/lib/payment-link-url";

type TestCase = {
  name: string;
  run: () => void;
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
      assertEqual(isReservedPaymentPathSegment("TOKEN"), true);
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
