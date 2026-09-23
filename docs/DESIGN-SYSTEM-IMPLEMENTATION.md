# Design System Implementation — OneHealth AI

Prepared 2026-09-03. This documents the consolidation of the OneHealth AI frontend into a coherent, token-driven design system, using the `/design-system` skill's mechanical invariants (token architecture, semantic colour, elevation, focus, chrome stability). It is an implementation record, not a proposal — every item below is in the source and was validated against a running stack.

Scope note: the frontend already had a strong, restrained clinical foundation (semantic clinical-status tokens, shared primitives in `ui.tsx`, colour-never-alone status). The work here removed the remaining **duplicated and one-off patterns** and promoted the implicit semantic system to a first-class, single source of truth — it did not restyle screens for its own sake.

## 1. Tokens

All colour, elevation, radius, and type resolve to tokens in `frontend/src/index.css` (`@theme`, Tailwind v4). No component hardcodes a hex value for UI.

**Colour** — brand (blue `primary` + `-dark/-ink/-soft/-line`); neutral structure (`ink`, `ink-soft`, `muted`, `faint`, `line`, **`line-strong` (new)**, `line-soft`, `surface`, `canvas`, `sunken`); and the clinical-status ramp, each with a text colour plus `-soft` background and `-line` border, AA on both white and its own soft background: `normal` (emerald), `high` (red), `low` (amber), `unknown` (slate).

**Elevation (new)** — a three-step scale replacing the two arbitrary inline `shadow-[...]` values that were in the code:
- `--shadow-raised` `0 1px 2px /.06` — a control lifted off its track (segmented-control thumb)
- `--shadow-popover` `0 4px 16px /.10` — transient anchored surfaces
- `--shadow-overlay` `0 16px 48px /.18` — modal dialogs over a scrim

**Radius** — `--radius-control` 6px, `--radius-panel` 8px. **Type** — Inter (application) + Merriweather (`.font-clinical`, document/reading surfaces). **Focus** — global `:focus-visible` 2px `--color-primary` outline, 2px offset. Structure is carried by 1px borders, not shadows; no border+wide-shadow "ghost card".

## 2. Semantic status system

The headline consolidation. Previously, status was re-derived ad-hoc at each call site — the clinical chips were shared, but consent/session states were inline ternaries whose fallback rendered a **bare, lowercased, icon-less neutral badge** for REVOKED / EXPIRED / DECLINED, and the abnormal-count pill was hand-copied in three files (with "All in range" missing the icon its "N flagged" sibling had).

Now every status resolves to one of five **semantic tones** (`TONE_CLASSES` in `ui.tsx`) — the single source of status colour — and is always rendered with a label **and** an icon:

| Semantic role | Tone | Palette | Where it appears |
|---|---|---|---|
| success | `success` | normal / emerald | in-range value, consent Active/Approved, share Used |
| error | `danger` | high / red | HIGH·LOW flagged, analysis Failed, consent Revoked |
| warning | `warning` | low / amber | consent Pending ("Awaiting your decision"), overdue reminder |
| info / processing | `primary` | blue | Analysing, "via QR" |
| neutral | `neutral` | unknown / slate | Queued, Declined, Expired, not-compared |

Realised by a small set of registry-backed components (below). The full brief vocabulary maps cleanly: NORMAL/HIGH/LOW/UNKNOWN → `StatusChip`; PROCESSING/PENDING(queued)/DONE/FAILED → `RecordStatusChip`; SUCCESS/WARNING/ERROR/INFO → `Alert` + `Badge` tones; ACTIVE/PENDING/APPROVED/DECLINED/REVOKED/EXPIRED/USED → `StatusBadge`. **Colour is never the only signal** — every one carries text and an icon.

## 3. Component system

Consolidated in `frontend/src/components/ui.tsx` (single source). Additions and refactors this pass:

- **`TONE_CLASSES`** — exported map of the five semantic tones; `Badge` now derives from it instead of an inline literal.
- **`StatusBadge`** (new) — `kind="consent" | "share"` + `status` → the right tone + icon + human label, from a registry. Replaces the inline consent/session ternaries in `Sharing.tsx`.
- **`FindingsBadge`** (new) — the abnormal-count pill as one component (red "N flagged" / green "All in range", both iconed). Replaces the duplicated spans in `Dashboard.tsx` and `ReportList.tsx`.
- **`IconButton`** (new) — square icon-only button; `label` is **required** and becomes the accessible name. Adopted for the Modal close.
- **`Breadcrumb`** (new) — the single back-link primitive for `PageHeader`'s breadcrumb slot; adopted in `ReportDetail`.
- **`Modal`** — already hardened earlier (focus trap + initial focus + focus restore + scroll-lock + fading backdrop); shadow now `--shadow-overlay`.
- **`RangeMeter`, `PageHeader`** — carried over from the prior pass (readable band; stacks until `lg`).

Unchanged shared primitives (already coherent): `Panel`/`PanelHeader`/`PageHeader`, `Button`/`LinkButton`, `Field`/`Input`/`Textarea`/`Select`/`Checkbox`, `SegmentedControl`, `Tabs`, `StatTile`, `DefinitionList`, `NotProvided`, `ListRow`, `Avatar`, `Alert`, `EmptyState`, `Skeleton`/`Spinner`/`PageLoader`, `StatusChip`, `RecordStatusChip`, `MedicalDisclaimer`.

Deliberately **not** created: `Toast`, `Drawer`, `Tooltip`, `Dropdown`, `Timeline`. The app doesn't use these patterns (it uses inline `Alert`s, native `Select`s, `title`/`Modal`, and list-based `ActivityLog`); adding unused primitives would be the "unnecessary abstraction" the skill warns against. `Card`/`Section` are the existing `Panel`.

## 4. Medical-data typography (serif ↔ sans pairing)

The system now pairs two typefaces on the **document ↔ application** axis:

- **Inter** (sans) — all application UI, and the **primary numeric value column** of the lab table (kept sans + `tabular-nums` so values align regardless of the serif around them).
- **Merriweather** (`.font-clinical`, serif) — the *reading/document* surfaces only: the reproduced laboratory results table (test names, units, reference ranges, header) and the plain-language interpretation narrative. It lends the report the authority of a printed lab document and is never applied to chrome or decorative microtext.

The lab table keeps its established data hierarchy: exceptions sorted first within each panel, abnormal rows carry a faint `bg-high-soft/25` wash **and** an explicit `StatusChip`, HIGH/LOW values render in `text-high`, normal values stay quiet, and the `RangeMeter` shows position against the reference band. HIGH/LOW stand out without dominating.

## 5. Responsive strategy

Structural adaptation, not fluid shrink. Verified at **1440 / 1280 / 1024 / 768 / 390** with real screenshots — no horizontal page overflow at any width.
- App shell: fixed 248px sidebar at `md+`, off-canvas drawer + scrim below `md` (Escape-closable).
- `PageHeader` stacks title/actions until `lg` (so tablet widths with the sidebar don't crowd a multi-action header).
- Wide tables (`ResultsTable`) scroll inside a `.scroll-x` container; the page never scrolls sideways.
- Dashboard: full-width attention + access-history bands; `xl:grid-cols-3` main/rail that stacks below `xl`.
- Status badges/pills are `inline-flex` + `whitespace-nowrap`, so they wrap as units rather than breaking.

## 6. Accessibility decisions

- **Colour never alone** — every status pairs colour with a label and an icon (`StatusBadge`, `FindingsBadge`, `StatusChip`, `RecordStatusChip`).
- **Focus** — global `:focus-visible` 2px primary outline; all interactive elements are real semantic controls (`<button>`, `<a>`, `<select>`, `<input>`).
- **Icon-only buttons** — `IconButton` forces a `label` (accessible name); no unlabelled icon actions.
- **Dialogs** — `Modal` traps Tab, moves focus in on open, restores it to the trigger on close, locks body scroll, closes on Escape.
- **Announcements** — `Alert` is `role="alert"`, so async errors and processing status reach screen readers.
- **Tables** — semantic `<table>` with `<caption class="sr-only">`, `scope="col"/"row"/"colgroup"`.
- **Contrast** — clinical-status text is AA on both white and its own soft background; body ink is slate-700+.

## 7. Files changed

- `frontend/src/index.css` — elevation tokens; `--color-line-strong`; documented semantic-status mapping; hover border now tokenised. (Also present from concurrent work: `.font-clinical` utility, `@media print`.)
- `frontend/src/components/ui.tsx` — `TONE_CLASSES`, `StatusBadge`, `FindingsBadge`, `IconButton`, `Breadcrumb`; `Badge` refactored onto `TONE_CLASSES`; shadows → elevation tokens; Modal close → `IconButton`.
- `frontend/src/components/ReportList.tsx` — inline flagged/in-range spans → `FindingsBadge`.
- `frontend/src/pages/Dashboard.tsx` — latest-findings inline pills → `FindingsBadge`.
- `frontend/src/pages/Sharing.tsx` — consent + share-session status ternaries → `StatusBadge`.
- `frontend/src/pages/ReportDetail.tsx` — header back-link → `Breadcrumb`.
- `DESIGN.md` — updated (semantic layer, serif/sans pairing, elevation, new components).

## 8. Validation performed

| Check | Result |
|---|---|
| TypeScript (`tsc -b --noEmit`) | clean |
| Production build (`vite build`) | success — 129 KB gzip JS, no new deps |
| Core smoke (`scripts/smoke-test.js`) | 42/42 |
| Consent smoke (`scripts/smoke-test-consent.js`) | 95/95 |
| AI tests (`ai-service`, pytest) | 15/15 |
| Browser — `StatusBadge` real consent lifecycle | Pending → Active → Revoked each render correctly (labelled + iconed + semantic colour) |
| Browser — `FindingsBadge` | Reports + Dashboard render "N flagged" / "All in range" consistently (in-range now iconed) |
| Responsive | verified 1440/1280/1024/768/390, no overflow, no console errors |

The consent lifecycle was exercised against real data (a clinician request was created, approved, and revoked through the live API) to confirm the semantic status badges render in every state — the case that previously fell through to a bare neutral chip.

## 9. Known follow-ups (honest limitations)

- **Nav vs page-title naming** is mid-transition from concurrent feature work: the sidebar now reads "Health Records" / "Share Access" while some page `<h1>`s still read "Medical records" / "Sharing & consent". These should be reconciled to one vocabulary; left untouched here to avoid colliding with in-flight edits.
- **Merriweather loads via Google Fonts `display=swap`.** As below-the-fold content type the swap is low-impact, but self-hosting WOFF2 with a metric-matched fallback would remove the swap-reflow entirely.
- The serif pairing is intentionally scoped to the report table + interpretation. If it is later extended to other data tables (Trends/Compare), do so as one deliberate rule, not piecemeal.
