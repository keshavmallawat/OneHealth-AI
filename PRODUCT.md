# Product

## Register

product

## Platform

web

## Users

Two distinct roles, doing genuinely different jobs, so they get different products rather than one product with disabled buttons.

Primary: patients managing their own health record. A non-clinical person who has just collected a lab report (PDF or a phone photo) and wants to understand it — which values are outside the normal range, what that means in plain language, how a value has moved over time — and to keep those records in one place they control. Often on a phone, often anxious, rarely fluent in medical terminology.

Secondary: clinicians who have been granted time-boxed, consent-based access to a specific patient's records. They arrive to read, not to edit: patient identity, consent scope and expiry, record chronology, and abnormal findings, in a read-only clinical view whose every access is recorded in the patient's audit trail.

## Product Purpose

OneHealth AI is a unified digital health record platform. Patients upload medical reports; the platform runs OCR / text extraction, deterministically extracts a fixed set of supported laboratory parameters with their units and reference ranges, flags each value HIGH / LOW / NORMAL / UNKNOWN, and produces a patient-friendly explanation grounded strictly in the extracted data. Patients can view trends across reports, compare two reports, share records with clinicians under explicit consent (with approve / decline / revoke, scope, expiry, QR hand-off, and a full audit trail), ask a health assistant grounded in their own records, export a PDF summary, and manage in-app reminders.

Success is a patient who opens the product and can honestly say: "I can understand my health record here" — the abnormal value is obvious, the plain-language explanation is trustworthy, and it is unmistakably clear who can see the record and for how long.

## Positioning

The health record that reads your reports honestly: laboratory values are extracted and compared against published reference ranges — never invented by a language model — and every sharing decision stays under the patient's explicit, revocable control.

## Brand Personality

Calm, clinical, precise, human. The voice is that of a trustworthy clinical instrument, not a consumer wellness app and not a marketing site. It states what it did ("Analysis completed", "3 values outside the reference range") rather than performing intelligence. It never exaggerates its own capability, never implies a diagnosis, and is explicit about the boundary between deterministic extraction and language-model interpretation. Warmth comes from clarity and control given back to the patient, not from decoration.

## Anti-references

Not a generic AI dashboard, not a startup landing page, not a Dribbble concept, not a template admin panel, not a futuristic sci-fi interface. No purple AI gradients, glassmorphism, glowing cards, neon accents, floating blobs, or "AI sparkle" aesthetics. No fabricated health scores, no invented clinical conclusions, no decorative statistics, no marketing slogans inside the product. No oversized hero cards or whitespace that hides functionality; density is a feature when a patient needs data. Color is never the only carrier of clinical meaning.

## Design Principles

Truth over performance. The UI communicates exactly what the product does — deterministic extraction is labelled as such, language-model interpretation is labelled as such, and unavailable data is shown as unavailable, never guessed or invented.

Medical information hierarchy first. Abnormal findings surface before the full table; report identity, clinical status, processing status, and user actions are visually distinct. Decoration never outranks data.

Discoverable breadth without overwhelm. The product has many features; a coherent information architecture makes them findable without turning the interface into a wall of widgets.

Control is legible. Consent, scope, expiry, and revocation are always visible and never buried. A patient can see who can access their record and end that access in one obvious step.

One designed system. Every screen composes from shared primitives so the product reads as a single instrument, not a set of similar-looking pages. Earned familiarity over novelty — the tool disappears into the task.

## Accessibility & Inclusion

Target WCAG 2.1 AA. Body text meets ≥4.5:1 contrast; status is always paired with a label or icon so color is never the sole signal. Semantic HTML, keyboard navigation, visible focus states, labelled form controls, accessible dialogs and tables, and appropriate touch targets on mobile. Every animation has a `prefers-reduced-motion` alternative. Responsive from 390px through 1440px, with structural (not merely stacked) changes at mobile widths and tables that stay usable.
