# Oversikt — Brand Architecture

> **oversikt** (Norwegian, noun): overview; the elevated perspective from a summit where the full landscape becomes clear.

-----

## 1. Brand Foundation

### Name

**Oversikt** — pronounced "OH-ver-sikt"

### Tagline

"See your whole financial picture."

### Brand Story

Oversikt is Norwegian for "overview" — the clarity you gain from a mountain summit, where the full landscape becomes visible. In personal finance, that clarity is everything: seeing income, commitments, flexibility, and annual goals in one honest view so every decision is informed. The name carries Scandinavian design values — simplicity, honesty, intentionality — and a personal connection to Norwegian heritage.

### Brand Personality

- **Clear**: No clutter, no noise. Every element earns its place.
- **Honest**: Shows reality, not aspirations. Red means overspent. Green means on track.
- **Steady**: Reliable like stone. Not flashy, not gamified. Trustworthy.
- **Warm**: Scandinavian warmth, not Scandinavian cold. Approachable, not clinical.

### Positioning

A personal finance app that gives you true remaining clarity — not just what you spent, but what's actually available after fixed commitments, flexible spending, and annual set-asides. Built for people who want honest financial visibility without the complexity of enterprise tools or the gamification of consumer apps.

-----

## 2. Visual Identity

### Logo System

**Primary Mark: O Monogram**
The slashed O (O) is the most distinctly Norwegian character in the alphabet. It serves as the app icon and primary brand mark. Rendered in Fraunces serif at regular weight inside a rounded-corner square.

- App icon: O in Snow (#F7F9F8) on Fjord (#1B3A4B) background, 16px border-radius at 80px
- Favicon: Same mark, simplified for 16x16
- Watermark: O at 5% opacity for document backgrounds

**Wordmark: oversikt**
Always lowercase. Set in Fraunces at 400 weight. Letter-spacing: -0.01em.

**Lockup: O + oversikt**
Icon (40x40 rounded square) followed by wordmark. 12px gap. Used in navigation bars, headers, and marketing materials.

**Usage Rules**

- Never capitalize: it's "oversikt" not "Oversikt" in wordmark form (capitalize only at sentence start in prose)
- Minimum clear space: half the height of the O mark on all sides
- Never stretch, rotate, or add effects to the mark
- On busy backgrounds, use the Fjord or Midnight background variant

### Color System

**Primary Palette** (Norwegian landscape-inspired)

|Name    |Hex      |Role                                   |
|--------|---------|---------------------------------------|
|Fjord   |`#1B3A4B`|Primary brand color. Nav, headers, CTAs|
|Pine    |`#2D5F3E`|Positive states: income, on-track, paid|
|Midnight|`#0F1F28`|Deepest dark. Text on light backgrounds|

**Neutral Palette**

|Name |Hex      |Role                                  |
|-----|---------|--------------------------------------|
|Snow |`#F7F9F8`|Primary background                    |
|Frost|`#E8F0ED`|Card backgrounds, secondary surfaces  |
|Mist |`#C8D5CE`|Borders, dividers, progress bar tracks|
|Stone|`#8B9A8E`|Secondary text, labels, metadata      |

**Accent Palette**

|Name  |Hex      |Role                                 |
|------|---------|-------------------------------------|
|Lichen|`#A3B8A0`|Subtle highlights, hover states      |
|Birch |`#D4C5A9`|Annual/pending states, warm accents  |
|Ember |`#C4704B`|Warnings: over-budget, missed, alerts|

**Semantic Aliases** (defined in Tailwind config alongside the palette)

|Alias   |Maps to|Hex      |
|--------|-------|---------|
|income  |Pine   |`#2D5F3E`|
|expense |Ember  |`#C4704B`|
|transfer|Birch  |`#D4C5A9`|

**Semantic Usage**

- Income / positive / paid / on-track -> Pine (`income`)
- Expense / negative / overspent / missed -> Ember (`expense`)
- Transfer / internal movement -> Birch (`transfer`)
- Annual / pending / upcoming -> Birch
- Neutral / informational -> Fjord
- Disabled / placeholder -> Stone

### Typography

**Display: Fraunces**

- Source: Google Fonts
- Use: Brand name, page titles, hero text, section headers
- Weights: 300 (light, for large display), 400 (regular), 500 (medium), 600 (semi-bold)
- Character: Old-style soft serif with optical sizing. Warm and approachable without formality. The soft axis gives it a Scandinavian character.

**Interface: DM Sans**

- Source: Google Fonts
- Use: Navigation, labels, body text, buttons, form fields
- Weights: 400 (regular), 500 (medium), 600 (semi-bold), 700 (bold)
- Character: Geometric sans with humanist touches. Clean, legible at all sizes.

**Figures: JetBrains Mono**

- Source: Google Fonts
- Use: All dollar amounts, percentages, stat values, tabular data
- Weights: 400 (regular), 500 (medium)
- Character: Monospaced for vertical alignment of financial data. Numbers align in columns, making budget comparisons instant.

**Type Scale**

|Element           |Font          |Size|Weight|Color |
|------------------|--------------|----|------|------|
|Page title        |Fraunces      |24px|500   |Fjord |
|Section header    |DM Sans       |15px|600   |Fjord |
|Body text         |DM Sans       |14px|400   |Fjord |
|Label / metadata  |DM Sans       |12px|500   |Stone |
|Category badge    |DM Sans       |11px|600   |varies|
|Stat value (large)|JetBrains Mono|24px|500   |varies|
|Amount (inline)   |JetBrains Mono|14px|500   |varies|
|Amount (small)    |JetBrains Mono|12px|400   |Stone |

### Iconography

- Style: Lucide React icon set (outline style, 1.5px stroke)
- Size: 16px for inline, 20px for nav items, 24px for empty states
- Color: Inherit from text color, never standalone color

### Border Radius

- Cards / sections: 12px
- Buttons / inputs: 8px
- Badges / tags: 5px
- Progress bars: 3px
- App icon / monogram: 16px (at 80px), proportional at other sizes

### Spacing

- Base unit: 4px
- Card padding: 24px
- Section gap: 24px
- Between stat cards: 12px
- Between list items: 4px

### Shadows

- Minimal use. Prefer border (1px solid Mist) over shadows.
- If needed: `0 1px 3px rgba(15, 31, 40, 0.06)`

-----

## 3. Component System

### Stat Card

- Background: Frost
- Border-radius: 10px
- Padding: 16px
- Label: DM Sans 11px/500, Stone
- Value: JetBrains Mono 20-24px/500, semantic color

### Budget Card

- Background: Frost
- Border-radius: 12px
- Padding: 24px
- Title: DM Sans 15px/600, Fjord
- Subtitle: DM Sans 12px/400, Stone
- Progress bar: 6px height, Mist track, Pine/Ember/Birch fill
- Amount: JetBrains Mono 14px/500

### Status Badges

|Status     |Background             |Text Color|Label      |
|-----------|-----------------------|----------|-----------|
|On Track   |`rgba(45,95,62,0.1)`   |Pine      |ON TRACK   |
|Paid       |`rgba(45,95,62,0.1)`   |Pine      |PAID       |
|Over Budget|`rgba(196,112,75,0.1)` |Ember     |OVER BUDGET|
|Missed     |`rgba(196,112,75,0.1)` |Ember     |MISSED     |
|Upcoming   |`rgba(212,197,169,0.3)`|`#8B7B5E` |UPCOMING   |
|Fixed      |`rgba(27,58,75,0.08)`  |Fjord     |FIXED      |
|Flexible   |`rgba(163,184,160,0.3)`|`#4A6848` |FLEXIBLE   |
|Annual     |`rgba(212,197,169,0.3)`|`#8B7B5E` |ANNUAL     |

### Buttons

|Variant  |Background |Text |Border        |Use                 |
|---------|-----------|-----|--------------|--------------------|
|Primary  |Fjord      |Snow |none          |Main actions        |
|Secondary|transparent|Fjord|1px solid Mist|Secondary actions   |
|Success  |Pine       |Snow |none          |Confirm / import    |
|Danger   |Ember      |Snow |none          |Delete / destructive|

All buttons: DM Sans 13px/500, padding 10px 20px, border-radius 8px.

### Sidebar Navigation

- Background: Fjord
- Width: 200px (desktop), collapsible on mobile
- Brand lockup at top: O icon (28x28, rgba(255,255,255,0.15) bg) + "oversikt" in Fraunces 16px Snow
- Nav items: DM Sans 13px, rgba(255,255,255,0.5) default, Snow when active
- Active item: rgba(255,255,255,0.1) background, 6px border-radius

### Fixed Expense Row

- Paid: Pine dot (8px) + amount in Pine
- Missed: Ember background tint + "MISSED" badge
- Upcoming: Birch dot + amount in Fjord
- Due date and auto-pay labels: DM Sans 11px Stone

-----

## 4. Application Structure

### Navigation (sidebar items)

1. Overview -- dashboard with stat cards, top budgets, recent transactions, spending breakdown
1. Insights -- trends, charts, spending analysis (future)
1. Transactions -- full list with search, filter, inline edit, CSV import
1. Spending -- category breakdown with progress bars
1. Budgets -- fixed/flexible/annual budget management, True Remaining calculation
1. Annual Plan -- annual expense forecasting, auto-fund logic, 12-month chart
1. Accounts -- checking, savings, credit cards, net worth
1. Categories -- system defaults + user categories, budget tier badges

### Key Concepts

- **True Remaining**: Income minus committed (fixed) minus annual set-aside = what's actually available for flexible spending
- **Budget Tiers**: Fixed (mortgage, utilities), Flexible (groceries, dining), Annual (vacation, insurance)
- **Amount Sign Convention**: Positive = income, Negative = expense. API enforces sign based on category type.
- **Budget Spent**: Always computed live from transactions, never stored as a separate field.

-----

## 5. CSS Variables (for implementation)

```css
:root {
  /* Primary */
  --color-fjord: #1B3A4B;
  --color-pine: #2D5F3E;
  --color-midnight: #0F1F28;

  /* Neutrals */
  --color-snow: #F7F9F8;
  --color-frost: #E8F0ED;
  --color-mist: #C8D5CE;
  --color-stone: #8B9A8E;

  /* Accents */
  --color-lichen: #A3B8A0;
  --color-birch: #D4C5A9;
  --color-ember: #C4704B;

  /* Typography */
  --font-display: 'Fraunces', serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Radii */
  --radius-card: 12px;
  --radius-button: 8px;
  --radius-badge: 5px;
  --radius-bar: 3px;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 48px;
}
```

-----

## 6. Tailwind Config (source of truth: `tailwind.config.ts`)

```typescript
// tailwind.config.ts — actual values rendering in the app
import type { Config } from 'tailwindcss'

const config: Config = {
  theme: {
    extend: {
      colors: {
        // Brand palette
        fjord: '#1B3A4B',
        pine: '#2D5F3E',
        midnight: '#0F1F28',
        snow: '#F7F9F8',
        frost: '#E8F0ED',
        mist: '#C8D5CE',
        stone: '#8B9A8E',
        lichen: '#A3B8A0',
        birch: '#D4C5A9',
        ember: '#C4704B',
        // Semantic aliases
        income: '#2D5F3E',
        expense: '#C4704B',
        transfer: '#D4C5A9',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'serif'],
        body: ['var(--font-dm-sans)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
        sans: ['var(--font-dm-sans)', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        button: '8px',
        badge: '5px',
        bar: '3px',
      },
    },
  },
}
```

Font CSS variables (`--font-fraunces`, `--font-dm-sans`, `--font-jetbrains`) are injected by Next.js `next/font` in `src/app/layout.tsx`.

-----

## 7. Component Library (`src/components/ui/`)

All shared UI primitives live in `src/components/ui/` with a barrel export from `index.ts`.

### Button

`<Button variant="primary" size="md" loading={false} href="/path">`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | `primary` \| `secondary` \| `success` \| `danger` \| `outline` \| `ghost` | `primary` | Visual style |
| size | `sm` \| `md` \| `lg` | `md` | Button size |
| loading | `boolean` | `false` | Shows spinner, disables interaction |
| loadingText | `string` | — | Text shown during loading state |
| href | `string` | — | Renders as Next.js `<Link>` instead of `<button>` |
| fullWidth | `boolean` | `false` | Stretches to fill container |
| leftIcon / rightIcon | `ReactNode` | — | Icon slots |

### FormInput

`<FormInput label="Email" name="email" type="email" startAdornment="$" helperText="..." error="..." />`

Wraps `<input>` with label, error/helper text, and start/end adornments. Uses `className="input"` base styling.

### FormSelect

`<FormSelect label="Type" name="type" error="...">` + `<option>` children.

Wraps `<select>` with label, error/helper text. Same pattern as FormInput.

### Card / CardHeader / CardBody

`<Card variant="frost" padding="standard">` — wrapper for content sections.

| Prop | Values | Default |
|------|--------|---------|
| variant | `frost` \| `snow` \| `outline` | `frost` |
| padding | `compact` \| `standard` \| `spacious` | `standard` |

### EmptyState

`<EmptyState icon={...} title="No items" description="..." action={{ label: "Add", href: "/new" }} />`

Centered empty state with optional icon, title, description, and CTA button.

### Modal / ConfirmModal

`<Modal open={bool} onClose={fn} title="..." description="..." actions={...} variant="default">`

Native `<dialog>` modal with backdrop. `ConfirmModal` is a convenience wrapper:

`<ConfirmModal open={bool} onClose={fn} onConfirm={fn} title="Delete?" description="..." confirmLabel="Delete" variant="danger" />`

### Badge

`<Badge variant="success" size="sm">On Track</Badge>`

| Variant | Colors |
|---------|--------|
| default | Frost bg, Fjord text |
| success | Pine/10 bg, Pine text |
| warning | Birch/30 bg, dark birch text |
| info | Fjord/10 bg, Fjord text |

### Skeleton / SkeletonGroup

`<Skeleton className="h-4 w-32" />` — animated loading placeholder.

`<SkeletonGroup count={3} />` — renders multiple skeleton lines.

### Tooltip

`<Tooltip content="Help text" position="top">` — CSS-only tooltip with 4 positions (top, bottom, left, right).

### ProgressBar

`<ProgressBar percentage={75} color="pine" />` — horizontal progress bar.

### Shared CSS Classes (globals.css)

| Class | Description |
|-------|-------------|
| `.card` | Frost bg, mist border, rounded-card, p-6 |
| `.input` | Snow bg, mist border, fjord focus ring, rounded-button |
| `.label-caps` | 11px uppercase tracking-widest Stone text |
| `.btn-primary` | Legacy — use `<Button>` component instead |
