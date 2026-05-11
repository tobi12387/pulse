# Focus Shell + Heute Evidence — 2026-05-11

## Scope

- Focus design tokens and global shell.
- Primary navigation: `Heute`, `Data`, `Plan`, `Insights`, `Settings`; Coach remains reachable as `/coach` compatibility route and `⌘K` command.
- Home first slice: `Single Decision + Diary` using the existing `deriveDailyDecision` contract and real Home data.

## Evidence

- Build: `npm run build -w frontend`
- Smoke/navigation: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "renders without runtime errors|primary navigation|top-level hotkeys|/insights|daily training surfaces"`
- Home/mobile regressions: `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Home daily action|Daily loop clarity|Home owns the full daily decision|Home daily decision can open Coach|Home Focus hero Coach CTA|Home diary treats today nextWorkout|Coach command drawer manages focus|Mobile routes avoid unintended horizontal overflow"`
- Accessibility/responsive: `npx playwright test frontend/e2e/ux-a11y-responsive.spec.ts --project=desktop-chromium --project=mobile-chromium`
- Route evidence: `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/focus-shell-today npm run qa:ux-evidence`

## Screenshot Pack

- Desktop: `test-results/route-evidence/focus-shell-today/2026-05-11-453ea8e/desktop-chromium/`
- Mobile: `test-results/route-evidence/focus-shell-today/2026-05-11-453ea8e/mobile-chromium/`

Both manifests report `horizontalOverflow: false` for captured routes.

## Notes

- The Browser plugin did not expose a navigation/screenshot tool through discovery in this session, so Playwright route evidence was used as the browser QA fallback.
- The untracked `codex-handoff/` folder was used only as local design reference and was not staged.
