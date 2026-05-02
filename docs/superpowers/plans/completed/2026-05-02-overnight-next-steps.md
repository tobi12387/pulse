# Pulse Overnight Next Steps — 2026-05-02 Morning Plan

> Stand: 2026-05-02 after Canva/Figma UX companion refresh (PR #99). The autonomous overnight sequence is complete; remaining items require Tobi's real iPhone or explicit Canva preview approval.

## Verified Baseline

- PR #92 added structured Insight `evidence` and `missingData` and was merged/deployed to server commit `4f31eaf`.
- PR #94 added the durable `pulse_action_decisions` model, pure closure transitions and stale-action suppression; it was merged/deployed to server commit `78b2fa4`.
- PR #95 added the shared `/api/pulse/actions` contract, Home closure controls and Coach action-state sync; it was merged/deployed to server commit `698280d`.
- PR #96 added explicit editable Coach Preferences and fed them into Coach context; it was merged/deployed to server commit `071f487`.
- PR #97 connected check-in and briefing push journeys to durable action decisions; it was merged/deployed to server commit `d05493f`.
- PR #98 added the real-device iPhone/VPN/PWA QA evidence record; it was merged/deployed to server commit `251c81c`.
- PR #99 recorded the Canva/Figma UX companion refresh and added the FigJam daily-loop diagram; it was merged/deployed to server commit `36a77e1`.
- Server checks after deploy:
  - `/api/pulse/health` returned `{"status":"ok","namespace":"pulse"}`.
  - `https://localhost:5175` returned `HTTP/2 200`.
  - PM2 `pulse` and `pulse-frontend` were online.
- Full deterministic UI suite:
  - `npm run test:e2e`: 61 passed, 1 skipped.
  - Desktop and mobile Chromium covered Home, Coach, Data, Plan, Insights, Settings, PWA manifest, service worker, push/settings grouping, Garmin execution states, recovery depth, data backfill, and daily decision flows.
- Optional iPhone/WebKit gate:
  - WebKit was missing initially, installed with `npx playwright install webkit`.
  - `PULSE_E2E_WEBKIT=true npm run test:e2e -- --grep "Mobile navigation and tabs keep core labels readable|PWA manifest"` then passed: 5 passed, 1 skipped.
- Browser Use note:
  - The Browser skill was loaded, but the required Node REPL `js` tool was not exposed in this Codex tool session. Browser-use should be retried in a session where `mcp__node_repl__js` is available; Playwright was used as the repeatable QA fallback.

## UI/UX Audit Findings

| Priority | Finding | Evidence | Next Action |
|---|---|---|---|
| P0 | No active production regression found in deterministic daily flows | Full E2E suite green; server health green | Continue with feature work, keep E2E gate mandatory |
| P1 | Daily decisions now have durable closure state | PR #94 stores action decisions; PR #95 lets Home close actions and Coach reflect the shared state | Extend the same action contract into push journeys |
| P1 | Coach memory/preferences are now explicit | PR #96 stores editable time windows, disliked patterns, long days, constraints and communication style | Use them in future Plan/Briefing refinements where helpful |
| P1 | Real iPhone/VPN QA is not yet captured as evidence | WebKit gate passes locally, but real iPhone add-to-home-screen and VPN certificate behavior remain manual | Run `docs/ai/checklists/iphone-pwa-qa.md` on device and record results |
| P2 | Insight evidence is visible but not yet route-linked | Insight cards show Datenbasis/Daten fehlen, but evidence items do not open Data/Plan detail routes | Add target routes in a small follow-up if user flow needs drilling into source data |
| P2 | Push journeys now reuse action state | PR #97 adds action-backed push URLs and CI-covered suppression tests | Validate on real iPhone once push is enabled on device |
| P2 | Canva/Figma companions need current status | Canva board was inspected and is stale; FigJam was updated with the new daily loop | Record companion status and defer Canva save until preview approval |

## Ordered Phases Until Morning

### Phase 1 — Current-Focus Closeout

**Goal:** Keep the compact AI working set accurate after PR #92.

**Scope:**
- Mark Insight Evidence Links as merged/deployed.
- Set active branch to none after closeout.
- Point next work to Decision Closure & Coach Memory, with iPhone real-device QA as a parallel manual gate.

**Verification:**
- `git diff --check`
- docs-sync CI after PR.

### Phase 2 — Decision Closure Model

**Status:** Done via PR #94 and deployed.

**Plan source:** `docs/superpowers/plans/2026-05-01-decision-closure-coach-memory-wave.md`

**Goal:** Persist whether a daily recommendation was completed, deferred, dismissed or superseded.

**Why next:** This is the largest remaining daily-use gap. Without closure, Pulse can still repeat advice that the user has already handled.

**Narrow PR shape:**
- Add additive `pulse_action_decisions` migration.
- Add pure decision-closure service.
- Include tests for `open -> completed`, `open -> deferred`, `open -> superseded`, Garmin matched activity auto-close, and stale check-in suppression.

**Acceptance:**
- Backend tests prove state transitions.
- `next-best-actions` can suppress stale actions.
- No UI change beyond contract shape unless needed for tests.

### Phase 3 — Home/Coach Closure Controls

**Status:** Done via PR #95 and deployed.

**Goal:** Let the user complete/defer the primary daily decision from Home and keep Coach in sync.

**Why after Phase 2:** UI controls need durable backend state first.

**Narrow PR shape:**
- `GET /api/pulse/actions` for current prioritized actions with closure state.
- `PATCH /api/pulse/actions/:id` for `completed`, `deferred`, `dismissed`.
- Home primary action controls.
- Coach reflects updated action state and does not auto-send prompts.
- E2E: Home completion updates Coach-visible state.

### Phase 4 — Explicit Coach Preferences

**Status:** Done via PR #96 and deployed.

**Goal:** Store visible, editable coaching preferences rather than hidden chat memory.

**Preference scope:**
- time windows;
- disliked workout patterns;
- preferred long days;
- injury-sensitive constraints;
- communication style.

**Non-goal:** Infer sensitive traits or mental-health labels.

**Acceptance:**
- Settings/Coach show editable preferences.
- PulseContext feeds preferences to Coach/Briefing/Plan.

### Phase 5 — Push Action Journeys

**Status:** Done via PR #97 and deployed.

**Goal:** Connect push notifications to action records and suppress repeats after completion/defer.

**Acceptance:**
- Push payloads include target URL/action ID only when an action exists.
- Check-in/risk/briefing pushes respect completed/deferred state.
- Tests cover quiet-period and already-handled actions.

### Phase 6 — Real iPhone/VPN QA Recording

**Status:** Done via PR #98 and deployed. Real device execution remains a manual gate for Tobi's iPhone.

**Goal:** Convert the WebKit gate into real device confidence.

**Manual checklist:** `docs/ai/checklists/iphone-pwa-qa.md`

**Evidence record:** `docs/qa/2026-05-02-iphone-pwa-real-device.md`

**Record:**
- VPN route to `192.168.178.46`;
- certificate behavior;
- Add to Home Screen;
- Home, Coach, Plan, Insights, Settings;
- bottom nav and Coach keyboard;
- push support state.

### Phase 7 — Canva/Figma UX Companion Refresh

**Status:** Done via PR #99 and deployed. Canva content update still needs explicit preview approval before saving.

**Goal:** Update visual review artifacts from observed daily flows, not speculative layouts.

**Use when Browser Use is available:**
- capture Home daily decision;
- Coach guided start/check-in;
- Plan execution state;
- Insights evidence;
- Settings iPhone/PWA diagnostics.

**Output:**
- Canva board gets route screenshots and friction notes.
- Figma/FigJam gets reusable states for decision closure controls and evidence cards.

**Current evidence:** `docs/qa/2026-05-02-ux-companion-refresh.md`

## Tomorrow Morning Review

By Saturday morning, 2026-05-02, the useful status view should answer:

1. Which phases merged and deployed?
2. Which checks passed locally and in CI?
3. Which daily-flow risks remain?
4. Which manual iPhone/VPN checks still need Tobi's device?
5. Whether Decision Closure is ready to become the next default daily loop.

## Morning Next Steps

1. Run the real iPhone/VPN/PWA checklist on Tobi's device and fill `docs/qa/2026-05-02-iphone-pwa-real-device.md`.
2. Approve a Canva preview update so the stale `Pulse Everyday Flow UX Board` can be saved with PR #94-#99 status.
3. Decide whether Insight evidence should deep-link into Data/Plan detail routes.
4. Use the new action-decision history for the next Daily Loop refinement: show "why this action is hidden" or a compact action history if repeated nudges still feel confusing.
