# LCX Auth Style Guide

Auth pages (`/sign-in`, `/sign-up`) use a light theme scoped via the `.lcx-auth` class, aligned with the main Fidence dashboard palette and LCX electric blue accents.

## Brand colors

| Token | Value | Usage |
|-------|-------|--------|
| `--lcx-blue` | `#0066FF` | Primary actions, links, feature icons |
| `--lcx-blue-muted` | `#0047B3` | Hover states, secondary accents |
| Background | White | Page and panel backgrounds |
| Foreground | Dark blue-gray | Headings and body text |
| Borders | Light gray | Cards, inputs, dividers |

## Typography

| Role | Font | Notes |
|------|------|--------|
| UI / body | Geist Sans | Buttons, descriptions, legal copy |
| Headings / tagline | Instrument Serif | Echoes the LCX wordmark serif |
| Stats / mono labels | Geist Mono | Bottom stats, mobile header metrics |

## Logo

- File: `public/lcx-logo.png`
- Component: `LcxLogo` in `src/components/lcx-logo.tsx`
- The asset includes a black mark background; it reads cleanly on the light auth layout

## Layout

Split-panel design (matches Scira auth):

- **Left (desktop):** Marketing panel with pixel grid, logo, tagline, feature pills, testimonial carousel, stats
- **Right:** OAuth sign-in/sign-up form
- **Mobile:** Form-first with compact header logo and stats

## Components

- `src/app/(auth)/layout.tsx` — split layout shell
- `src/components/auth-card.tsx` — OAuth buttons and mode toggle
- `.lcx-auth .pixel-grid-bg` — subtle grid overlay on the left panel

## OAuth (current)

- **Google** — sets an auth session cookie and redirects to the dashboard (UI-only until real OAuth is wired).
- **Web3 wallet** — RainbowKit connect modal, then a signed message to verify ownership. On success, sets a wallet session cookie and redirects.

Protected routes (`/dashboard`) require a valid `lcx-auth` cookie via `src/proxy.ts`.

### WalletConnect setup

1. Create a free project at [WalletConnect Cloud](https://cloud.walletconnect.com)
2. Copy `.env.example` to `.env.local`
3. Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id`
