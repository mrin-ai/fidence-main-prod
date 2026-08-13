# fidence-cli

Command-line tool for [Fidence Pay](https://fidence.xyz) — connect AI agents to your wallet with scoped permissions and mandates.

## Install

```bash
npm install -g fidence-cli
```

Or run without installing:

```bash
npx fidence-cli setup --platform claude --name "My Agent"
```

## Quick start

1. Install the [fidence-pay skill](https://github.com/mrin-ai/fidence-skills):

   ```bash
   npx skills add https://github.com/mrin-ai/fidence-skills --skill fidence-pay --global --yes
   ```

2. Point at your Fidence instance (default is local dev):

   ```bash
   export FIDENCE_BASE_URL=https://pay.fidence.xyz
   ```

3. Connect an agent:

   ```bash
   fidence setup --platform claude --name "My Agent"
   ```

4. Approve the link in your browser, then poll for the scoped API key:

   ```bash
   fidence setup poll
   ```

## Commands

| Command | Description |
|---------|-------------|
| `fidence setup` | Create an agent link session |
| `fidence setup poll` | Wait for portal approval; saves `fid_agent_` key |
| `fidence status` | Show saved config |
| `fidence preflight` | Dry-run compliance check |
| `fidence pay` | Create a payment intent and wait for approval |
| `fidence pay --auto --to 0x…` | Headless pay (local sign, no browser) |
| `fidence wallet import` | Save payer private key to `~/.fidence/wallet.json` |

### Headless auto-pay (no browser)

Requires **Automatic payments** enabled on `/pay/mandates`.

```bash
fidence wallet import --private-key 0x…
export FIDENCE_SEPOLIA_RPC_URL=https://…   # recommended
fidence pay --auto --to 0x… --amount 10 --network sepolia --token usdt
```

### Pay any wallet (portal approval)

```bash
fidence preflight --type address --to 0x… --amount 1 --network sepolia --token usdt
fidence pay --to 0x… --amount 1 --network sepolia --token usdt
```

Pay a Fidence user by username:

```bash
fidence pay --username mrinaltest --amount 1 --network sepolia --token usdt
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `FIDENCE_BASE_URL` | `http://localhost:3000` | Fidence app URL (no trailing slash) |
| `FIDENCE_WALLET_PRIVATE_KEY` | — | Payer key (alternative to `wallet import`) |
| `FIDENCE_SEPOLIA_RPC_URL` | public RPC | RPC for local signing on Sepolia |
| `FIDENCE_RPC_URL` | — | Fallback RPC for all networks |

Config is stored in `~/.fidence/config.json`. Local wallet in `~/.fidence/wallet.json` (mode 600).

## License

MIT
