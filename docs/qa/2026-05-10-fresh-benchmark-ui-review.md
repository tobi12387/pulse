# Fresh Benchmark & UI Review

> Stand: 2026-05-10, branch `codex/fresh-benchmark-ui-roadmap`, runtime baseline `c1af5b9`.

## Kurzfazit

Pulse hat inzwischen die richtigen Bausteine: Home als Tagesentscheidung, Data als Evidenz, Plan als bewusste Änderungsebene und Settings als Diagnose. Der frische Benchmark zeigt aber, dass TrainerRoad, TrainingPeaks, Garmin Coach und JOIN weiterhin stärker wirken, weil sie drei Dinge sehr klar machen: was heute zu tun ist, wie schwer es relativ zu meiner aktuellen Fähigkeit ist, und ob die Einheit wirklich auf dem Gerät ankommt.

Das größte Produkt-Risiko ist nicht fehlende Feature-Breite, sondern Vertrauen im Alltag. Wenn Home widersprüchlich wirkt, Plan-Deep-Links unter dem mobilen Header landen oder Garmin-Sync nur lokal erklärt statt remote bestätigt wird, fühlt sich Pulse trotz guter Logik unsicher an.

## Evidence

- `npm run qa:ux-evidence`: passed, `2 passed`.
  - Screenshots: `test-results/route-evidence/fresh-benchmark-ui-review/2026-05-10-c1af5b9/`.
  - Desktop `1280x720`: Home, Coach, Data, Data Mental, Data Analysen, Plan, Settings.
  - Mobile `412x839`: same routes plus Home intent states and Plan mobile-intent scenario.
  - Manifests reported no horizontal overflow on captured routes.
- Focused mobile E2E:
  - `npm run test:e2e -- --project=mobile-chromium --grep "Home treats|Mobile Quick Decision|Data shows today evidence|Settings show profile|Plan shows Garmin execution"`
  - Result: `4 passed`.
- In-app Browser Use attempted through `node_repl`, but the Node runtime tool failed with `No such file or directory`. Visual/browser evidence therefore comes from Playwright browser automation plus screenshot inspection.

## Benchmark Sources

- TrainerRoad: [Plan Builder](https://support.trainerroad.com/hc/en-us/articles/360037923191-Plan-Builder-Overview), [TrainNow](https://support.trainerroad.com/hc/en-us/articles/360057075531-TrainNow-Overview), [Workout Levels](https://support.trainerroad.com/hc/en-us/articles/360061003592-Workout-Levels), [Athlete Levels](https://support.trainerroad.com/hc/en-us/articles/4404665021595-Athlete-Levels).
- TrainingPeaks: [Annual Training Plan](https://help.trainingpeaks.com/hc/en-us/articles/224662768-Annual-Training-Plan-Methodologies), [Structured Workout Builder](https://help.trainingpeaks.com/hc/en-us/articles/235164967-Structured-Workout-Builder), [Structured Workout Sync](https://help.trainingpeaks.com/hc/en-us/articles/115000325647-Structured-Workout-sync-and-Manual-Export), [Strength Workout Builder](https://help.trainingpeaks.com/hc/en-us/articles/21397126893581-Using-the-Strength-Workout-Builder).
- Garmin: [Garmin Coach overview](https://www.garmin.com/en-US/garmin-coach/overview/).
- JOIN: [JOIN cycling training app](https://join.cc/).
- Intervals.icu: [Fitness, Fatigue & Form](https://www.intervals.icu/features/fitness-chart/).
- Xert: [Adaptive Training Advisor guide](https://www.baronbiosys.com/beginners-guide-using-the-xert-adaptive-training-advisor/).
- WKO5: [WKO5 overview](https://www.trainingpeaks.com/wko5/), [Power-Duration model basis](https://wko5.zendesk.com/hc/en-us/articles/8102886711821-The-scientific-basis-of-the-Power-Duration-Model-in-WKO).

## Benchmark Diagnosis

| Capability | Benchmark leader pattern | Pulse today | Gap |
|---|---|---|---|
| Daily decision speed | JOIN and TrainNow let users choose a usable workout quickly from availability/recent history. | Home has Today Options and Plan scenario previews, but first screen can still read like a dashboard. | High |
| Adaptive progression | TrainerRoad exposes workout levels and athlete levels per zone/system. | Pulse has capability levels and a local workout library, but they are not yet the primary visible planning language. | High |
| Execution trust | TrainingPeaks/Garmin/JOIN make device delivery explicit. | Sync contracts and ledger exist, but no remote diff/readback surface is visible in Plan. | Critical |
| Long-range planning | TrainingPeaks ATP models annual duration/TSS/CTL and event priority. | Season ATP v2 exists as a compact guardrail. | Medium |
| Deep physiology | Intervals/WKO expose PMC, power curve, durability and model provenance. | Pulse has power-quality and durability foundations, but should keep these decision-oriented, not dashboard-heavy. | Medium |
| Human context | Athletica/Wahoo/FasCat tie readiness, subjective state and recovery into daily advice. | Pulse has mental, fueling, GI comfort and recovery context. This is a differentiator if it changes the next action consistently. | High |

## Top Findings

### Kritisch - Garmin execution trust is not yet remote-confirmed

- **Bereich:** Product / UX / Backend.
- **Problem:** Pulse can explain local Garmin sync contracts and ledger entries, but the UI does not yet show a fresh remote readback/diff against Garmin calendar/workouts.
- **Why it matters:** The user wants workouts on watch/Edge. TrainingPeaks and JOIN set the expectation that sync status is boring and explicit.
- **Recommendation:** Add a Plan-level `Ausführung` panel/tab with remote readback, mismatch reasons, broken-repeat detection, repair actions and last real-device proof.
- **Files likely touched:** `backend/src/pulse/routes/garmin-routes.ts`, `backend/src/pulse/services/garmin-calendar-workouts.ts`, `backend/src/pulse/services/garmin-execution-ledger.ts`, `frontend/src/pages/Plan.tsx`, `frontend/src/pulse/api-client.ts`.
- **Roadmap:** `docs/superpowers/plans/completed/2026-05-10-garmin-execution-trust-v2.md`.

### Hoch - Home still has split daily truth

- **Bereich:** UX / Content / Frontend.
- **Problem:** Route evidence showed Daily Decision saying "Heute ist kein Training geplant", while the following Today Options card said "Heute ist Training geplant".
- **Why it matters:** This is the exact kind of contradiction that makes a coaching app feel untrustworthy.
- **Recommendation:** Introduce a single daily command state that resolves completed/planned/recovery/free-day/intent before rendering DailyDecision and TodayOptions.
- **Files:** `frontend/src/pulse/daily-decision.ts`, `frontend/src/components/TodayOptionsCard.tsx`, `frontend/src/pages/Home.tsx`, `frontend/e2e/fixtures/pulse-api.ts`.
- **Roadmap:** `docs/superpowers/plans/completed/2026-05-10-daily-command-center-v2.md`.

### Hoch - Mobile first viewport is still too heavy

- **Bereich:** Mobile UX.
- **Problem:** Home, Data Mental and Settings all expose too much structure before the next best action.
- **Why it matters:** Pulse is meant to work on iPhone/PWA over VPN; the useful action must be reachable in seconds.
- **Recommendation:** Make Home answer "what now?" in one viewport, make Mental Check-in one-tap-first, and move optional details behind disclosure.
- **Files:** `frontend/src/pages/Home.tsx`, `frontend/src/features/data/mental/mental-components.tsx`, `frontend/src/pages/Settings.tsx`.
- **Roadmap:** `docs/superpowers/plans/completed/2026-05-10-daily-command-center-v2.md`.

### Hoch - Capability/progression is not visible enough

- **Bereich:** Product / Training logic.
- **Problem:** Pulse has capability levels, workout difficulty and archetypes, but the user still sees many planned workouts as similar.
- **Why it matters:** TrainerRoad wins trust because workout difficulty is an explicit progression language, not hidden scoring.
- **Recommendation:** Surface energy-system progression and variant rationale in Plan/Data; expand library depth only where RPE/completion history supports it.
- **Files:** `backend/src/pulse/services/training-capabilities.ts`, `backend/src/pulse/services/workout-library.ts`, `frontend/src/features/training/TrainingCapabilityCard.tsx`, `frontend/src/pages/Plan.tsx`.
- **Roadmap:** `docs/superpowers/plans/completed/2026-05-10-progression-library-v2.md`.

### Mittel - Plan mobile-intent hash target clips under mobile chrome

- **Bereich:** Responsive / Accessibility.
- **Problem:** The mobile-intent screenshot starts mid-card; the scenario preview heading/context is clipped by the fixed top bar.
- **Why it matters:** This is a high-frequency iPhone flow. Landing in the middle of the decision increases uncertainty.
- **Recommendation:** Add shared scroll margins/focus behavior for `#plan-scenario-preview` and cover it in route evidence.
- **Files:** `frontend/src/pages/Plan.tsx`, `frontend/src/index.css`, `frontend/e2e/route-evidence.spec.ts`.
- **Roadmap:** `docs/superpowers/plans/completed/2026-05-10-ui-accessibility-polish-v2.md`.

### Mittel - 155 km sample still leaks into generic scenario evidence

- **Bereich:** QA / UX Content.
- **Problem:** The 155-km example is no longer a product feature, but mocked scenario defaults still produce `155 km simuliert` warnings and 423 min / 296 TSS evidence in generic route evidence.
- **Why it matters:** QA screenshots can keep resurrecting a concept the user explicitly rejected as a fixed feature.
- **Recommendation:** Make route evidence defaults reflect generic 60-min mobile intent and keep long-tour cases only in specific tests.
- **Files:** `frontend/e2e/fixtures/pulse-api.ts`, `frontend/e2e/route-evidence.spec.ts`, `frontend/e2e/pulse-usability.spec.ts`.
- **Roadmap:** `docs/superpowers/plans/completed/2026-05-10-ui-accessibility-polish-v2.md`.

### Mittel - Accessibility polish needs one dedicated pass

- **Bereich:** Accessibility / Responsive.
- **Problem:** Several controls still have risks: inline `outline: none`, incomplete tab-panel relationships, tablet sidebar targets below 44px, clickable rows without keyboard semantics, small `--text-3` helper text.
- **Why it matters:** These issues rarely break screenshots, but they degrade real iPhone/iPad and keyboard use.
- **Recommendation:** Close these as a focused accessibility PR before larger UI restructuring.
- **Files:** `frontend/src/index.css`, `frontend/src/components/Layout.tsx`, `frontend/src/components/PulseChrome.tsx`, `frontend/src/pages/Home.tsx`, `frontend/src/pages/Plan.tsx`, `frontend/src/features/data/mental/mental-components.tsx`.
- **Roadmap:** `docs/superpowers/plans/completed/2026-05-10-ui-accessibility-polish-v2.md`.

## Navigation Decision

Do not add a new top-level tab now. The four-tab model remains correct:

1. Home = daily command.
2. Data = evidence.
3. Plan = planning and execution.
4. Settings = device/account diagnostics.

New navigation can be added as nested surfaces where it reduces confusion:

- Plan can add a nested `Ausführung` tab/panel for Garmin device trust.
- Data can compress seven equal tabs into grouped evidence controls later.
- Coach should remain contextual and deep-linkable, not return to primary navigation.

## Recommended Roadmap Order

1. `completed/2026-05-10-ui-accessibility-polish-v2.md`
   - Fix clipping, focus, tablet touch, stale route-evidence defaults.
2. `completed/2026-05-10-daily-command-center-v2.md`
   - Make Home and Mental Check-in faster and internally consistent.
3. `completed/2026-05-10-garmin-execution-trust-v2.md`
   - Add remote readback/diff/repair and Plan `Ausführung` surface.
4. `completed/2026-05-10-progression-library-v2.md`
   - Make workout difficulty/progression visible and extend library depth where supported.

## What Is Already Good

- Primary nav is much leaner than earlier builds.
- No horizontal overflow in the fresh captured desktop/mobile routes.
- Mental Check-in has the right direction: human-language choices first, numeric fine-tune optional.
- Plan scenario preview is correctly preview-first and apply-only.
- Settings already centralizes PWA, Push, Garmin and profile diagnostics.
