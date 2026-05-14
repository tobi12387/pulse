# Data Mobile Action First Implementation Plan

Status: Completed 2026-05-14.

**Goal:** On mobile `/data`, the page should make the daily data action executable in the first viewport. The CTA must come before optional explanatory depth.

**Architecture:** Keep the desktop Data task contract unchanged. On mobile, reorder the Data primary action so title, evidence chips and CTA appear first, while `Warum jetzt` and `Nach dem Klick` move behind an explicit disclosure. No API, Garmin, Mental or routing changes.

**Tech Stack:** React/Vite, existing Data page CSS, Playwright mobile regression.

---

## Context

Live route evidence on `ebf4060` shows `/data` still feels heavy on mobile: the card is correctly labeled `Daten-Aktion`, but the actionable button appears only after two explanatory paragraphs. This conflicts with the product rule `Lead, then explain` and with the user's repeated feedback that pages feel full and unclear.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/pages/Data.tsx` | Add mobile disclosure state and mobile-only contract toggle for the primary Data action. |
| Modify | `frontend/src/index.css` | Use responsive CSS to show full contract on desktop and compact disclosure on mobile. |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Add/adjust mobile regression for first-viewport CTA and optional details. |
| Modify | `docs/decisions.md` | Record the mobile Data action-first decision. |
| Create | `docs/qa/2026-05-14-data-mobile-action-first.md` | Capture red/green, build and route evidence. |

## Tasks

- [x] **Task 1: Red test**
  - Add a mobile test for `/data`.
  - Assert `Check-in öffnen` is visible in the initial viewport.
  - Assert the full `Nach dem Klick` detail is hidden until `Warum diese Aufgabe?` is opened.

- [x] **Task 2: Minimal implementation**
  - Keep Data's desktop two-part contract visible.
  - On mobile, hide the full contract by default and expose it through a 44px disclosure button.
  - Keep evidence chips and CTA immediately visible.

- [x] **Task 3: Verification**
  - Run focused red/green test, build, diff check, mobile navigation/touch regression and route evidence.
  - Visually inspect mobile `/data`.

## Acceptance

- Mobile `/data` shows the primary CTA in the first viewport.
- The explanatory contract remains available on demand.
- Desktop `/data` remains unchanged in structure.
- Route evidence reports no horizontal overflow.
