# 2026-05-16 Analysis Power Evidence Actions

## Scope

- Data > Analyse keeps the translation card read-only.
- When Power data quality is the secondary analysis watch signal, the card now opens the existing `Power-Datenqualität` evidence block at `#data-power-quality`.
- When Durability is the secondary analysis watch signal, the card now opens the existing `Power / Durability` evidence block at `#data-power-duration`.
- These actions only navigate to evidence; they do not write Plan, Garmin, Coach or LLM state.

## Verification

- Red: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "Data analysis opens (power quality|durability)" --project=desktop-chromium --workers=1` failed because both watch signals lacked `Nach dem Klick` previews and CTAs.
- Green: same command passed after adding Power/Durability target paths and evidence anchors.
- Group: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "Data analysis" --project=desktop-chromium --project=mobile-chromium --workers=1` passed with 14 tests after rerun.
- `git diff --check` passed.
- `npm run lint -w frontend` passed.
- `npm run build` passed.
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-analysis-power-evidence-actions npm run qa:ux-evidence` passed.
- `npm run qa:ux-summary -- /tmp/pulse-analysis-power-evidence-actions` reported 2 manifests, 9 desktop screenshots, 15 mobile screenshots and 0 horizontal overflow.
