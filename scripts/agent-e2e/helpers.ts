/**
 * Shared helpers for agent E2E phase runners.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type CliArgs = {
  phase: number | null;
  all: boolean;
};

export function loadAgentE2eEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        const fidMatch = trimmed.match(/(fid_(?:live|test|admin|agent)_[a-f0-9]+)/i);
        if (fidMatch && !process.env.PAYAGENT_API_KEY) {
          process.env.PAYAGENT_API_KEY = fidMatch[1];
        }
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Optional in CI.
  }
}

export function parseCliArgs(argv: string[]): CliArgs {
  let phase: number | null = null;
  let all = false;

  for (const arg of argv) {
    if (arg === "--all") {
      all = true;
      continue;
    }
    const match = arg.match(/^--phase=(\d+)$/);
    if (match) {
      phase = Number(match[1]);
    }
  }

  return { phase, all };
}

export function getAgentE2eConfig() {
  return {
    baseUrl:
      process.env.PAYAGENT_BASE_URL ??
      process.env.BASE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://127.0.0.1:3000",
    apiKey:
      process.env.PAYAGENT_API_KEY ??
      process.env.FIDENCE_TEST_API_KEY_RITESH ??
      "",
    mainnetSmoke: process.env.AGENT_E2E_MAINNET === "1",
    sepoliaPrivateKey: process.env.SEPOLIA_PRIVATE_KEY ?? "",
  };
}

export async function merchantFetch(
  path: string,
  init: RequestInit & { apiKey?: string } = {},
) {
  const config = getAgentE2eConfig();
  const apiKey = init.apiKey ?? config.apiKey;
  if (!apiKey) {
    throw new Error("Missing PAYAGENT_API_KEY (or FIDENCE_TEST_API_KEY_RITESH)");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { response, data };
}

export function skip(message: string) {
  console.log(`SKIP: ${message}`);
}

export function pass(message: string) {
  console.log(`PASS: ${message}`);
}

export function fail(message: string) {
  throw new Error(message);
}
