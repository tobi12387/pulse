# 2026-06-04 Command Deck Redesign

## Scope

- Branch: `codex/ui-ux-command-deck`
- Track: `Tagesentscheidung`
- Goal: continue Tobi's explicit top-app UI/UX reprioritization without adding hidden Plan, Garmin, LLM or data writes.
- Primary surfaces: shared app shell, Home/Heute, global card language, mobile route chrome and navigation smokes.

## Baseline Evidence

Commands:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-06-04-redesign-baseline npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-06-04-redesign-baseline
```

Baseline summary on `01bd54d`:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Evidence root: `/tmp/pulse-2026-06-04-redesign-baseline/2026-06-04-01bd54d/`

Manual friction read:

- The current app was technically safe but still put comparable weight on route header, nav item descriptions, Home header, decision card and side queue.
- The sidebar explained destinations but did not make the daily Performance Loop visible as one operating system.
- Mobile chrome was stable, but tests still carried older IA names from previous redesign passes, making the top-app language less explicit in QA.

## Redesign Decisions

- Added a desktop `Command Deck` in the sidebar that names the active work context and the five-step Performance Loop: Heute, Woche, Evidenz, Muster, System.
- Kept top-level destinations stable and within the mobile five-destination limit.
- Rebalanced the palette toward warm operational neutrals plus distinct blue, green, amber and rose semantics.
- Flattened the default card shell and nested-card treatment further.
- Turned the Home header into a dashboard strip (`Heute zuerst`) and renamed the secondary Home stack to an `Arbeitsqueue`.
- Updated responsive UX smokes to the current visible IA labels (`Evidenz`, `Woche`, `System`, `Muster`, `Stats`, `Heute`).

## Final Evidence

Commands:

```bash
npm run build -w shared
npm run build -w frontend
git diff --check
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-06-04-command-deck-redesign npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-06-04-command-deck-redesign
npx playwright test frontend/e2e/ux-a11y-responsive.spec.ts --project=desktop-chromium --project=mobile-chromium -g "keyboard tabbing|mobile top-level headers|desktop Focus operational routes"
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=mobile-chromium -g "Mobile shell keeps core labels"
npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "primary navigation exposes Focus routes|top-level hotkeys|Data mobile subnavigation|Plan mobile subnavigation"
```

Final summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Evidence root: `/tmp/pulse-2026-06-04-command-deck-redesign/2026-06-04-01bd54d/`
- Focus/header/shell smokes: 3 passed, 3 viewport-specific skips.
- Mobile shell smoke: 1 passed.
- Navigation/hotkey/mobile tab smokes: 5 passed, 3 viewport-specific skips.

Conclusion: the redesign preserves the primary route set and safety contracts while making the app feel more like one Performance OS: the shell names the active loop stage, Home starts with one daily command, and secondary items sit in an Arbeitsqueue.
