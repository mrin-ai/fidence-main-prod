# Compliance Engine audit runbook

## What is stored

Every policy mutation, money-path decision, and approval resolution writes an append-only row in `policy_decisions` with:

- `receiptId` (`dec_…`)
- `action`, `verdict`, `codes`
- nested `actor` including **`ip`** (never redacted)
- optional `agentId` / `externalAgentId` / `amountUsd` / network / token

IPs come from `extractSecurityContext` / `getClientIp`. Client JSON bodies cannot set IP.

## Querying

Portal:

- `GET /api/merchant/compliance/audit?ip=&actorType=&agentId=&from=&to=&limit=`
- `GET /api/merchant/compliance/agents/:id/decisions`

API key:

- `GET /api/v1/compliance/audit`
- `GET /api/v1/compliance/agents/:agentId/decisions`

## Actor mapping

| Source | `actorType` | `authMethod` |
|--------|-------------|--------------|
| Dashboard session | `user` | `session` |
| Workspace API key | `api_key` | `api_key` |
| Compliance CLI (`User-Agent: payagent-compliance-cli/1.0`) | `api_key` | `cli` |
| Agent money APIs | `agent` | — |
| Approval TTL expiry | `system` | `system` (`ip: "system"`) |

## Enforcement flag

`COMPLIANCE_ENFORCEMENT=0|false|off` fail-opens money APIs **only when** `COMPLIANCE_ENFORCEMENT_BREAK_GLASS=1` is also set. In production, off without break-glass still enforces. Bypass always writes `ENFORCEMENT_BYPASSED`.

## Spend caps

- **Paid spend** increments the daily/monthly ledger only after a successful first-time pay (reserved before settlement; rolled back if settle fails).
- **Outstanding unpaid links** (pending, unexpired) also count toward remaining daily/monthly room when creating links or batches, so link factories cannot exceed caps without paying.

## Retention

v1 is append-only with no automated IP erasure job. Treat decision/audit data as investigation evidence.
