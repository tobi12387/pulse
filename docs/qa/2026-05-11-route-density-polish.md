# 2026-05-11 Route Density Polish

## Scope

- Branch: `codex/route-density-polish`
- Base commit during local evidence: `7133d39`
- User friction: pages feel too full, especially on desktop.
- Viewports: desktop Chromium `1280x720`, mobile Chromium `412x839`.

## Evidence

- Baseline route pack: `test-results/route-evidence/route-density-polish-baseline/2026-05-11-7133d39/`
- After route pack: `test-results/route-evidence/route-density-polish-after/2026-05-11-7133d39/`
- Artifacts stay under `test-results/` and are not committed.

## Findings And Actions

### High: Plan repeats season evidence in the first desktop viewport

- **Route:** `/plan`
- **Evidence:** Baseline `desktop-chromium/06-plan.png`
- **Problem:** `Saisonvertrag` and `Saisonlinie` both rendered as full evidence cards in sequence. The current Plan action and season contract were useful, but the second full season card made the page feel like a dashboard wall.
- **Action:** Keep `Saisonvertrag` visible and make `Saisonlinie` progressive. The summary remains visible; ATP, forecast, guardrails and evidence open via `Saisonlinie anzeigen`.

### High: Settings starts with both status and full diagnosis

- **Route:** `/settings`
- **Evidence:** Baseline `desktop-chromium/07-settings.png`
- **Problem:** Settings answered `Problem beheben`, then immediately rendered a second full diagnosis matrix. This made the first screen feel like diagnostics even when the user only needs the next action.
- **Action:** Keep the status summary visible and collapse the technical matrix behind `Diagnose anzeigen`.

### Medium: Mobile Plan week strip hid days inside a horizontal scroller

- **Route:** `/plan?tab=training`
- **Evidence:** Previous live evidence showed offscreen nodes inside `plan-week-strip-scroller`.
- **Problem:** The contained scroller avoided document overflow, but it still made days feel hidden.
- **Action:** Fit all seven days into the available width with narrower stable day cells instead of requiring horizontal scrolling.

## Verification Targets

- `npm run build -w frontend`
- `npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan season lane|Plan mobile week strip"`
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Settings diagnostics matrix|Settings PWA diagnostics|Mobile repeated controls|Settings groups actions|Plan shows season strategy|Plan season strategy keeps"`
- `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/route-density-polish-after npm run qa:ux-evidence`

## Follow-Up Candidates

- Home desktop still carries a large daily card plus metric strip and focus selector in the first viewport. Do not change it again until fresh feedback confirms the compact focus selector is still too prominent.
- Data `Analyse` is information-dense but currently has no overflow and uses analysis as an explicit deeper tab. Prefer clearer grouping over more cards.
