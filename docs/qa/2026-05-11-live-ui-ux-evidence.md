# 2026-05-11 Live UI/UX Evidence

## Scope

- Live base URL: `https://192.168.178.46:5175`
- Server commit during capture: `272fc21`
- Local branch for follow-up slice: `codex/live-ui-ux-evidence-slice`
- Viewports: desktop Chromium `1440x1100`, mobile Chromium Pixel 7 `412x915`

## Evidence Artifacts

- Mocked regression pack: `test-results/route-evidence/live-ui-ux-baseline-mocked/`
- Live deployed pack: `test-results/route-evidence/live-ui-ux-deployed/2026-05-11-272fc21/`

Artifacts are intentionally under `test-results/` and are not committed.

## Findings

### High: Home focus control is too card-like on mobile

- **Route:** `/`
- **Evidence:** `mobile-live/01-home.png`
- **Problem:** The new `Heute-Fokus` control works, but each mode is rendered like a small card with a visible sublabel. On iPhone width this consumes too much vertical space directly after the main decision and metric strip.
- **Impact:** The control becomes another bulky dashboard block instead of a lightweight ordering affordance. It delays the actual ordered focus cards, which conflicts with the goal of making Home calmer.
- **PR action:** Compress the control into a segmented selector: visible labels only, summaries as accessible labels, shorter helper copy, same local/read-only behavior.

### Medium: Plan week strip is intentionally scrollable but visually easy to miss

- **Route:** `/plan`
- **Evidence:** `mobile-live/05-plan.png`, DOM overflow sample inside `plan-week-strip-scroller`
- **Problem:** The week strip uses a horizontal scroller with a fixed inner width. The page itself has no document-level horizontal overflow, but the offscreen days are not visibly introduced.
- **Impact:** This is acceptable as a contained scroller, but a future polish pass could add a fade/scroll hint or convert it to a denser 7-day fit on mobile.
- **PR action:** No immediate change in this slice; the strongest observed issue is the Home focus control.

### Low: Settings has small deep-diagnostic controls

- **Route:** `/settings`
- **Evidence:** `desktop-live/06-settings.png`, `mobile-live/06-settings.png`
- **Problem:** Some lower diagnostic actions such as `Aktivitätswetter nachladen` and `Körperdaten nachladen` are below 44 px height.
- **Impact:** These are not primary daily controls and appear deep in Settings, but they remain candidates for a later touch-target polish pass.
- **PR action:** Defer to avoid widening the slice.

## Selected Slice

Implement only the Home `Heute-Fokus` density fix. Do not add new modes, persistence, backend state, Garmin writes, Settings work or Plan scroller changes.

## Verification Targets

- `npm run build -w frontend`
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Daily Surface|Home"`
- `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/live-ui-ux-focus-control npm run qa:ux-evidence`
