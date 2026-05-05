# Mental Check-in Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for this narrow UX slice. Keep the first PR frontend-only unless the existing API cannot support the simplified payload.

**Goal:** Make the daily Mental Check-in fast enough for iPhone/PWA use by replacing mandatory 1-10 scoring with Garmin-assisted defaults, three-state choices and optional free text.

**Architecture:** Keep the existing `POST /api/pulse/checkin` contract for the first slice by mapping simple choices back to the existing 1-10 fields. Use deterministic Garmin/recovery hints from existing `useCheckinGuidance`, `useCheckinToday`, `useCheckinHistory` and Data/Recovery surfaces; do not add LLM or schema work unless a later evidence pass proves it is necessary.

**Tech Stack:** React 19, Vite, TanStack Query, existing Pulse hooks, Playwright route tests, route evidence screenshots.

---

## Problem

The current Data > Mental check-in asks Tobi to set four precise 1-10 values: mood, energy, stress and motivation. That is too much judgment for a daily iPhone/PWA flow. The result is friction: the user has to decide the "right" number instead of quickly telling Pulse whether today feels good, mixed or hard.

## Target UX

Use a fast three-layer model:

1. **Pulse Vorschlag:** Show a compact Garmin/recovery-informed suggestion such as "Schlaf kurz, HRV normal, Stress hoch: ich wuerde heute mental eher `mittel/schwer` einschaetzen." This is explainable, not automatic diagnosis.
2. **Drei Ampeln:** Replace required numeric bars with three choices per core dimension:
   - Kopf: `klar`, `gemischt`, `schwer`
   - Energie: `bereit`, `begrenzt`, `leer`
   - Druck: `ruhig`, `spuerbar`, `hoch`
   - Tagesbedarf: `Aktivierung`, `Ruhe`, `Struktur`
3. **Optionaler Kontext:** Keep short text, chips and voice/free-text as optional context. The check-in must still be valid without writing a note.

Internally, map choices to existing scores:

| Dimension | Low / Easy | Middle | Hard |
|---|---:|---:|---:|
| mood | 8 | 6 | 3 |
| energy | 8 | 5 | 2 |
| stress | 2 | 5 | 8 |
| motivation | 7 | 5 | 3 |

For `Tagesbedarf`, append a structured note tag:

- `Aktivierung` -> `Bedarf: Aktivierung`
- `Ruhe` -> `Bedarf: Ruhe`
- `Struktur` -> `Bedarf: Struktur`

## Prioritized PR Slices

### PR 1: Quick Check-in UI

**Scope:**
- Replace the four mandatory 1-10 bars in `frontend/src/features/data/mental/mental-components.tsx` with large three-choice controls.
- Keep a small "Feinjustieren" disclosure for users who still want exact 1-10 values.
- Preselect choices from existing data when possible:
  - low sleep / low Body Battery / high Garmin stress -> harder defaults;
  - normal recovery -> middle defaults;
  - good sleep / low stress -> easy defaults.
- Preserve current API payload by mapping choices to `mood`, `energy`, `stress`, `motivation`.
- Keep guided questions as optional chips below the quick choices.

**Acceptance:**
- A user can submit a check-in with three taps and no numeric thinking.
- The UI explains which Garmin/recovery signals influenced the suggestion.
- Existing mental trends continue to work because stored numeric fields remain unchanged.
- Mobile route evidence shows no overflow and touch targets stay comfortable.

### PR 2: Voice / Free-text First

**Scope:**
- Make "kurz beschreiben" a first-class option next to quick choices.
- Reuse the current voice endpoint and extraction display from Coach where possible.
- If a transcript/extraction yields scores, show them as editable choices before saving.
- Ask follow-up only when extraction confidence is visibly ambiguous; do not turn every check-in into a chat.

**Acceptance:**
- Voice or free text can produce a valid check-in without manually choosing all dimensions.
- Extracted values are inspectable and correctable before save.
- Failure states stay local and recoverable.

### PR 3: Daily Flow Placement

**Scope:**
- Surface the quick check-in from Home as the primary daily mental action.
- Keep Data > Mental as the history/evidence view.
- When Coach moves into daily surfaces, reuse the same quick check-in component instead of building a second check-in UI.

**Acceptance:**
- Home can start and complete the mental check-in without navigating through Data tabs.
- Data remains the review surface for themes, trends and mental load.
- Coach uses the check-in result as context, not as a second required workflow.

## QA Requirements

For PR 1:

- `npm run build -w frontend`
- `npm run test:e2e -- --project=mobile-chromium --grep "Mental|Check-in|Data"`
- `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/mental-checkin-simplification npm run qa:ux-evidence`
- Record findings in `docs/qa/2026-05-04-mental-checkin-simplification.md`.

For later PRs, add focused tests for voice/free-text extraction and Home entry once those surfaces change.

## Non-Goals

- No new DB fields in PR 1.
- No clinical labels, diagnoses or hidden mental-health inference.
- No LLM provider change.
- No new top-level navigation item.
- No nutrition/fueling scope.

## Open Implementation Notes

- The current backend already accepts `mood`, `energy`, `stress`, `motivation` from 1-10, so PR 1 can be frontend-only.
- If later analysis needs to distinguish user-entered exact scores from mapped quick choices, add additive metadata in a separate backend PR.
- Keep wording supportive and practical: "Was brauchst du heute?" instead of "Bewerte dich korrekt."
