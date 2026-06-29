# Fidence Style Guide

Brand and UI reference for the Fidence product. Use this document when building new screens, components, or marketing assets so the experience stays consistent.

---

## Color palette

The palette is built around a single primary blue (`#2B6BFF`) with lighter tints for secondary and tertiary surfaces, always on white backgrounds. **Dark mode is not supported at this time** — design and build for light mode only.

### Core brand colors

| Token | Hex | Role |
|-------|-----|------|
| **Primary** | `#2B6BFF` | Main brand color — primary buttons, links, active states, key accents |
| **Secondary** | `#EEF3FF` | Soft blue wash — secondary buttons, sidebar highlights, subtle backgrounds |
| **Tertiary** | `#D6E4FF` | Medium blue tint — hover states, badges, chart fills, accent surfaces |
| **White** | `#FFFFFF` | Page background, cards, popovers, modals |

### Supporting colors

| Token | Hex | Role |
|-------|-----|------|
| **Foreground** | `#0F1729` | Primary body text and headings |
| **Secondary foreground** | `#1A4ACC` | Text on secondary/tertiary surfaces, emphasized labels |
| **Muted foreground** | `#5B6B8C` | Captions, placeholders, helper text |
| **Border** | `#D8E2F5` | Dividers, inputs, card borders |
| **Destructive** | *(system red)* | Errors and destructive actions only |

### Color usage

- **Primary (`#2B6BFF`)** — Use for the main call-to-action on a screen. Pair with white text (`#FFFFFF`).
- **Secondary (`#EEF3FF`)** — Use for low-emphasis actions, selected nav items, and tinted panels. Pair with `#1A4ACC` text.
- **Tertiary (`#D6E4FF`)** — Use for hover backgrounds, tags, and chart area fills. Pair with `#1A4ACC` text.
- **White (`#FFFFFF`)** — Default surface for pages, cards, and overlays. Never replace with off-white unless using secondary for intentional contrast.

### Chart colors

Charts use a blue family derived from the primary hue:

1. `#2B6BFF` — Primary series
2. `#5C8FFF` — Secondary series
3. `#8DB1FF` — Tertiary series
4. `#1A4ACC` — Emphasis / contrast series
5. `#D6E4FF` — Light fill / background series

---

## Typography

### Font families

| Token | Font | Usage |
|-------|------|-------|
| **Sans** | [Geist Sans](https://vercel.com/font) | All UI text — body, headings, labels, buttons |
| **Mono** | [Geist Mono](https://vercel.com/font) | Code, IDs, numeric data tables, technical values |

Both fonts are loaded via `next/font/google` in `src/app/layout.tsx`.

### CSS variables

```css
--font-geist-sans   /* Geist Sans — mapped to --font-sans */
--font-geist-mono   /* Geist Mono — mapped to --font-mono */
--font-heading      /* Same as sans — used by shadcn heading components */
```

### Tailwind classes

| Class | Font |
|-------|------|
| `font-sans` | Geist Sans (default on `<html>`) |
| `font-mono` | Geist Mono |
| `font-heading` | Geist Sans |

### Type scale (dashboard defaults)

Follow the existing shadcn dashboard scale. Common sizes in use:

| Element | Size | Weight |
|---------|------|--------|
| Page title | `text-base` / `text-lg` | `font-medium` |
| Card title | `text-sm` | `font-medium` |
| Body | `text-sm` | `font-normal` |
| Caption / meta | `text-xs` | `font-normal` |
| Metric value | `text-2xl` – `text-3xl` | `font-semibold` / `font-bold` |

Do not introduce additional font families without updating this guide.

---

## Design tokens (CSS)

All tokens live in `src/app/globals.css`. Map custom UI to these variables rather than hard-coding hex values.

### Brand tokens

```css
--brand-primary:   #2B6BFF;
--brand-secondary: #EEF3FF;
--brand-tertiary:  #D6E4FF;
--brand-white:     #FFFFFF;
```

### shadcn/ui mapping

| shadcn token | Brand mapping |
|--------------|---------------|
| `--primary` | Brand primary (`#2B6BFF`) |
| `--secondary` | Brand secondary (`#EEF3FF`) |
| `--accent` | Brand tertiary (`#D6E4FF`) |
| `--background`, `--card`, `--popover` | White |
| `--muted` | Very light blue tint |
| `--ring` | Primary at 35% opacity |

### Tailwind color utilities

After the `@theme` block, these utilities are available:

```
bg-primary          text-primary
bg-secondary        text-secondary-foreground
bg-accent           text-accent-foreground
bg-brand-primary    bg-brand-secondary    bg-brand-tertiary
text-brand-primary  (via arbitrary value or CSS variable)
```

---

## Border radius

Default radius token: `--radius: 0.625rem` (10px).

| Token | Value |
|-------|-------|
| `--radius-sm` | 6px |
| `--radius-md` | 8px |
| `--radius-lg` | 10px |
| `--radius-xl` | 14px |

Use `rounded-lg` for buttons and inputs; `rounded-xl` for cards and panels.

---

## Theme mode

- **Light mode only** — `color-scheme: light` is set on `:root`.
- Do not add a `.dark` class, theme toggle, or `prefers-color-scheme: dark` overrides until dark mode is explicitly scoped in a future release.
- shadcn components may include `dark:` Tailwind classes from the registry; they are inert until dark mode is enabled.

---

## File reference

| File | Purpose |
|------|---------|
| `src/app/globals.css` | Color tokens, theme variables, base styles |
| `src/app/layout.tsx` | Font loading (Geist Sans + Geist Mono) |
| `components.json` | shadcn/ui configuration |
| `docs/STYLE_GUIDE.md` | This document |

---

## Quick checklist for new UI

- [ ] Background is white or a brand secondary/tertiary tint
- [ ] Primary actions use `#2B6BFF` with white text
- [ ] Body text uses foreground (`#0F1729`), not pure black
- [ ] Borders use `#D8E2F5`, not generic gray
- [ ] Typography uses Geist Sans (or Geist Mono for code/data)
- [ ] No dark mode styles or theme switcher added
