# 2026-05-21 Fueling Readiness Gap Copy

## Evidence

- Branch: `codex/fueling-readiness-gap-copy`
- Local DB command:

```bash
psql postgresql://postgres:postgres@localhost:5433/coaching_os_v2 \
  -c "SELECT count(*) AS total, count(*) FILTER (WHERE context='during') AS during, count(*) FILTER (WHERE context='during' AND (activity_id IS NOT NULL OR workout_id IS NOT NULL) AND carbs_g IS NOT NULL AND gi_comfort IS NOT NULL) AS comparable_complete FROM pulse_nutrition_logs;"
```

- Result: 5 total nutrition logs, 4 `during` logs, 0 comparable complete logs.

Relevant long during logs:

| Date | Activity | Duration | Carbs | GI comfort |
|---|---:|---:|---:|---|
| 2026-05-09 | Datteln Graveln | 398 min | 356 g | missing |
| 2026-05-04 | Datteln - Radfahren - Z2 | 80 min | 30 g | missing |

## Finding

The Fueling trend gate is correctly closed because there are not three comparable complete `during` logs with duration/activity context, carbs and GI comfort. The old readiness sentence was still too blunt: it said three comparable logs were missing, even though two existing long carb logs can count after structured GI comfort is added.

## Scope

- Keep the central three-log trend floor unchanged.
- Keep note text out of structured GI inference; Tobi must confirm GI comfort explicitly.
- Make `learningReadiness.missingEvidence[0]` explain when existing long logs can be completed and how many new complete logs remain afterwards.

## Verification

```bash
npm run test -w backend -- src/pulse/services/fueling-outcome-baseline.test.ts
node --test scripts/delivery-manifest.test.mjs
npm run delivery:manifest
git diff --check
npm run verify:lernschleifen
npm run test:scripts
npm run build -w shared && npm run build -w backend
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5433/pulse_codex_fueling_readiness_test npm test
```

Results:

- Focused Fueling baseline test: 8 tests passed.
- Delivery manifest test: 16 tests passed.
- `verify:lernschleifen`: 55 contract/golden tests, frontend build and 12 desktop/mobile Data smokes passed.
- `test:scripts`: 37 script tests and 106 frontend-logic tests passed.
- Shared/backend build passed.
- Full backend suite passed on a freshly migrated throwaway test database: 71 files, 452 tests.

Local note: the default `coaching_os_v2_test` database had an old partial migration ledger and failed before code execution with missing tables such as `pulse_action_decisions`, `pulse_weight_log`, `pulse_health_state` and `pulse_risk_signals`. The clean database `pulse_codex_fueling_readiness_test` was created and migrated to verify the current code path without dropping existing local state.

## Product Conclusion

Nutrition trend summaries remain gated. The next real unlock is structured GI comfort for the 2026-05-09 and 2026-05-04 long logs plus one more complete long-session Fueling log.
