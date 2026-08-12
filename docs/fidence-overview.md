# Fidence — Product Overview

Fidence is a crypto payments platform for **humans and AI agents**. Users create shareable payment links, receive on-chain payments, and earn reward credits. Merchants register autonomous agents via API, enforce spend policies, and record agent-initiated payments after on-chain settlement.

This page is a **public product overview** for merchants and integrators. Operational runbooks, database schemas, and deployment secrets are **not** published here.

---

## Table of contents

1. [Core principles](#1-core-principles)
2. [Who uses Fidence](#2-who-uses-fidence)
3. [Supported networks and tokens](#3-supported-networks-and-tokens)
4. [Payment links](#4-payment-links)
5. [Profile payments](#5-profile-payments)
6. [Invoices](#6-invoices)
7. [Wallets](#7-wallets)
8. [Merchant agents and API](#8-merchant-agents-and-api)
9. [Compliance and spend policies](#9-compliance-and-spend-policies)
10. [Rewards and referrals](#10-rewards-and-referrals)
11. [Agent integration checklist](#11-agent-integration-checklist)
12. [Public API surface](#12-public-api-surface)

---

## 1. Core principles

| Principle | What it means |
|-----------|----------------|
| **Non-custodial** | Fidence never holds private keys. Payers sign in their own wallet. |
| **Verify on-chain** | Payments are recorded only after the transaction is verified on-chain. |
| **Fail closed for agents** | Agent money APIs require an **active compliance policy**. |
| **Workspace tenancy** | Each account has a workspace. Links, agents, and keys stay scoped to that workspace. |
| **Audit trail** | Policy decisions and agent money actions produce receipts for compliance review. |

---

## 2. Who uses Fidence

| User | Typical flow |
|------|----------------|
| **Merchant (human)** | Sign in → verify receiving wallets → create links or invoices → get paid |
| **Payer (human)** | Open a link or profile → connect wallet → pay on-chain |
| **Agent (programmatic)** | API key → register agent → policy → preflight → pay → report `txHash` |

---

## 3. Supported networks and tokens

| Network | ID | Tokens (checkout) |
|---------|-----|-------------------|
| Ethereum | `ethereum` | USDC, USDT, ETH |
| Base | `base` | USDC, USDT, ETH |
| Solana | `solana` | USDC, USDT, SOL |
| Sepolia (testnet) | `sepolia` | USDC, USDT, ETH |

Sepolia may be hidden when testnets are disabled in your deployment.

Agent policies can restrict which networks and tokens an agent may use. USD caps apply to stablecoins directly; native tokens (ETH, SOL) require live pricing or the request may be denied.

---

## 4. Payment links

A payment link is a shareable URL with a fixed amount, token, network, and expiry.

**URL format:** `/{username}/{publicId}`

| Status | Meaning |
|--------|---------|
| `pending` | Payable until expiry |
| `paid` | Settled on-chain |
| `expired` | Past expiry |
| `cancelled` | Cancelled by creator |

**Create (portal):** Dashboard or Payment links  
**Create (agent API):** `POST /api/v1/payment-links` or batch create

**Pay (payer):** Open link → connect wallet → send transaction → checkout confirms with `txHash`

---

## 5. Profile payments

Users with a public username can receive **any amount** at `/{username}`.

Same wallet-connect and on-chain flow as links. Agents can pay profiles via `POST /api/v1/pay` with `type: "profile"`.

---

## 6. Invoices

Create and manage invoices in the portal (`/invoice/new`, `/manage-invoices`). Invoices can include line items, PDF export, email share, and an optional attached payment link.

---

## 7. Wallets

**Receiving wallets (humans):** Verified in **Wallets** before you can receive on a network. Verification uses a signed message — no private keys are stored.

**Agent payer wallets:** Registered via `POST /api/v1/agents/wallet`. The address used in `POST /api/v1/pay` must match a registered agent wallet. Agents sign transactions externally.

---

## 8. Merchant agents and API

### Authentication

```
Authorization: Bearer fid_live_...
```

Manage keys in the portal under **Merchant → API credentials** (sign-in required).

### Typical agent lifecycle

1. `POST /api/v1/agents/register`
2. `POST /api/v1/agents/wallet`
3. Activate a compliance policy (portal or API)
4. `GET /api/v1/pay/preflight` (recommended)
5. Send on-chain transaction from the agent wallet
6. `POST /api/v1/pay` with `txHash`

### Idempotency

`POST /api/v1/pay` requires an `Idempotency-Key` header so retries are safe.

Use the **Merchant API reference** on this page (sidebar) or sign in to **API credentials** for request examples.

---

## 9. Compliance and spend policies

Every agent money action is evaluated against an **active policy**:

| Field | Purpose |
|-------|---------|
| `maxAmountPerPayment` | Per-payment USD ceiling |
| `dailySpendCap` / `monthlySpendCap` | Spend limits |
| `allowedNetworkIds` / `allowedTokenIds` | Allowlists |
| `allowCreatePaymentLinks` / `allowPay` | Permissions |
| `requireApprovalAbove` | Large payments need human approval |

### Verdicts

| Result | HTTP | Meaning |
|--------|------|---------|
| Allowed | 200 | Proceed |
| Denied | 403 | Blocked (`POLICY_DENIED` + codes) |
| Approval required | 202 | Human must approve; retry with `approvalId` |

Common codes: `NO_ACTIVE_POLICY`, `DAILY_CAP_EXCEEDED`, `APPROVAL_REQUIRED`, `NETWORK_NOT_ALLOWED`, `TOKEN_NOT_ALLOWED`.

Poll approvals: `GET /api/v1/compliance/approvals/[id]`  
Programmatic approve/reject: available with scoped admin keys where enabled in your deployment.

---

## 10. Rewards and referrals

- **Reward credits:** A small percentage of eligible payment volume accrues as credits (see **Rewards** in the portal).
- **Referrals:** Referral codes on sign-up; see **Referrals** in the portal.

---

## 11. Agent integration checklist

1. Create an API key in the portal
2. `POST /api/v1/agents/register`
3. `POST /api/v1/agents/wallet` (fund the wallet externally)
4. Activate policy — `PUT /api/v1/compliance/agents/{agentId}/policy`
5. Create a link or prepare a profile pay
6. `GET /api/v1/pay/preflight`
7. Send on-chain transaction
8. `POST /api/v1/pay` with `txHash` and `Idempotency-Key`
9. If `202 APPROVAL_REQUIRED` — resolve approval, then retry with the same `approvalId`

OpenAPI spec (machine-readable): `GET /api/v1/openapi.json`

---

## 12. Public API surface

These endpoints are intended for unauthenticated or payer-facing use (subject to rate limits):

| Endpoint | Purpose |
|----------|---------|
| `GET /api/public/users/[username]` | Public profile |
| `POST /api/public/users/[username]/pay` | Record profile payment (checkout) |
| `GET /api/public/leaderboard` | Leaderboard |
| `GET /api/health` | Service health |

All merchant and agent operations require a valid API key or portal session.

---

## Security notes (public)

- API keys are secrets — treat them like passwords; rotate if leaked.
- Fidence does not store payer or merchant private keys.
- Only report payments with valid on-chain transaction hashes you control.
- Use **preflight** before sending funds to avoid failed or rejected settlements.

For deployment, infrastructure, and internal security runbooks, use your private operator documentation — not this public page.

---

*For interactive API examples, use the reference in the sidebar or sign in to Merchant → API credentials.*
