# 2026-05-16 - Analysis Learning/Response Actions QA

## Scope

- Data > Analyse now routes decision-quality learning signals to the existing decision-quality evidence card.
- Data > Analyse now routes personal-response signals and response-evidence gaps to the existing personal-response evidence card.
- The analysis card remains read-only: no Plan, Garmin or Coach writes are introduced.

## Verification

- Focused check: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --grep "Data analysis opens (decision-quality|personal response)"` passed, 3 tests. The sandboxed first attempt failed before tests because Vite could not bind `127.0.0.1:5173`; the escalated rerun passed.
- Data analysis smoke: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "Data analysis" --project=desktop-chromium --project=mobile-chromium --workers=1` passed, 20 tests.
- Static gates: `git diff --check`, `npm run lint -w frontend`, and `npm run build` passed.
- Route evidence: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-analysis-learning-response-actions npm run qa:ux-evidence` passed, 2 tests.
- Route summary: `npm run qa:ux-summary -- /tmp/pulse-analysis-learning-response-actions` reported 0 horizontal overflow for desktop and mobile.
- Browser smoke: `http://127.0.0.1:5174/data?tab=analysis` loaded with title `Pulse`, no framework overlay and no browser console warnings/errors. The local backend was not running, so API-backed cards showed their recoverable fallback states; action-click behavior is covered by the mocked Playwright tests above.

## Evidence Files

- Desktop manifest: `/tmp/pulse-analysis-learning-response-actions/2026-05-16-a67f637/desktop-chromium/manifest.json`
- Mobile manifest: `/tmp/pulse-analysis-learning-response-actions/2026-05-16-a67f637/mobile-chromium/manifest.json`
- Checked screenshot: `/tmp/pulse-analysis-learning-response-actions/2026-05-16-a67f637/desktop-chromium/05-data-analysis.png`
- Checked screenshot: `/tmp/pulse-analysis-learning-response-actions/2026-05-16-a67f637/mobile-chromium/05-data-analysis.png`
