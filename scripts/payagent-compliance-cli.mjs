#!/usr/bin/env node
/**
 * Interactive Payagent Compliance CLI
 *
 *   export PAYAGENT_API_KEY=fid_live_...
 *   export PAYAGENT_BASE_URL=http://localhost:3000
 *   node scripts/payagent-compliance-cli.mjs set-policy --agent checkout-bot
 *
 * Non-interactive:
 *   node scripts/payagent-compliance-cli.mjs set-policy --agent checkout-bot \
 *     --max 50 --daily 200 --networks a,b,d --tokens a,b --actions a,b --activate
 */

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const apiKey = process.env.PAYAGENT_API_KEY?.trim();
const baseUrl = (process.env.PAYAGENT_BASE_URL || "https://payagent.co").replace(
  /\/$/,
  "",
);

if (!apiKey) {
  console.error("Set PAYAGENT_API_KEY in the environment.");
  process.exit(1);
}

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "payagent-compliance-cli/1.0",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || data.message || response.statusText;
    const err = new Error(message);
    err.data = data;
    err.status = response.status;
    throw err;
  }
  return data;
}

function formatOptions(items) {
  return items
    .map((item) => `  [${item.key}] ${item.label}`)
    .join("\n");
}

function resolveKeys(selection, items) {
  const keys = selection
    .split(/[,\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const byKey = new Map(items.map((item) => [item.key, item.id]));
  const byId = new Map(items.map((item) => [item.id, item.id]));
  const ids = [];
  for (const key of keys) {
    const id = byKey.get(key) || byId.get(key);
    if (!id) throw new Error(`Unknown option: ${key}`);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function promptPolicy(agentId) {
  const catalog = await api("/api/v1/compliance/catalog");
  const rl = readline.createInterface({ input, output });

  console.log(`\nAgent: ${agentId}`);
  const max = Number(
    (await rl.question("Max per payment (USD) [50]: ")) || "50",
  );
  const daily = Number(
    (await rl.question("Daily spend cap (USD) [200]: ")) || "200",
  );
  const monthlyRaw = await rl.question("Monthly spend cap (USD, blank=none): ");
  const monthly = monthlyRaw.trim() === "" ? null : Number(monthlyRaw);

  console.log("\nAllowed networks (comma-separated keys):");
  console.log(formatOptions(catalog.networks));
  const networks = resolveKeys(
    (await rl.question("Select: ")) || "a,b,d",
    catalog.networks,
  );

  console.log("\nAllowed tokens:");
  console.log(formatOptions(catalog.tokens));
  const tokens = resolveKeys(
    (await rl.question("Select: ")) || "a,b",
    catalog.tokens,
  );

  console.log("\nPermissions:");
  console.log(formatOptions(catalog.actions));
  const actions = resolveKeys(
    (await rl.question("Select: ")) || "a,b",
    catalog.actions,
  );

  const approvalRaw = (
    await rl.question("Require human approval above amount? [y/N]: ")
  )
    .trim()
    .toLowerCase();
  let requireApprovalAbove = null;
  if (approvalRaw === "y" || approvalRaw === "yes") {
    requireApprovalAbove = Number(
      (await rl.question("Approval threshold (USD): ")) || "100",
    );
  }

  const activateRaw = (await rl.question("Activate now? [Y/n]: "))
    .trim()
    .toLowerCase();
  const activate = activateRaw !== "n" && activateRaw !== "no";

  let confirmWideOpen = false;
  if (activate && daily >= 10000) {
    const wide = (
      await rl.question(
        "Daily cap is very high (≥10000). Confirm wide-open? [y/N]: ",
      )
    )
      .trim()
      .toLowerCase();
    confirmWideOpen = wide === "y" || wide === "yes";
  }

  rl.close();

  return {
    status: activate ? "active" : "draft",
    maxAmountPerPayment: max,
    dailySpendCap: daily,
    monthlySpendCap: monthly,
    allowedNetworkIds: networks,
    allowedTokenIds: tokens,
    allowCreatePaymentLinks: actions.includes("create_payment_links"),
    allowPay: actions.includes("pay"),
    requireApprovalAbove,
    confirmWideOpen,
  };
}

function policyFromFlags(catalog) {
  const agent = getFlag("agent");
  if (!agent) throw new Error("--agent is required");

  const networks = resolveKeys(
    getFlag("networks") || "a,b,d",
    catalog.networks,
  );
  const tokens = resolveKeys(getFlag("tokens") || "a,b", catalog.tokens);
  const actions = resolveKeys(getFlag("actions") || "a,b", catalog.actions);
  const daily = Number(getFlag("daily") || "200");

  return {
    agent,
    body: {
      status: hasFlag("activate") ? "active" : "draft",
      maxAmountPerPayment: Number(getFlag("max") || "50"),
      dailySpendCap: daily,
      monthlySpendCap: getFlag("monthly") ? Number(getFlag("monthly")) : null,
      allowedNetworkIds: networks,
      allowedTokenIds: tokens,
      allowCreatePaymentLinks: actions.includes("create_payment_links"),
      allowPay: actions.includes("pay"),
      requireApprovalAbove: getFlag("approval-above")
        ? Number(getFlag("approval-above"))
        : null,
      confirmWideOpen: hasFlag("confirm-wide-open") || daily < 10000,
    },
  };
}

async function setPolicy() {
  const catalog = await api("/api/v1/compliance/catalog");
  const interactive = !hasFlag("max") && !hasFlag("networks") && !hasFlag("tokens");

  let agentId = getFlag("agent");
  let body;

  if (interactive) {
    if (!agentId) {
      const rl = readline.createInterface({ input, output });
      agentId = (await rl.question("Agent external ID: ")).trim();
      rl.close();
    }
    if (!agentId) throw new Error("Agent is required");
    body = await promptPolicy(agentId);
  } else {
    const parsed = policyFromFlags(catalog);
    agentId = parsed.agent;
    body = parsed.body;
  }

  const result = await api(
    `/api/v1/compliance/agents/${encodeURIComponent(agentId)}/policy`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  );

  console.log(
    `\nPolicy ${result.policy.status}. version=${result.policy.policyVersion ?? "?"} receipt=${result.receiptId}`,
  );
}

async function main() {
  if (command !== "set-policy") {
    console.log(`Usage:
  node scripts/payagent-compliance-cli.mjs set-policy --agent <externalAgentId>
  node scripts/payagent-compliance-cli.mjs set-policy --agent <id> --max 50 --daily 200 --networks a,b --tokens a,b --actions a,b --activate`);
    process.exit(command ? 1 : 0);
  }

  try {
    await setPolicy();
  } catch (error) {
    console.error(error.message);
    if (error.data) console.error(JSON.stringify(error.data, null, 2));
    process.exit(1);
  }
}

main();
