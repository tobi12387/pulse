# Pulse UX Companion Refresh - 2026-05-02

## Toolchain Actions

| Tool | Action | Result |
|---|---|---|
| Canva | Existing design searched and inspected again | `Pulse Everyday Flow UX Board` found as `DAHIZ5-Q53o` / `https://www.canva.com/d/XbRDL4VinTJIaO8`; content is still stale and references early Phase 1 plus old open phases. |
| Figma / FigJam | Updated board with current evidence loop | Added `UX Evidence Loop 2026-05-02` to `https://www.figma.com/board/pk4iHWfci7iv9ot5y76j6Z` with screenshot pack, daily-flow states, Settings diagnostics, Canva status and WebKit gate nodes. |
| Repo | Repeatable evidence command | Added `docs/qa/route-evidence-pack.md` and Playwright route evidence spec. Screenshot output stays in ignored `test-results/route-evidence/`. |

## Current Flow Captured In FigJam

- Garmin sync and check-in feed Pulse Context.
- Pulse Context produces Next-Best Actions.
- `pulse_action_decisions` stores durable action state.
- Home, Coach and Push read the same action state.
- Coach Preferences are explicit input into Pulse Context.
- iPhone/PWA QA now has a repo-level evidence record.
- The expected product outcome is less repeated advice.
- Current route evidence loop now adds:
  - screenshot pack for Home, Coach, Data, Plan, Insights and Settings
  - daily context panel, next training decision and inline recovery states
  - Settings diagnostics matrix
  - Canva stale/approval status
  - optional WebKit/iPhone regression gate

## Canva Board Gap

The Canva board is useful as a visual companion, but the current text is materially outdated:

- It still says Phase 1 Coach briefing is the current status.
- It lists old open phases: Plan Alternativen 2.0, Insights reliability, Backfill observability, Settings grouping.
- It does not mention the later UI/UX closure work through PR #158: Mobile Touch And Containment, Daily Loop Route Priority, Feedback Resilience and Settings Diagnostics Matrix.

Direct Canva editing was not saved in this session because the Canva editing workflow requires explicit preview approval before commit. The next Canva update should replace the stale status block with the deployed UI/UX closure status and attach current route screenshots from the evidence pack.

## Route Evidence Pack

Regenerate current route evidence with:

```bash
npm run qa:ux-evidence
```

Optional iPhone WebKit evidence:

```bash
npm run test:e2e:install:webkit
npm run qa:ux-evidence:iphone
```

Output policy:

- PNGs and manifests are written under `test-results/route-evidence/<date>-<commit>/<project>/`.
- `test-results/` is ignored, so screenshot files are intentionally not committed.
- Durable docs should record the command, commit, viewport, path and findings, not duplicate binary assets.

Latest local evidence generated in this slice:

| Command | Output | Result |
|---|---|---|
| `npm run qa:ux-evidence` | `test-results/route-evidence/2026-05-02-df77cdb/desktop-chromium/` and `.../mobile-chromium/` | 12 screenshots captured; manifests report no horizontal overflow on all six routes. |
| `npm run qa:ux-evidence:iphone` | `test-results/route-evidence/2026-05-02-df77cdb/desktop-chromium/` and `.../iphone-webkit/` | Desktop plus iPhone WebKit screenshots captured; manifests report no horizontal overflow on all six routes. |

## Recommended Next Companion Updates

1. Update Canva board status block:
   - Current deployed commit after this toolchain slice: `1196450`.
   - Completed UI/UX closure: PR #154 through PR #159.
   - Manual gate: iPhone certificate trust remains real-device only.
2. Add a Canva route checklist row for:
   - Home daily decision and feedback recovery.
   - Coach persistent daily context and send retry.
   - Plan next training decision and Today Adjust closure.
   - Data coverage without mobile overflow.
   - Insights trend translation.
   - Settings diagnostics matrix and Push/PWA states.
3. Keep FigJam as the visual flow/component-state companion.
4. Keep repo markdown as the source of truth for acceptance, commands and decisions.

## Morning Status

- Figma/FigJam: updated with current UX evidence loop.
- Canva: inspected and confirmed stale; update requires preview approval before commit.
- Repo docs: updated with repeatable route evidence pack.
