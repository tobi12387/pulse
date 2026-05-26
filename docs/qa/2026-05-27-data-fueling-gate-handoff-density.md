# Data Fueling Gate Handoff Density Evidence

## Scope

Focused UI/UX follow-up after the deployed Activity Detail closure surface. The current Performance-OS gate audit still names Fueling learning as the first unblock, with GI comfort missing on existing long carb logs. Fresh route evidence on deployed `main` showed the Data primary action was correct, but the Fueling handoff still split the one manual task across several similarly weighted boxes before the candidate logs.

This is a gate-support slice, not a nutrition logic change. Data keeps routing to Activity Detail for the actual GI comfort choice; it does not write GI comfort directly.

## Baseline

Command on deployed `main`:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-27-current-main-after-activity-closure npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-27-current-main-after-activity-closure
```

Summary:

- desktop Chromium: 9 screenshots, 0 horizontal overflow
- mobile Chromium: 17 screenshots, 0 horizontal overflow
- commit: `89b2fdd`

Manual finding:

- `mobile-chromium/15-data-fueling-action.png` had the correct `GI-Komfort ergänzen` action, allowed choices and manual safety rule.
- The action button appeared after target, allowed choices, manual rule and capture plan, so the next step was visually less immediate than the explanation.
- The allowed GI choices were a sentence, not a quick scanable choice set.

## Change

- Move the Data primary action CTA directly below the target log.
- Render the allowed GI comfort choices as compact chips while preserving the existing allowed-choice test id and text.
- Keep the manual safety rule and capture plan visible, but visually secondary to the target and CTA.
- Leave candidate logs, Activity Detail target routing, nutrition writes and Plan/Garmin behavior unchanged.

## After

Command:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-27-data-fueling-gate-handoff-density npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-27-data-fueling-gate-handoff-density
```

Summary:

- desktop Chromium: 9 screenshots, 0 horizontal overflow
- mobile Chromium: 17 screenshots, 0 horizontal overflow
- worktree base commit: `89b2fdd`

Manual review:

- `mobile-chromium/15-data-fueling-action.png` now shows target log, `GI-Komfort ergänzen`, allowed GI choices, manual safety and capture plan in a clearer order.
- Candidate logs remain visible below the primary action.
- The first write still happens only after navigating to Activity Detail and selecting the explicit GI comfort option.

## Verification

```bash
git diff --check
npm run build -w shared
npm run build -w frontend
npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=mobile-chromium -g "Data today promotes actionable fueling learning gaps"
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-27-data-fueling-gate-handoff-density npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-27-data-fueling-gate-handoff-density
```

Result:

- all listed checks passed
- route evidence: 2 passed, 0 horizontal overflow
