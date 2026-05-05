# QA — Data Evidence Trail

Date: 2026-05-05
Branch: `codex/data-evidence-trail`

## Scope

- Home daily decision evidence chips link to Data evidence sections.
- Plan next-training source chips link to Data plan/load trace.
- Data overview exposes a compact provenance row for Mental, Garmin coverage and Plan/Load analysis.
- Data hash links select the required tab, scroll to the section and move focus to the target wrapper.

## Checks

- Red check before implementation: `npm run test:e2e -- --grep "evidence chips|provenance shortcuts"` failed because evidence chips and provenance shortcuts were not interactive.
- Focused check after implementation: `npm run test:e2e -- --grep "evidence chips|provenance shortcuts"` passed, 6/6.
- Review follow-up check: malformed Data hashes are covered so `/data#%` keeps the overview usable.
- URL-state regression check: `npm run test:e2e -- --grep "Daily loop keeps context|Data, Plan and Settings preserve URL-backed UI state|evidence chips|provenance shortcuts"` passed, 10/10.
- Final focused check after review fixes: `npm run test:e2e -- --grep "evidence chips|provenance shortcuts|malformed hashes|Data, Plan and Settings preserve URL-backed UI state"` passed, 10/10.
- Frontend build: `npm run build -w frontend` passed.
- Route evidence: `npm run qa:ux-evidence` passed, 2/2.
- Route evidence manifests:
  - `test-results/route-evidence/2026-05-05-23f9604/desktop-chromium/manifest.json`
  - `test-results/route-evidence/2026-05-05-23f9604/mobile-chromium/manifest.json`
- Manifest overflow check: all captured desktop and mobile routes report `horizontalOverflow: false`.
- Script checks: `npm run test:scripts` passed, 9/9.
- Full E2E: `npm run test:e2e` passed, 182 passed and 12 skipped.
- Whitespace check: `git diff --check` passed.

## Notes

- The Data route remains the single evidence surface; no new top-level route or backend contract was introduced.
- Home evidence remains compatible with existing string evidence. Only structured evidence with `targetPath` renders as an interactive chip.
- The Plan source row uses quiet button styling for linked evidence while keeping non-navigational availability evidence as a static chip.
- Evidence hash targets are focusable and keep a visible focus ring after scroll.
