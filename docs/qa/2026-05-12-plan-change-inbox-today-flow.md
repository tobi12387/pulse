# 2026-05-12 — Plan Change Inbox + Today Change Flow QA

## Scope

- `/plan` now shows a central `Plan-Änderungen` inbox when refresh preview, adaptation events or Garmin sync debt need attention.
- Planned-day Home alternatives now route to the existing Plan decision via `source=today-change` and `#next-training-decision` instead of the custom workout scenario path.
- No automatic Plan or Garmin write is introduced by either surface.
- Review follow-ups keep skipped workouts out of Garmin sync debt, route feedback actions to valid pages, and allow "Plan behalten" to hide the addressed inbox item locally.

## Verification

- `npm run test:frontend-logic` — passed.
- `npm run test -w backend -- src/pulse/services/today-options.test.ts` — passed.
- `npm run build -w frontend` — passed.
- `npm run build -w backend` — passed.
- `npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan exposes open change signals|Plan starts with the current action contract|Plan shows the week before season evidence" --workers=1` — passed.
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Home planned-day change option|Home surfaces quick availability intents|Plan shows persisted adaptation events|Plan refresh preview" --workers=1` — passed.
- `npm run qa:plan:no-garmin-write` — passed.
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-plan-change-inbox-today-flow npm run qa:ux-evidence` — passed.
- `npm run test:e2e:smoke -- --workers=1` — passed (`48` passed, `8` skipped).

## Route Evidence

- Desktop screenshots: `/tmp/pulse-plan-change-inbox-today-flow/2026-05-12-814db42/desktop-chromium/`
- Mobile screenshots: `/tmp/pulse-plan-change-inbox-today-flow/2026-05-12-814db42/mobile-chromium/`
- Horizontal overflow: `0` overflowing routes on desktop (`9` screenshots) and mobile (`15` screenshots).

## Notes

- A parallel Playwright attempt produced transient Vite/webserver conflicts and stale expectations against the old separate Adaptionskarte. The affected tests passed after the expectation was updated to the new Inbox and the browser runs were repeated sequentially with `--workers=1`.
