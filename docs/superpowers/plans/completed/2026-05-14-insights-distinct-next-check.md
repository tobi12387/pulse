# Insights Distinct Next Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the Insights hero already owns the primary recommendation, the next-check card should show the next distinct useful check instead of a no-op confirmation.

**Architecture:** Frontend-only, deterministic and read-only. Reuse the existing Insights evidence sources and `NextCheckItem` component; do not add endpoints, LLM calls, plan writes or Garmin writes.

**Tech Stack:** React, Vite, Playwright, Pulse route evidence.

---

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Update the duplicate-focus Insights contract to require a distinct visible next check. |
| Modify | `frontend/src/pages/Insights.tsx` | Derive visible next checks from the primary intervention plus secondary checks, filtering the focus duplicate. |
| Create | `docs/qa/2026-05-14-insights-distinct-next-check.md` | Record evidence and verification. |
| Modify | `docs/decisions.md` | Record the UX decision. |
| Move | this plan to `docs/superpowers/plans/completed/` | Close the plan after implementation. |

## Tasks

### Task 1: Red Test

- [x] Update `Insights does not repeat the current focus as a second next-check card` so the duplicate-focus state expects:
  - no confirmation sentence `Die wichtigste Prüfung steckt bereits im aktuellen Fokus.`;
  - no visible `Fueling-Praxis absichern` inside `insights-next-actions`;
  - one visible `insights-next-check-item` by default;
  - two visible items after opening `Weitere Prüfungen anzeigen`.
- [x] Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Insights does not repeat the current focus" --project=mobile-chromium
```

Result before implementation: failed because the current UI showed the no-op confirmation and zero next-check rows.

### Task 2: Minimal Implementation

- [x] In `Insights.tsx`, build a small `nextCheckCandidates` array from:
  - the primary intervention;
  - Datenqualität;
  - Capability.
- [x] Filter candidates whose normalized title equals the hero focus title.
- [x] Render the first remaining candidate by default.
- [x] When expanded, render the remaining candidates.
- [x] Keep the existing section, disclosure button, labels and read-only behavior.

### Task 3: Verification

- [x] Re-run the focused red test and expect green.
- [x] Re-run all focused Insights checks:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Insights" --project=desktop-chromium --project=mobile-chromium
```

- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Run route evidence and summary:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-insights-distinct-next-check-final npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-insights-distinct-next-check-final
```

### Task 4: Closeout

- [x] Update QA doc with red/green evidence.
- [x] Move this plan to `docs/superpowers/plans/completed/2026-05-14-insights-distinct-next-check.md`.
- [x] Add completed-plan README entry.
