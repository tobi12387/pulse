# Garmin Sync Confidence QA

## Scope

Frontend-only trust closure for Plan workout sync state. Automated QA used mocked Pulse API responses and did not contact live Garmin.

## Evidence

- Red test: `npm run test:e2e -- --project=desktop-chromium --grep "Garmin workout sync confidence"` failed because `data-testid="garmin-sync-confidence"` was missing in `WorkoutDetailModal`.
- Backend focused tests: `npm run test -w backend -- src/pulse/services/garmin-workout.test.ts src/pulse/services/workout-reconciliation.test.ts` passed with 8 tests after adding explicit label coverage for all execution states.
- Green tests: `npm run test:e2e -- --project=desktop-chromium --grep "Garmin workout sync confidence|Garmin execution states|sync-garmin"` passed with 3 tests after adding the shared confidence helper, modal panel and mocked sync-failure guard.
- Full E2E regression: `npm run test:e2e` passed with 170 tests and 12 expected skips after changing the local-only row copy from `Nur lokal geplant` to `Nur in Pulse geplant` to avoid duplicating the `Lokal` badge text.
- Build: `npm run build` passed for shared, backend and frontend.
- Route evidence: `npm run qa:ux-evidence` passed for desktop and mobile Chromium. Manifests are under `test-results/route-evidence/2026-05-05-752daa0/`; all captured routes report `horizontalOverflow=false`.

## Covered States

- `local_planned` -> `Nur in Pulse geplant`
- `garmin_template` -> `Garmin Vorlage vorhanden`
- `garmin_scheduled` -> `Auf Garmin geplant`
- `completed_matched` -> `Mit Garmin erledigt`
- `missed` -> `Nicht ausgeführt`
- `replaced_or_off_plan` -> `Ersetzt oder außerhalb Plan`

## Notes

- The existing Garmin upload/repair button remains the single bounded action in the modal.
- Backend reconciliation logic was reused unchanged; automated QA used mocked sync responses and did not call live Garmin.
