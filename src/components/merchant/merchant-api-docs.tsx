"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function MethodBadge({ method }: { method: "GET" | "POST" | "PUT" }) {
  return (
    <Badge
      variant="outline"
      className={
        method === "GET"
          ? "font-mono text-[10px] uppercase tracking-wide text-emerald-700"
          : method === "PUT"
            ? "font-mono text-[10px] uppercase tracking-wide text-violet-700"
            : "font-mono text-[10px] uppercase tracking-wide text-primary"
      }
    >
      {method}
    </Badge>
  );
}

function CodeBlock({ code }: { code: string }) {
  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    toast.success("Copied");
  }

  return (
    <div className="relative rounded-xl border border-border/60 bg-muted/30">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="absolute top-2 right-2 size-7"
        onClick={handleCopy}
      >
        <CopyIcon className="size-3.5" />
      </Button>
      <pre className="overflow-x-auto p-4 pr-12 font-mono text-xs leading-relaxed text-foreground">
        {code}
      </pre>
    </div>
  );
}

function FieldList({
  fields,
}: {
  fields: { name: string; required?: boolean; description: string }[];
}) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {fields.map((field) => (
        <li key={field.name}>
          <span className="font-mono text-xs text-foreground">{field.name}</span>
          {field.required ? (
            <span className="ml-1.5 text-[10px] uppercase text-amber-700">
              required
            </span>
          ) : null}
          <span className="text-muted-foreground"> — {field.description}</span>
        </li>
      ))}
    </ul>
  );
}

function ErrorCodesTable() {
  const codes = [
    { code: "AGENT_NOT_FOUND", meaning: "Agent not registered for this workspace" },
    { code: "AGENT_EXISTS", meaning: "Agent ID already registered" },
    { code: "AGENT_INACTIVE", meaning: "Agent is disabled — enable in Registered Agents" },
    { code: "AGENT_LIMIT_REACHED", meaning: "Max 10 agents per workspace" },
    { code: "AGENT_WALLET_MISSING", meaning: "No wallet added for agent on this network" },
    { code: "AGENT_WALLET_MISMATCH", meaning: "payerAddress does not match agent wallet" },
    { code: "LINK_NOT_FOUND", meaning: "Payment link does not exist" },
    { code: "LINK_NOT_PAYABLE", meaning: "Link is paid, expired, or cancelled" },
    { code: "RECIPIENT_NOT_FOUND", meaning: "Recipient username does not exist" },
    { code: "RECIPIENT_WALLET_MISSING", meaning: "Recipient has no verified wallet on network" },
    { code: "TOKEN_NETWORK_UNSUPPORTED", meaning: "tokenId + networkId combo not supported" },
    { code: "WALLET_NOT_VERIFIED_FOR_NETWORK", meaning: "Merchant has no verified receiving wallet" },
    { code: "NO_ACTIVE_POLICY", meaning: "Agent has no active compliance policy (fail closed)" },
    { code: "ACTION_NOT_ALLOWED", meaning: "Policy disallows create-link or pay" },
    { code: "NETWORK_NOT_ALLOWED", meaning: "Network not on the agent allowlist" },
    { code: "TOKEN_NOT_ALLOWED", meaning: "Token not on the agent allowlist" },
    { code: "AMOUNT_ABOVE_MAX", meaning: "Amount exceeds maxAmountPerPayment" },
    { code: "DAILY_CAP_EXCEEDED", meaning: "Daily USD spend cap would be exceeded" },
    { code: "MONTHLY_CAP_EXCEEDED", meaning: "Monthly USD spend cap would be exceeded" },
    { code: "APPROVAL_REQUIRED", meaning: "Pay parked for human approval (HTTP 202)" },
    { code: "AMOUNT_VALUATION_UNAVAILABLE", meaning: "Non-stablecoin USD price unavailable" },
    { code: "CONFIRM_WIDE_OPEN_REQUIRED", meaning: "dailySpendCap ≥ 10000 needs confirmWideOpen" },
    { code: "SETTLEMENT_AMOUNT_UNKNOWN", meaning: "Could not read on-chain transfer amount" },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/30 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Code</th>
            <th className="px-3 py-2 font-medium">Meaning</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {codes.map((row) => (
            <tr key={row.code}>
              <td className="px-3 py-2 font-mono text-foreground">{row.code}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MerchantApiDocs({ baseUrl }: { baseUrl: string }) {
  const authHeader = `Authorization: Bearer fid_live_your_api_key`;

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">API reference</CardTitle>
        <p className="text-sm text-muted-foreground">
          Use your merchant API key to register agents, add wallets, create
          links, and record payments. Fidence verifies on-chain transactions —
          your agent signs and funds payments from its own wallet.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Recommended flow</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Register agent</li>
            <li>Add wallet (must hold on-chain balance)</li>
            <li>Activate a compliance policy (portal, API, or CLI)</li>
            <li>Create payment links or pay profiles</li>
            <li>Send tx from agent wallet, then report via pay endpoint</li>
          </ol>
        </div>

        <Accordion defaultValue={["auth"]}>
          <AccordionItem value="auth">
            <AccordionTrigger className="px-1 hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="font-medium">Authentication</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-1">
              <p className="text-sm text-muted-foreground">
                Send your API key on every request. One key per workspace, max
                10 agents.
              </p>
              <CodeBlock code={authHeader} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="register">
            <AccordionTrigger className="px-1 hover:no-underline">
              <div className="flex flex-wrap items-center gap-2">
                <MethodBadge method="POST" />
                <span className="font-mono text-sm">/api/v1/agents/register</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
              <p className="text-sm text-muted-foreground">
                Register a new agent with a name. Required before adding wallets
                or creating links.
              </p>
              <FieldList
                fields={[
                  { name: "agentId", required: true, description: "Your unique agent identifier" },
                  { name: "agentName", required: true, description: "Display name for the agent" },
                ]}
              />
              <CodeBlock
                code={`curl -X POST ${baseUrl}/api/v1/agents/register \\
  -H "${authHeader}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "checkout-bot",
    "agentName": "Checkout Bot"
  }'`}
              />
              <CodeBlock
                code={`{
  "ok": true,
  "agent": {
    "publicId": "agt_a1b2c3d4",
    "externalAgentId": "checkout-bot",
    "name": "Checkout Bot",
    "status": "active",
    "created": true
  }
}`}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="wallet">
            <AccordionTrigger className="px-1 hover:no-underline">
              <div className="flex flex-wrap items-center gap-2">
                <MethodBadge method="POST" />
                <span className="font-mono text-sm">/api/v1/agents/wallet</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
              <p className="text-sm text-muted-foreground">
                Add a wallet to a registered agent. The agent must fund this
                wallet on-chain before it can pay.
              </p>
              <FieldList
                fields={[
                  { name: "agentId", required: true, description: "Registered agent ID" },
                  { name: "walletAddress", required: true, description: "Agent wallet address" },
                  { name: "networkId", required: true, description: "e.g. sepolia, base, ethereum" },
                ]}
              />
              <CodeBlock
                code={`curl -X POST ${baseUrl}/api/v1/agents/wallet \\
  -H "${authHeader}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "checkout-bot",
    "walletAddress": "0x518b9aba7586542e611909799f6d0b81e9552d9b",
    "networkId": "sepolia"
  }'`}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="profile">
            <AccordionTrigger className="px-1 hover:no-underline">
              <div className="flex flex-wrap items-center gap-2">
                <MethodBadge method="GET" />
                <span className="font-mono text-sm">/api/v1/agents/profile</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
              <p className="text-sm text-muted-foreground">
                Get agent wallets and supported networks (similar to human wallet
                view).
              </p>
              <FieldList
                fields={[
                  { name: "agentId", required: true, description: "Query param — registered agent ID" },
                ]}
              />
              <CodeBlock
                code={`curl "${baseUrl}/api/v1/agents/profile?agentId=checkout-bot" \\
  -H "${authHeader}"`}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="compliance">
            <AccordionTrigger className="px-1 hover:no-underline">
              <div className="flex flex-wrap items-center gap-2">
                <MethodBadge method="GET" />
                <MethodBadge method="PUT" />
                <span className="font-mono text-sm">/api/v1/compliance/*</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
              <p className="text-sm text-muted-foreground">
                Money APIs fail closed without an <span className="font-medium">active</span>{" "}
                policy. Agents cannot edit their own policies — use the workspace
                API key, portal, or{" "}
                <span className="font-mono text-xs">npm run compliance:cli</span>.
                Caps are USD; USDC/USDT are 1:1. ETH/SOL deny until valuation
                exists. Every decision stores actor IP server-side (not returned
                to agents).
              </p>
              <FieldList
                fields={[
                  { name: "GET /catalog", description: "Networks/tokens/actions with letter keys for CLI" },
                  { name: "GET /agents", description: "Agents + policy/compliance summary" },
                  { name: "GET|PUT /agents/:agentId/policy", description: "agentId = externalAgentId" },
                  { name: "GET /agents/:agentId/decisions", description: "Per-agent decision receipts" },
                  { name: "GET /audit", description: "Workspace audit search (?ip=&actorType=)" },
                  { name: "GET /approvals/:id", description: "Poll pending/approved payment approvals" },
                ]}
              />
              <CodeBlock
                code={`curl -X PUT ${baseUrl}/api/v1/compliance/agents/checkout-bot/policy \\
  -H "${authHeader}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "active",
    "maxAmountPerPayment": 50,
    "dailySpendCap": 200,
    "monthlySpendCap": null,
    "allowedNetworkIds": ["ethereum", "base", "sepolia"],
    "allowedTokenIds": ["usdc", "usdt"],
    "allowCreatePaymentLinks": true,
    "allowPay": true,
    "requireApprovalAbove": null
  }'`}
              />
              <CodeBlock
                code={`# Policy denied (HTTP 403)
{
  "ok": false,
  "error": "POLICY_DENIED",
  "code": "NO_ACTIVE_POLICY",
  "codes": ["NO_ACTIVE_POLICY"],
  "receiptId": "dec_...",
  "message": "Agent has no active compliance policy"
}`}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="payment-links">
            <AccordionTrigger className="px-1 hover:no-underline">
              <div className="flex flex-wrap items-center gap-2">
                <MethodBadge method="POST" />
                <span className="font-mono text-sm">/api/v1/payment-links</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
              <p className="text-sm text-muted-foreground">
                Create a payment link for a registered agent. Requires an active
                compliance policy. Appears under Payment Links → Agent mode.
              </p>
              <FieldList
                fields={[
                  { name: "agentId", required: true, description: "Registered agent ID" },
                  { name: "amount", required: true, description: "Payment amount" },
                  { name: "tokenId", required: true, description: "e.g. usdc, eth" },
                  { name: "networkId", required: true, description: "Network for the link" },
                  { name: "expiresAt", required: true, description: "ISO 8601 expiry date" },
                ]}
              />
              <CodeBlock
                code={`curl -X POST ${baseUrl}/api/v1/payment-links \\
  -H "${authHeader}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "checkout-bot",
    "amount": 1,
    "tokenId": "usdc",
    "networkId": "sepolia",
    "expiresAt": "2026-12-31T00:00:00.000Z"
  }'`}
              />
              <CodeBlock
                code={`{
  "id": "...",
  "publicId": "1bf8eceece44",
  "url": "${baseUrl}/yourname/1bf8eceece44",
  "status": "pending",
  "agent": {
    "publicId": "agt_a1b2c3d4",
    "externalAgentId": "checkout-bot"
  }
}`}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="preflight">
            <AccordionTrigger className="px-1 hover:no-underline">
              <div className="flex flex-wrap items-center gap-2">
                <MethodBadge method="GET" />
                <span className="font-mono text-sm">/api/v1/pay/preflight</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
              <p className="text-sm text-muted-foreground">
                Check whether an agent is ready to pay before sending an
                on-chain transaction. Returns individual pass/fail checks and an
                overall <span className="font-mono text-xs">ready</span> flag.
              </p>
              <FieldList
                fields={[
                  { name: "type", required: true, description: '"link" or "profile"' },
                  { name: "agentId", required: true, description: "Agent to pay from" },
                  { name: "payerAddress", description: "Optional — verify wallet match" },
                  { name: "linkUsername", description: 'Required when type=link' },
                  { name: "linkId", description: 'Required when type=link' },
                  { name: "recipientUsername", description: 'Required when type=profile' },
                  { name: "tokenId", description: 'Required when type=profile' },
                  { name: "networkId", description: 'Required when type=profile' },
                  { name: "amount", description: "Recommended for type=profile policy checks" },
                ]}
              />
              <CodeBlock
                code={`curl "${baseUrl}/api/v1/pay/preflight?type=link&agentId=checkout-bot&linkUsername=referealtest&linkId=16e9de654a5a&payerAddress=0x518b9aba7586542e611909799f6d0b81e9552d9b" \\
  -H "${authHeader}"`}
              />
              <CodeBlock
                code={`{
  "ready": true,
  "type": "link",
  "checks": {
    "api_key": { "ok": true, "message": "API key is valid" },
    "agent_registered": { "ok": true, "message": "Agent is registered" },
    "agent_active": { "ok": true, "message": "Agent is active" },
    "agent_wallet": { "ok": true, "message": "Payer address matches agent wallet on this network" },
    "link_found": { "ok": true, "message": "Payment link exists" },
    "link_payable": { "ok": true, "message": "Payment link is pending and payable" },
    "token_network": { "ok": true, "message": "USDC on sepolia is supported" },
    "recipient_wallet": { "ok": true, "message": "Link recipient wallet is configured" }
  }
}`}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="pay-link">
            <AccordionTrigger className="px-1 hover:no-underline">
              <div className="flex flex-wrap items-center gap-2">
                <MethodBadge method="POST" />
                <span className="font-mono text-sm">/api/v1/pay</span>
                <Badge variant="secondary" className="text-[10px]">
                  link payment
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
              <p className="text-sm text-muted-foreground">
                Record a payment after your agent sends an on-chain transaction
                from its registered wallet. Fidence verifies the tx hash.
              </p>
              <FieldList
                fields={[
                  { name: "agentId", required: true, description: "Paying agent ID" },
                  { name: "payerAddress", required: true, description: "Must match agent wallet" },
                  { name: "txHash", required: true, description: "On-chain transaction hash" },
                  { name: "type", required: true, description: '"link"' },
                  { name: "linkUsername", required: true, description: "Recipient username" },
                  { name: "linkId", required: true, description: "Payment link public ID" },
                ]}
              />
              <CodeBlock
                code={`curl -X POST ${baseUrl}/api/v1/pay \\
  -H "${authHeader}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "checkout-bot",
    "payerAddress": "0x518b9aba7586542e611909799f6d0b81e9552d9b",
    "txHash": "0xb9a5f584452a5903386672a143c4aca14fcfb78124a87a2da51e9bf7e68f9075",
    "type": "link",
    "linkUsername": "referealtest",
    "linkId": "16e9de654a5a"
  }'`}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="pay-profile">
            <AccordionTrigger className="px-1 hover:no-underline">
              <div className="flex flex-wrap items-center gap-2">
                <MethodBadge method="POST" />
                <span className="font-mono text-sm">/api/v1/pay</span>
                <Badge variant="secondary" className="text-[10px]">
                  profile payment
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
              <p className="text-sm text-muted-foreground">
                Pay a human profile directly. Same flow: send on-chain first,
                then report the transaction.
              </p>
              <FieldList
                fields={[
                  { name: "agentId", required: true, description: "Paying agent ID" },
                  { name: "payerAddress", required: true, description: "Must match agent wallet" },
                  { name: "txHash", required: true, description: "On-chain transaction hash" },
                  { name: "type", required: true, description: '"profile"' },
                  { name: "recipientUsername", required: true, description: "Human profile username" },
                  { name: "amount", required: true, description: "Payment amount" },
                  { name: "tokenId", required: true, description: "e.g. usdc" },
                  { name: "networkId", required: true, description: "e.g. sepolia" },
                ]}
              />
              <CodeBlock
                code={`curl -X POST ${baseUrl}/api/v1/pay \\
  -H "${authHeader}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "checkout-bot",
    "payerAddress": "0x518b9aba7586542e611909799f6d0b81e9552d9b",
    "txHash": "0x...",
    "type": "profile",
    "recipientUsername": "referealtest",
    "amount": 1,
    "tokenId": "usdc",
    "networkId": "sepolia"
  }'`}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Error codes</p>
          <p className="text-xs text-muted-foreground">
            API errors include a <span className="font-mono">code</span> field when
            applicable. Use preflight to catch issues before paying on-chain.
          </p>
          <ErrorCodesTable />
        </div>

        <Separator />

        <div className="space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Notes</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              Use{" "}
              <span className="font-mono">GET /api/v1/pay/preflight</span> before
              sending funds to confirm the agent, wallet, and recipient are ready.
            </li>
            <li>Disabled agents cannot use the API until re-enabled.</li>
            <li>
              Agents need an active compliance policy before create-link or pay.
              High-value pays may return HTTP 202 with <span className="font-mono">approvalId</span>;
              after merchant approval, retry pay with that id.
            </li>
            <li>Rotating your API key invalidates the previous key immediately.</li>
            <li>Payment signing and wallet funding are handled by your agent, not Fidence.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
