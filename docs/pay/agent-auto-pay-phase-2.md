# Fidence Pay — Phase 2: Mandate-Governed Auto-Pay

This document describes the architecture for **autonomous agent payments within mandate limits**, without per-transaction browser approval. Phase 1 (address payments + portal approval) is implemented separately.

## Goals

1. **Wallet-to-wallet autonomy** — Agent sends to any `0x…` address when within mandate.
2. **E-commerce flow** — User says "Claude, buy me this"; agent executes if policy allows.
3. **No server-side keys** — Fidence never stores private keys; signing stays client-side.
4. **Full audit trail** — Every payment recorded in Activity with amount, recipient, agent, tx hash.

## Current state (after Phase 1)

| Step | Behavior |
|------|----------|
| Agent creates intent | `POST /api/v1/payment-intents` with `type: address` |
| Preflight | `GET /api/v1/pay/preflight?type=address&recipientAddress=0x…` |
| Human approval | Portal popup → wallet sign → `POST /api/pay/payment-intents/:id/complete` |
| Recording | On-chain verify + policy gate + Activity |

**Gap:** Browser approval is required for every payment, even when amount is within mandate.

## Target state (Phase 2)

```
User connects agent + sets mandate
        ↓
Agent requests payment (preflight)
        ↓
   Within mandate?
    /          \
  Yes          No (or above requireApprovalAbove)
   ↓                ↓
Auto-sign      Portal approval OR compliance approval
   ↓                ↓
POST /api/v1/pay (record only)   Same as today
   ↓
Activity + spend counters updated
```

## Signing models (pick one or combine)

### Option A — Local signer daemon (recommended first)

At agent connect, user installs a small local service (`fidence-signer`) that:

- Holds a **session-scoped signing key** derived from wallet signature at connect time
- Enforces mandate limits locally before signing
- Exposes `POST /sign` on `localhost` for Claude Code / CLI
- Never sends private keys to Fidence servers

**Pros:** Simple, works with existing EOA wallets, keys never leave user's machine.  
**Cons:** Requires local daemon running; session expires on restart unless persisted encrypted.

### Option B — Smart wallet / session keys (ERC-4337)

At connect, user deploys or uses a smart wallet with:

- Spend limits encoded in contract or session module
- Agent receives scoped `UserOperation` signing rights
- Fidence verifies on-chain execution matches mandate

**Pros:** Best UX for power users; revocable on-chain.  
**Cons:** Higher integration cost; network support varies.

### Option C — Agent-bound wallet (existing merchant API pattern)

User connects a **dedicated agent wallet** (separate from daily wallet) at setup:

- Agent/CLI holds key in `~/.fidence/agent-wallet.json` (encrypted)
- Prefunded with spending budget
- Same as current `POST /api/v1/pay` merchant flow

**Pros:** Already partially built for merchant API agents.  
**Cons:** User must manage separate wallet + fund it.

## Recommended path

**Phase 2a:** Local signer daemon + auto-skip portal when preflight passes  
**Phase 2b:** Smart wallet for seamless "buy me this"  
**Phase 2c:** Merchant allowlist + commerce metadata on intents

## API changes (Phase 2)

### 1. Mandate flag: `autoPayEnabled`

```typescript
// agent policy schema addition
autoPayEnabled: boolean;  // default false
allowedRecipientAddresses?: string[];  // optional allowlist for e-commerce
```

When `autoPayEnabled` and preflight → `ready: true` and amount < `requireApprovalAbove`:

- Skip payment intent creation
- Agent signs locally
- Agent calls `POST /api/v1/pay` directly with `txHash`

### 2. Connect-time delegation

`POST /api/pay/link-sessions/:lid/approve` extended to capture:

```json
{
  "signingMode": "local_daemon" | "browser_only" | "agent_wallet",
  "payerWalletId": "…",
  "sessionExpiresAt": "…"
}
```

### 3. Commerce metadata (e-commerce)

Payment intents and pay records gain optional fields:

```typescript
merchantName?: string;
orderId?: string;
description?: string;
savedAddressId?: ObjectId;  // already exists on intents
```

Shown in Activity: *"Agent payment · $49 USDC to ShopX · order #1234"*

### 4. Auto-pay endpoint (optional shortcut)

`POST /api/v1/pay/auto` — combines preflight + returns `{ signPayload }` without creating intent when auto-pay eligible. Agent signs and calls `POST /api/v1/pay`.

## Security constraints

| Rule | Enforcement |
|------|-------------|
| No keys on server | Signing only client-side |
| Mandate caps | Policy gate at `POST /api/v1/pay` (unchanged) |
| Large amounts | `requireApprovalAbove` → compliance approval or portal |
| Revocation | Disconnect agent → scoped key invalidated |
| Recipient allowlist | Optional policy field; deny if not listed |

## Portal UX (Phase 2)

- **Mandates page:** Toggle "Allow automatic payments within limits"
- **Agents page:** Show signing mode (Browser / Local signer / Agent wallet)
- **Activity:** Filter agent payments; show recipient address or `@username`

## CLI / skills (Phase 2)

```bash
# Auto-pay when mandate allows (no portal)
fidence pay --to 0x… --amount 1 --network sepolia --token usdt --auto

# Start local signer
fidence signer start
```

Skill update for Claude: *"If preflight passes and autoPay is enabled, sign via local signer and record with POST /api/v1/pay. Otherwise create payment intent and ask user to approve in browser."*

## Implementation order

1. **`autoPayEnabled` policy field** + UI toggle on `/pay/mandates`
2. **Preflight auto-pay hint** — response includes `{ autoPayEligible: true }`
3. **Skip intent when eligible** — CLI `--auto` flag calls pay directly
4. **`fidence-signer` package** — local HTTP signer with mandate enforcement
5. **Commerce metadata** — `merchantName`, `orderId` on intents
6. **Recipient allowlist** — optional policy constraint

## Files to touch (Phase 2)

| Area | Files |
|------|-------|
| Policy schema | `src/lib/compliance/types.ts`, `src/lib/db/agent-policies.ts` |
| Policy UI | `src/components/pay-portal/mandates-page-content.tsx` |
| Preflight | `src/lib/db/agent-pay-preflight.ts` |
| Connect flow | `src/lib/db/agent-links.ts`, connect page |
| New package | `packages/fidence-signer/` |
| CLI | `packages/fidence-cli/src/index.ts` |
| Skills | `fidence-skills/fidence-pay/SKILL.md` |

## Non-goals (Phase 2)

- Storing user private keys on Fidence servers
- Custodial wallets
- Automatic mandate increases without user action
