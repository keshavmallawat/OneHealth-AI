# Design

Visual system for OneHealth AI. The target is a clinical records instrument: one restrained accent, generous but purposeful whitespace, borders rather than shadows for structure, numerals that align in a column, and status color that is always paired with a word or an icon. Tokens live in `frontend/src/index.css` (`@theme`, Tailwind v4) and are consumed through shared primitives in `frontend/src/components/ui.tsx`.

## Theme

Light, single theme. Calm clinical daylight — a near-white canvas with white surfaces, cool slate neutrals, and a single blue accent reserved for actions, links, and the active state. No dark mode (records are read in clinics and at home in daylight; a single well-tuned light theme is the honest default). Color strategy: Restrained — tinted neutrals plus one accent, with a semantic clinical-status palette that appears only on data.

## Color

OKLCH-friendly hex tokens, grouped by role.

Brand / accent
- `--color-primary` `#1d4ed8` (blue 700) — primary actions, links, active nav
- `--color-primary-dark` `#1e40af` (blue 800) — hover
- `--color-primary-ink` `#172554` (blue 950) — text on tinted surfaces, brand panel background
- `--color-primary-soft` `#eff6ff` (blue 50) — tinted surfaces, active nav background
- `--color-primary-line` `#bfdbfe` (blue 200) — borders on tinted surfaces

Structure / neutrals
- `--color-ink` `#0f172a` (slate 900) — primary text
- `--color-ink-soft` `#334155` (slate 700) — secondary text, body prose
- `--color-muted` `#64748b` (slate 500) — labels, metadata
- `--color-faint` `#94a3b8` (slate 400) — placeholders, disabled, decorative icons
- `--color-line` `#e2e8f0` (slate 200) — borders
- `--color-line-soft` `#f1f5f9` (slate 100) — dividers, table stripes
- `--color-surface` `#ffffff` — panels, cards
- `--color-canvas` `#f6f7f9` — page background
- `--color-sunken` `#f8fafc` — table headers, inset panels, secondary buttons

Clinical status (each has text, `-soft` background, `-line` border; text is AA on both its own soft background and white)
- Normal / in-range: `--color-normal` `#047857`, `-soft` `#ecfdf5`, `-line` `#a7f3d0`
- High: `--color-high` `#b91c1c`, `-soft` `#fef2f2`, `-line` `#fecaca`
- Low: `--color-low` `#b45309`, `-soft` `#fffbeb`, `-line` `#fde68a`
- Unknown / not compared: `--color-unknown` `#475569`, `-soft` `#f1f5f9`, `-line` `#e2e8f0`

Neutral structure token: `--color-line-strong` `#cbd5e1` (slate 300) for hover / emphasis borders (e.g. the field-input hover state).

Rule: status color never appears without a paired label or icon. Abnormal table rows carry a faint `bg-high-soft/25` wash plus an explicit StatusChip; they are never signalled by color alone.

### Semantic status layer

The clinical palette above is the single source of colour; every status in the product resolves to one of five **semantic tones** (`TONE_CLASSES` in `ui.tsx`), always paired with a label and an icon. The mapping is documented in `index.css` and realised in code by `lib`-adjacent registries:

| Semantic role | Tone → palette | Examples |
|---|---|---|
| success | `success` → normal (emerald) | in-range, consent Active/Approved, share Used(done) |
| error / danger | `danger` → high (red) | HIGH/LOW flagged, analysis Failed, consent Revoked |
| warning | `warning` → low (amber) | consent Pending / "Awaiting your decision", overdue |
| info / processing | `primary` → blue | Analysing, share Used, "via QR" |
| neutral | `neutral` → unknown (slate) | Queued/Pending, Declined, Expired, not-compared |

## Typography

A two-typeface pairing on the **document ↔ application** axis:

- **Inter** (sans) carries the entire application: headings, buttons, labels, badges, metadata, and the primary numeric value column. Product register — a fixed rem/px scale, not fluid clamps.
- **Merriweather** (serif, `.font-clinical`) is reserved for the *reading/document* surfaces: the reproduced laboratory results table (test names, units, reference ranges, header) and the plain-language interpretation narrative. It gives the report the authority of a printed lab document. It is never used on UI chrome or decorative microtext.

- Base body 14px / line-height 1.55; secondary text 13px; metadata and labels 12px
- Page title (`PageHeader` h1) 22px / 600 / leading-tight, `text-balance`
- Panel/section heading uses the `.eyebrow` micro-label: 11px, 600, uppercase, letter-spacing 0.06em, muted — used deliberately for panel/table headers (not decoratively above every block)
- Headings h1–h4: weight 600, letter-spacing -0.011em
- `.tabular` utility (`font-variant-numeric: tabular-nums`) on all clinical numbers; the primary value column stays Inter so values align in a column regardless of the serif around them
- Data/tables may run denser than the 65–75ch prose limit; interpretation prose is capped at `max-w-3xl`
- Loading note: Merriweather is loaded via Google Fonts `display=swap`; it is content (not display) type below the fold, so a sub-perceptual swap is tolerable. Self-hosting WOFF2 with a metric-matched fallback would remove the swap-reflow entirely — a documented future refinement.

## Spacing & Layout

- App shell: fixed 248px left sidebar on `md+`, off-canvas drawer with scrim below `md`; content max-width 1180px, padding scaling 16 → 24 → 32px
- Panels compose vertically with `space-y-5` (20px); dashboard uses a `xl:grid-cols-3` split (2/3 primary column + 1/3 rail)
- Grid for 2D data layouts, flex for 1D toolbars; stat tiles `grid-cols-2 lg:grid-cols-4`
- Wide tables/charts scroll inside a `.scroll-x` container so the page never scrolls sideways

## Radius, Borders, Elevation

- `--radius-control` 6px (inputs, buttons, chips), `--radius-panel` 8px (panels, cards); modals 8–12px
- Structure is carried by 1px `--color-line` borders, not shadows. Elevation is a three-step token scale, used only for things that genuinely float: `--shadow-raised` (segmented-control thumb, menu items), `--shadow-popover` (transient anchored surfaces), `--shadow-overlay` (modal dialogs / drawers over a scrim). No border+wide-shadow "ghost card" pairing.
- Cards are used deliberately (the `Panel` primitive), never nested.
- `@media print`: nav / header / buttons / panel chrome and `.print:hidden` are hidden and panels de-elevated, so a record prints as a clean document.

## Components

Shared primitives in `ui.tsx` are the single source of the visual language. Layout: `Panel` / `PanelHeader` / `PageHeader` / `Breadcrumb` / `Divider`. Actions: `Button` (primary / secondary / subtle / ghost / danger; sm / md; loading), `LinkButton`, `IconButton` (square, `label` required → always has an accessible name). Forms: `Field` / `Input` / `Textarea` / `Select` / `Checkbox`, `SegmentedControl`, `Tabs`. Data: `StatTile`, `DefinitionList`, `NotProvided`, `ListRow`, `Avatar`. Overlay: `Modal` (focus-trapped, focus-restoring, scroll-locked). Feedback: `Alert` (error / warning / info / success, `role="alert"`), `EmptyState`, `Skeleton` / `Spinner` / `PageLoader`.

Status system (single source of truth): `Badge` + `TONE_CLASSES` (the five semantic tones) underpin `StatusChip` (parameter HIGH/LOW/NORMAL/UNKNOWN), `RecordStatusChip` (Queued → Analysing → Analysed / Failed / Deleted), `StatusBadge` (consent ACTIVE/PENDING/APPROVED/DECLINED/REVOKED/EXPIRED and share ACTIVE/USED/REVOKED/EXPIRED — each with its own label + icon), and `FindingsBadge` (the abnormal-count pill: red "N flagged" / green "All in range"). Clinical extras: `RangeMeter`, `MedicalDisclaimer`.

Every interactive control defines default / hover / focus / active / disabled / loading states. Focus is a 2px primary outline with 2px offset, globally.

## Motion

Restrained, state-conveying only, 150–250ms. `.animate-in` is a 0.18s fade-and-rise for entering panels/modals; `.shimmer` drives skeletons; status chips spin only while genuinely processing. Ease-out, no bounce. Every animation is disabled under `@media (prefers-reduced-motion: reduce)`. No orchestrated page-load sequences — the product loads straight into the task.

## Voice

Concise clinical/product language. "Lab results", "Analysis completed", "Based on your available records", "Access expires on…". Deterministic analysis is never dressed up as live LLM output; the interpretation surface labels its source (Language model vs Deterministic explainer) and always carries the medical disclaimer.
