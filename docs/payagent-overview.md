# Payagent — Product & Technical Overview

Payagent is a crypto payments platform for **humans and AI agents**. Users create shareable payment links, receive on-chain stablecoin payments, and earn reward credits. Merchants register autonomous agents via API, enforce spend policies through a compliance engine, and record agent-initiated payments after on-chain settlement.

**Developed by LCX AI Labs.** The application codebase lives in this repository (`fidence`); production is deployed at [payagent.co](https://payagent.co).

---

## Table of contents

1. [Core principles](#1-core-principles)
2. [Architecture at a glance](#2-architecture-at-a-glance)
3. [Users, workspaces, and authentication](#3-users-workspaces-and-authentication)
4. [Supported networks and tokens](#4-supported-networks-and-tokens)
5. [Feature: Payment links](#5-feature-payment-links)
6. [Feature: Profile payments](#6-feature-profile-payments)
7. [Feature: Invoices](#7-feature-invoices)
8. [Feature: Wallets](#8-feature-wallets)
9. [Feature: Merchant agents & API](#9-feature-merchant-agents--api)
10. [Feature: Compliance engine](#10-feature-compliance-engine)
11. [Feature: Rewards and referrals](#11-feature-rewards-and-referrals)
12. [Feature: Dashboard, activity, and transactions](#12-feature-dashboard-activity-and-transactions)
13. [Feature: Leaderboard](#13-feature-leaderboard)
14. [Payment settlement flow](#14-payment-settlement-flow)
15. [API layers](#15-api-layers)
16. [Database collections](#16-database-collections)
17. [Background jobs and caching](#17-background-jobs-and-caching)
18. [Environment variables](#18-environment-variables)
19. [Scripts and tooling](#19-scripts-and-tooling)
20. [Security model](#20-security-model)
21. [Known limitations (v1)](#21-known-limitations-v1)
22. [Repository map](#22-repository-map)

---

## 1. Core principles

| Principle | What it means in practice |
|-----------|---------------------------|
| **Non-custodial** | Payagent never holds user or agent private keys. Payers sign transactions in their own wallet (browser or external agent wallet). |
| **Verify on-chain** | A payment is recorded only after Payagent verifies the transaction hash against the expected recipient, amount, and token on the relevant chain. |
| **Fail closed for agents** | Money APIs for registered agents require an **active compliance policy**. Without one, requests return `403 POLICY_DENIED` with code `NO_ACTIVE_POLICY`. |
| **Workspace tenancy** | Each human account owns a **workspace**. Payment links, invoices, agents, and API keys are scoped to that workspace. |
| **Append-only audit** | Policy decisions, money-path evaluations, and approval resolutions write immutable **decision receipts** with actor IP and metadata. |

---

## 2. Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Payagent (Next.js App)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Portal (session)          │  Merchant API v1 (Bearer key)              │
│  /dashboard, /payment-links│  /api/v1/agents, /payment-links, /pay     │
│  /merchant/*               │  /api/v1/compliance/*                      │
├────────────────────────────┼────────────────────────────────────────────┤
│  Public checkout           │  Internal jobs (CRON_SECRET)               │
│  /[username]/[linkId]      │  activity drain, archive, security audit   │
│  /[username] (profile pay) │                                            │
└────────────────────────────┴────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────┐
│ MongoDB         │          │ Upstash Redis   │
│ (primary data)  │          │ rate limits,    │
│                 │          │ session cache   │
└─────────────────┘          └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Blockchains — EVM (viem/wagmi) + Solana                                 │
│ Settlement verifiers read receipts / parsed transactions on-chain       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Major code areas:**

| Area | Path |
|------|------|
| App routes & pages | `src/app/` |
| UI components | `src/components/` |
| Business logic | `src/lib/` |
| Compliance engine | `src/lib/compliance/` |
| Database access | `src/lib/db/` |
| On-chain settlement | `src/lib/payment/settlement/` |
| Solidity contracts | `solidity/` |
| Tests & CLI | `scripts/` |

---

## 3. Users, workspaces, and authentication

### Human sign-in

Humans authenticate via the portal using:

- **Google OAuth** — `GET /api/auth/google` → callback creates session
- **Wallet signature** — `POST /api/auth/wallet` with address, message, signature

Sessions are stored in MongoDB and referenced by an HTTP-only cookie (`lcx-auth`). Authenticated pages live under the `(shell)` layout and call `requireShellSession()`.

**Key files:** `src/lib/db/auth.ts`, `src/lib/auth-session.ts`, `src/lib/shell-session.ts`

### Workspace model

- One **workspace** per owner user
- Workspace owns: payment links, invoices, verified wallets, agents, API keys, compliance policies
- Username on the owner user drives public URLs: `payagent.co/@username/linkId`

### Merchant API authentication

Programmatic access uses a **workspace API key**:

```
Authorization: Bearer fid_live_...
```

- Keys are stored hashed in `api_keys`
- Resolved via `getMerchantApiContext()` in `src/lib/db/merchant-api.ts`
- Rate limited via Upstash (`src/lib/merchant-api/rate-limit.ts`)
- Manage keys in portal: **Merchant → API credentials** (`/merchant/api-credentials`)

### Three access layers

| Layer | Auth | Who | Base paths |
|-------|------|-----|------------|
| **Portal** | Session cookie | Logged-in humans | `/api/payment-links`, `/api/invoices`, `/api/wallets`, `/api/merchant/*` |
| **Merchant API v1** | Bearer API key | Agents, integrations, CLI | `/api/v1/*` |
| **Public** | None (rate limited) | Payers, profile visitors | `/api/public/*`, `/api/pay/*`, public pages |

---

## 4. Supported networks and tokens

### Payment link creation (user-facing)

Defined in `src/lib/create-payment-link-data.ts`:

| Network | ID | Tokens |
|---------|-----|--------|
| Ethereum | `ethereum` | USDC, USDT, ETH |
| Base | `base` | USDC, USDT, ETH |
| Solana | `solana` | USDC, USDT, SOL |
| Sepolia (testnet) | `sepolia` | USDC, USDT, ETH |

Sepolia appears when `NEXT_PUBLIC_ENABLE_TESTNETS` is not `"false"`.

### EVM contract addresses

Token contract mappings for settlement live in `src/lib/payment-contracts.ts`. Additional mappings exist for Arbitrum and Polygon but those networks are **not** exposed in the payment-link UI.

### Wallet verification networks

Users can verify receiving wallets on EVM (Ethereum, Base, Sepolia) and Solana via `src/lib/wallet-networks.ts` and `src/lib/evm-networks.ts`.

### Compliance catalog

Policy allowlists use a slightly broader catalog (`src/lib/compliance/types.ts`):

- **Networks:** ethereum, base, sepolia, solana
- **Tokens:** usdc, usdt, eth, sol, lcx

LCX is policy-only; USD valuation for non-stablecoins may fail closed (`AMOUNT_VALUATION_UNAVAILABLE`).

---

## 5. Feature: Payment links

Payment links are the primary payment primitive. A creator specifies amount, token, network, and expiry; Payagent generates a public URL.

### URL format

```
https://payagent.co/{username}/{publicId}
```

Built by `buildPaymentLinkUrl()` in `src/lib/payment-link-url.ts`. Public IDs are 12-character hex strings from `generatePublicId()`.

### Creation paths

| Source | How | API / UI |
|--------|-----|----------|
| **Human (portal)** | Dashboard sheet or payment-links page | `POST /api/payment-links` |
| **Agent (API)** | Registered agent creates link | `POST /api/v1/payment-links` |
| **Agent batch** | Multiple links in one request | `POST /api/v1/payment-links/batch` |
| **Invoice** | Invoice flow attaches a link | Invoice APIs |

### Link lifecycle

Statuses (see `src/lib/payment-link-status.ts`):

- **pending** — payable until expiry
- **paid** — settlement verified, tx recorded
- **expired** — past `expiresAt`
- **cancelled** — manually cancelled

### Public checkout

Page: `src/app/[username]/[linkId]/page.tsx`  
Component: `src/components/pay/payment-link-checkout.tsx`

Flow:

1. Payer opens link
2. Connects wallet (RainbowKit for EVM, Solana wallet adapter)
3. Sends on-chain transfer to recipient's verified wallet
4. Frontend calls `POST /api/pay/[username]/[linkId]` with `txHash`
5. Server verifies settlement and marks link paid

### Agent-created links

Agent links are tagged with a commerce source (`agent`) and appear under **Payment Links → Agent mode** in the portal. Creating agent links requires:

1. Registered, active agent
2. Active compliance policy with `allowCreatePaymentLinks: true`
3. Network/token allowed by policy

### QR codes and payment URIs

- ERC-681 URIs for EVM: `src/lib/payment/erc681.ts`
- Solana Pay URIs: `src/lib/payment/solana-pay-uri.ts`
- QR display: `src/components/payment/payment-qr-code.tsx`

---

## 6. Feature: Profile payments

Users with a public username can receive **任意 amount** payments at:

```
https://payagent.co/{username}
```

Page: `src/app/[username]/page.tsx`  
Checkout: `src/components/pay/profile-payment-checkout.tsx`

- Payer chooses amount, token, network
- Same connect-wallet → send tx → report hash pattern
- Public API: `GET /api/public/users/[username]`, `POST /api/public/users/[username]/pay`
- Agent profile pay: `POST /api/v1/pay` with `type: "profile"`

Profile payments accrue **reward credits** (0.1% of amount) for eligible activity types.

---

## 7. Feature: Invoices

Full invoice workflow for businesses and freelancers.

### Pages

| Route | Purpose |
|-------|---------|
| `/invoice/new` | Create invoice |
| `/invoice/[id]` | Edit / preview |
| `/manage-invoices` | List and manage |

### Capabilities

- Line items, tax, currency formatting (`src/lib/invoice/`)
- PDF generation via `@react-pdf/renderer`
- Optional attached payment link (`src/lib/invoice/invoice-payment-link.ts`)
- Email share: `POST /api/invoices/[id]/share` (Resend)
- Serial numbers: `GET /api/invoices/next-serial`

### APIs

- `GET/POST /api/invoices`
- `GET/PATCH/DELETE /api/invoices/[id]`

When an invoice-linked payment link is paid, activity is logged as invoice-related events.

---

## 8. Feature: Wallets

Verified wallets are where users **receive** payments. Payagent resolves the recipient address per network when creating links or checkout.

### Portal page

`/wallets` — add, verify, remove wallets

### Verification flow

1. User adds address + network
2. Signs a challenge message (EVM via wagmi, Solana via adapter)
3. `POST /api/wallets/verify` confirms ownership
4. Only verified wallets can receive link/profile payments on that network

**Key files:** `src/lib/db/wallets.ts`, `src/components/wallets/*`

### Agent wallets (separate concept)

Registered **agents** have their own payer wallets for outbound agent payments:

- Added via `POST /api/v1/agents/wallet`
- Multiple wallets per agent (multi-network)
- `payerAddress` on pay APIs must match a registered agent wallet
- Payagent stores addresses only — agents sign externally

---

## 9. Feature: Merchant agents & API

Merchants register up to **10 agents per workspace** (`MAX_AGENTS_PER_WORKSPACE` in `src/lib/db/agents.ts`).

### Agent registration

```
POST /api/v1/agents/register
{ "agentId": "checkout-bot", "agentName": "Checkout Bot" }
```

Returns `publicId` (e.g. `agt_a1b2c3d4`). Agents can be enabled/disabled in portal (`PATCH /api/merchant/agents/[id]`).

### Agent wallet

```
POST /api/v1/agents/wallet
{ "agentId": "checkout-bot", "walletAddress": "0x...", "networkId": "sepolia" }
```

### Agent profile

```
GET /api/v1/agents/profile?agentId=checkout-bot
```

Returns registered wallets and metadata.

### Recommended agent payment flow

1. Register agent
2. Add wallet(s) that will hold on-chain balance
3. Activate compliance policy (portal, API, or CLI)
4. Create payment links **or** pay profiles
5. **Preflight** before sending on-chain tx
6. Send transaction from agent wallet
7. **Report** tx via `POST /api/v1/pay`

### Merchant API docs in product

Embedded reference: `src/components/merchant/merchant-api-docs.tsx` on the API credentials page.

### Compliance CLI

Interactive terminal for policy setup:

```bash
export PAYAGENT_API_KEY=fid_live_...
npm run compliance:cli
```

Script: `scripts/payagent-compliance-cli.mjs`  
User-Agent: `payagent-compliance-cli/1.0` (logged as `authMethod: cli` in audit).

---

## 10. Feature: Compliance engine

The compliance engine governs **all agent money paths**: create link, batch create, pay link, pay profile, and preflight policy checks.

### Policy fields

| Field | Description |
|-------|-------------|
| `status` | `draft` or `active` — only **active** policies enforce |
| `maxAmountPerPayment` | USD ceiling per single payment |
| `dailySpendCap` | USD daily limit |
| `monthlySpendCap` | USD monthly limit (optional) |
| `allowedNetworkIds` | e.g. `["ethereum", "base", "sepolia"]` |
| `allowedTokenIds` | e.g. `["usdc", "usdt"]` |
| `allowCreatePaymentLinks` | Permission to create links |
| `allowPay` | Permission to pay links/profiles |
| `requireApprovalAbove` | USD threshold; larger payments park for human approval |
| `confirmWideOpen` | Required when activating with `dailySpendCap >= 10000` |

Policy types: `src/lib/compliance/types.ts`  
Evaluator: `src/lib/compliance/evaluate-policy.ts` (pure function, fail closed)

### Verdicts

| Verdict | HTTP | Meaning |
|---------|------|---------|
| `allow` | 200 | Proceed |
| `deny` | 403 | Blocked with `POLICY_DENIED` + codes |
| `require_approval` | 202 | Payment parked; human must approve in portal |

### Policy error codes

Full list in `src/lib/compliance/codes.ts`. Common codes:

| Code | Meaning |
|------|---------|
| `NO_ACTIVE_POLICY` | No active policy on agent |
| `ACTION_NOT_ALLOWED` | Create or pay disallowed by policy |
| `NETWORK_NOT_ALLOWED` / `TOKEN_NOT_ALLOWED` | Not on allowlist |
| `AMOUNT_ABOVE_MAX` | Exceeds per-payment max |
| `DAILY_CAP_EXCEEDED` / `MONTHLY_CAP_EXCEEDED` | Spend caps |
| `APPROVAL_REQUIRED` | Needs human approval |
| `AMOUNT_VALUATION_UNAVAILABLE` | Cannot price token in USD (e.g. ETH/SOL/LCX) |
| `SETTLEMENT_AMOUNT_UNKNOWN` | On-chain amount could not be read |

Denied responses include `receiptId` (`dec_…`) for audit lookup.

### Spend tracking

- **Paid spend** — reserved before settlement, committed after successful verify, rolled back on failure
- **Outstanding exposure** — unpaid pending links count toward caps when creating new links (prevents link-factory cap bypass)

Collections: `agent_spend_daily`, `agent_spend_monthly`

### Human approval workflow

When `requireApprovalAbove` triggers:

1. Pay API returns `202` with approval ID
2. Merchant sees pending item in **Compliance → Approvals**
3. Approve: `POST /api/merchant/compliance/approvals/[id]/approve`
4. Reject: `POST /api/merchant/compliance/approvals/[id]/reject`
5. Agent retries pay with `approvalId`

Approval states include atomic **claim** to prevent replay attacks.

Poll status via API: `GET /api/v1/compliance/approvals/[id]`

### Decision receipts & audit

Every policy mutation and money-path evaluation appends to `policy_decisions`:

- `receiptId`, action, verdict, codes
- Actor: type, auth method, **IP** (server-derived, never from client body)
- Optional: agentId, amountUsd, networkId, tokenId

Query:

- Portal: `/api/merchant/compliance/audit`, per-agent decisions
- API key: `/api/v1/compliance/audit`, `/api/v1/compliance/agents/:agentId/decisions`

Runbook: `docs/compliance-audit.md`

### Policy management surfaces

| Surface | Path |
|---------|------|
| Portal UI | `/merchant/compliance`, `/merchant/compliance/[agentId]` |
| Portal API | `/api/merchant/compliance/agents/[id]/policy` |
| Merchant API | `/api/v1/compliance/agents/[agentId]/policy` |
| CLI | `npm run compliance:cli` |
| Catalog | `GET /api/v1/compliance/catalog` (letter keys for CLI) |

### Enforcement configuration

`src/lib/compliance/enforcement.ts`:

- Default: enforcement **on**
- `COMPLIANCE_ENFORCEMENT=off` only fail-opens when `COMPLIANCE_ENFORCEMENT_BREAK_GLASS=1`
- In production, off without break-glass **still enforces**
- Bypass writes `ENFORCEMENT_BYPASSED` receipt

### Content guard (optional)

If `SUPERAGENT_API_KEY` is set, `src/lib/compliance/content-guard.ts` can block requests via external moderation (`CONTENT_GUARD_BLOCKED`).

### Agents cannot edit their own policies

Policy write requires workspace API key or portal session — not agent identity. This prevents self-escalation.

---

## 11. Feature: Rewards and referrals

### Reward credits

Config: `src/lib/reward-config.ts`

- **0.1%** of payment amount accrues as credits on eligible payment types
- Eligible: `payment_received`, `profile_payment`, `payment_sent`
- Displayed on `/rewards`

### Referrals

- Referral code captured on sign-up (cookie `lcx-ref`, 30 days)
- **5 credits** per successful referral signup
- Portal: `/referrals`
- Lib: `src/lib/referrals.ts`, `src/lib/db/referrals.ts`

### LCX / PAYAGENT token

- Token info page: `/token`
- Sepolia PAYAGENT ERC-20: `src/lib/payagent-token.ts`
- Oracle: `src/lib/payagent-oracle.ts`
- Public docs mention LCX network fees and creator rewards on paid links (product/marketing layer)

---

## 12. Feature: Dashboard, activity, and transactions

### Dashboard (`/dashboard`)

Aggregated overview via `GET /api/dashboard/overview`:

- Section cards (metrics)
- Recent transactions
- Recent payment links
- Activity feed
- Quick actions (create link, etc.)

Components: `src/components/section-cards.tsx`, `recent-transactions.tsx`, `payment-links.tsx`, `recent-activity.tsx`, `quick-actions.tsx`

### Transactions (`/transactions`)

Historical confirmed payments from `transactions` collection.

### Activity (`/activity`)

Real-time feed from `activity_events`:

- Link created/paid, agent events, invoice events, etc.
- Hot storage with archival to `activity_events_archive`
- Jobs: `drain-activity`, `archive-activity`

---

## 13. Feature: Leaderboard

Public agent leaderboard at `/leaderboard`.

- API: `GET /api/public/leaderboard`
- Ranking logic: `src/lib/agent-leaderboard-rank.ts`, `src/lib/db/agent-leaderboard.ts`

---

## 14. Payment settlement flow

### Human payment link

```
Payer opens link → connect wallet → send on-chain tx
    → POST /api/pay/[username]/[linkId] { txHash, payerAddress }
    → verifySettlement(intent, txHash)
    → mark link paid, insert transaction, rewards, activity
```

### Agent payment link or profile

```
GET /api/v1/pay/preflight  (optional but recommended)
    → compliance + readiness checks
Agent sends on-chain tx from registered wallet
    → POST /api/v1/pay { type, txHash, payerAddress, ... }
    → gateAgentPayPolicy()
    → reserve spend → verifySettlement → commit or rollback
    → record transaction, activity, agent stats
```

### Preflight checks (agents)

`src/lib/db/agent-pay-preflight.ts` returns `ready: boolean` and per-check results:

- API key valid
- Agent registered and active
- Agent wallet configured / payerAddress match
- Link found and payable (for link type)
- Token/network supported
- Recipient wallet configured
- Policy readiness (via evaluatePolicy)

### Settlement verifiers

Router: `src/lib/payment/settlement/index.ts`

| Chain | Verifier | Method |
|-------|----------|--------|
| EVM | `verify-wagmi.ts` | viem public client — receipt + transfer logs |
| Solana | `verify-solana.ts` | Parsed transaction, SPL/native transfer match |
| Contract mode | `verify-contract.ts` | Stub (returns false) |

Mode controlled by `PAYMENT_SETTLEMENT_VERIFY_MODE`:

- `wagmi` (default) — full on-chain verification
- `format` / `off` — dev-only format checks
- `contract` — smart contract verifier (not production-ready)

### Amount verification

Profile and agent pays use **observed on-chain amount** where possible. Mismatch or unknown amount yields `SETTLEMENT_AMOUNT_UNKNOWN`.

---

## 15. API layers

### Portal APIs (session required)

| Area | Endpoints |
|------|-----------|
| Payment links | `GET/POST /api/payment-links` |
| Pay (human) | `GET/POST /api/pay/[username]/[linkId]` |
| Invoices | `/api/invoices/*` |
| Wallets | `/api/wallets/*`, `POST /api/wallets/verify` |
| Profile | `PATCH /api/user/profile` |
| Dashboard | `GET /api/dashboard/overview` |
| Activity | `GET /api/activity` |
| Merchant | `/api/merchant/api-key`, `/api/merchant/agents/*` |
| Compliance | `/api/merchant/compliance/*` |

### Merchant API v1 (Bearer key)

| Area | Endpoints |
|------|-----------|
| Agents | `POST /api/v1/agents/register`, `POST /api/v1/agents/wallet`, `GET /api/v1/agents/profile` |
| Payment links | `POST /api/v1/payment-links`, `POST /api/v1/payment-links/batch` |
| Pay | `GET /api/v1/pay/preflight`, `POST /api/v1/pay` |
| Compliance | `GET /api/v1/compliance/catalog`, `GET /api/v1/compliance/agents`, `GET|PUT .../policy`, `GET .../decisions`, `GET /api/v1/compliance/audit`, `GET /api/v1/compliance/approvals/[id]` |

### Public APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /api/public/users/[username]` | Public profile |
| `POST /api/public/users/[username]/pay` | Record profile payment |
| `GET /api/public/leaderboard` | Leaderboard |
| `GET /api/health` | Health check |

### Internal (cron)

Protected by `CRON_SECRET`:

- `/api/internal/jobs/drain-activity`
- `/api/internal/jobs/archive-activity`
- `/api/internal/jobs/drain-security-audit`

---

## 16. Database collections

Defined in `src/lib/db/collections.ts`:

| Collection | Purpose |
|------------|---------|
| `users` | User accounts |
| `workspaces` | Tenant per owner |
| `workspace_members` | Membership (future/multi-user) |
| `sessions` | Auth sessions |
| `payment_links` | All payment links |
| `transactions` | Confirmed payments |
| `balances` | Workspace balances |
| `activity_events` | Hot activity feed |
| `activity_events_archive` | Archived activity |
| `invoices` | Invoices |
| `workspace_daily_stats` | Daily aggregates |
| `api_keys` | Hashed merchant API keys |
| `agents` | Registered agents |
| `security_audit` | Security events |
| `db_meta` | Migration metadata |
| `agent_policies` | Compliance policies |
| `policy_decisions` | Decision receipts (audit) |
| `agent_spend_daily` | Daily USD spend |
| `agent_spend_monthly` | Monthly USD spend |
| `payment_approvals` | Human approval queue |

Setup: `npm run db:setup` — indexes including compliance indexes (`src/lib/db/compliance-indexes.ts`).

---

## 17. Background jobs and caching

### Redis (Upstash)

- Session cache (`SESSION_CACHE_ENABLED`)
- Merchant API context cache
- Payment link cache
- Rate limiting (auth, public pay, merchant API)

### Activity pipeline

Events may be queued and drained asynchronously to reduce write latency on hot paths.

### Security audit

Security-sensitive actions (agent register, wallet add, etc.) log to `security_audit` with optional async drain.

---

## 18. Environment variables

### Required for production

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | Primary database |
| `AUTH_SECRET` | Session signing |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth (if using Google) |

### Common optional

| Variable | Purpose |
|----------|---------|
| `MONGODB_READ_URI` | Read replica |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | Redis |
| `NEXT_PUBLIC_APP_URL` | App base URL |
| `NEXT_PUBLIC_PAYMENT_DOMAIN` | Payment link domain |
| `ALCHEMY_API_KEY` | EVM RPC |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect |
| `RESEND_API_KEY` | Invoice email |
| `CRON_SECRET` | Internal jobs |

### Compliance & settlement

| Variable | Purpose |
|----------|---------|
| `COMPLIANCE_ENFORCEMENT` | Enable/disable (with break-glass rules) |
| `COMPLIANCE_ENFORCEMENT_BREAK_GLASS` | Allow fail-open in non-prod |
| `PAYMENT_SETTLEMENT_VERIFY_MODE` | `wagmi` \| `format` \| `off` \| `contract` |
| `SUPERAGENT_API_KEY` | Optional content guard |

### Feature flags

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_ENABLE_TESTNETS` | Show Sepolia in UI |

### Script / test only

`PAYAGENT_API_KEY`, `PAYAGENT_BASE_URL`, `SEPOLIA_PRIVATE_KEY`, `E2E_*`, load/spike test vars.

---

## 19. Scripts and tooling

### npm scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` / `start` | Production |
| `npm run db:setup` | Database bootstrap |
| `npm run test:unit` | Unit tests |
| `npm run test:compliance` | Compliance integration tests |
| `npm run test:compliance-attack` | Security attack scenarios |
| `npm run compliance:cli` | Interactive policy CLI |
| `npm run test:e2e` | End-to-end payment test |
| `npm run seed:payment-links` | Seed demo links |
| `npm run contracts:compile` | Solidity compile |
| `npm run contracts:deploy:sepolia` | Deploy contracts |

### Notable scripts

| File | Purpose |
|------|---------|
| `scripts/payagent-compliance-cli.mjs` | Compliance CLI |
| `scripts/test-compliance-integration.ts` | Compliance tests |
| `scripts/test-compliance-attack.ts` | Attack suite |
| `scripts/pay-payment-link.ts` | CLI pay a link on Sepolia |
| `scripts/test-merchant-agents.ts` | Agent API smoke test |

---

## 20. Security model

### Authentication & authorization

- Portal routes require valid session
- v1 routes require valid API key scoped to workspace
- Agents cannot mutate their own policies
- Internal jobs require `CRON_SECRET`

### Request security context

Every merchant/compliance action captures:

- Client IP (from headers, not client body)
- User agent
- Auth method (session, api_key, cli)

Used in `policy_decisions` and `security_audit`.

### Rate limiting

- IP-based limits on auth and public pay endpoints
- Workspace-based limits on merchant API

### On-chain safety

- Settlement verification before marking paid
- Agent payer address must match registered wallet
- Spend reserved before settle, rolled back on duplicate/failure

### Key handling

- API keys stored hashed
- Private keys never stored by Payagent
- Wallet verification via signed messages only

---

## 21. Known limitations (v1)

| Limitation | Detail |
|------------|--------|
| **USD valuation** | USDC/USDT treated 1:1; ETH/SOL/LCX fail closed without price |
| **Agent wallet provisioning** | Merchants must supply wallet addresses; no auto-generated custodial wallets |
| **Approval API** | Approve/reject is portal-only; v1 can poll approval status but not resolve via API key |
| **Contract settlement mode** | Stub, not for production |
| **Agent limit** | 10 agents per workspace |
| **Audit retention** | Append-only; no automated IP erasure |
| **AI distribution** | No published MCP/skills package yet; integrate via REST + checkout URLs |
| **LCX on-chain fees** | Documented in marketing/docs; implementation varies by network/product mode |

---

## 22. Repository map

```
fidence/
├── docs/
│   ├── payagent-overview.md      ← this document
│   └── compliance-audit.md       ← compliance runbook
├── scripts/                      ← tests, CLI, deploy helpers
├── solidity/                     ← smart contracts
├── public/                       ← static assets, token icons
└── src/
    ├── app/
    │   ├── (auth)/               ← sign-in, sign-up
    │   ├── (shell)/              ← authenticated app
    │   ├── [username]/           ← public profile & payment links
    │   └── api/                  ← all API routes
    ├── components/
    │   ├── pay/                  ← checkout flows
    │   ├── merchant/             ← API docs, agents UI
    │   ├── compliance/           ← policy UI
    │   ├── invoice/              ← invoice editor
    │   └── wallets/              ← wallet management
    └── lib/
        ├── compliance/           ← policy engine
        ├── db/                   ← MongoDB access
        ├── payment/              ← settlement, URIs
        └── ...                   ← auth, referrals, rewards, etc.
```

### Related documentation

| Document | Location |
|----------|----------|
| Compliance audit runbook | `docs/compliance-audit.md` |
| In-app API reference | Merchant → API credentials page |
| Style guide | `docs/STYLE_GUIDE.md` |
| Public docs page | `/docs` (site) |

---

## Quick reference: agent integration checklist

1. Create API key in portal
2. `POST /api/v1/agents/register`
3. `POST /api/v1/agents/wallet` (fund wallet externally)
4. Activate policy — portal, `PUT /api/v1/compliance/agents/:id/policy`, or `npm run compliance:cli`
5. `POST /api/v1/payment-links` or prepare profile pay
6. `GET /api/v1/pay/preflight`
7. Send on-chain transaction
8. `POST /api/v1/pay` with `txHash`
9. On `202 APPROVAL_REQUIRED` — wait for portal approval, retry with `approvalId`

---

*Last updated from codebase inventory. For API request/response schemas, see `src/components/merchant/merchant-api-docs.tsx`.*
