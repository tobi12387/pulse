# Mobile A11y Keyboard QA

## Scope

Second PR-sized slice of `2026-05-05-mobile-a11y-controls-polish.md`: keyboard semantics for shared segmented controls plus Mental button-radio groups. Touch targets were already closed in PR #184.

## Evidence

- Red tests: focused desktop/mobile Playwright checks failed before production changes because segmented controls were still buttons with `aria-pressed`, no `tablist` existed, and Mental button radios did not move focus or selection on ArrowRight.
- Green focused tests: `npm run test:e2e -- frontend/e2e/ux-a11y-responsive.spec.ts frontend/e2e/ux-data-mental.spec.ts --project=desktop-chromium --project=mobile-chromium` passed with 25 tests and 3 expected project skips.
- Broader role-regression tests: `npm run test:e2e -- frontend/e2e/pulse-smoke.spec.ts frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium` passed with 132 tests and 6 expected project skips.
- Full E2E regression: `npm run test:e2e` passed with 174 tests and 12 expected project skips.
- Build: `npm run build -w frontend` passed.
- Script guards: `npm run test:scripts` passed with 9 tests.
- Route evidence: `npm run qa:ux-evidence` passed for desktop and mobile Chromium. Manifests are under `test-results/route-evidence/2026-05-05-e873a0f/`; no captured route reports `horizontalOverflow=true`.

## Covered Controls

- Data segmented control exposes `tablist`/`tab`, `aria-selected`, roving `tabIndex`, ArrowLeft/ArrowRight/ArrowUp/ArrowDown plus Home/End.
- Plan segmented control uses the same shared semantics with its own accessible group label.
- Mental state cards, quick-choice groups and fine-tune score radios support arrow-key selection, wrap-around and focus movement.

## Remaining Work

- Full E2E regression and route evidence before merge.
- Data Decision Evidence Trail remains the next active trust-closure plan.
