# Post-Progression Benchmark & UI Review

> Stand: 2026-05-10, runtime baseline `9a29fe1`. Evidence pack: `test-results/route-evidence/fresh-benchmark-next-roadmap/2026-05-10-9a29fe1/2026-05-10-9a29fe1/`.

## Kurzfazit

Pulse hat die alte Benchmark-Roadmap weitgehend geschlossen: Garmin Execution Trust, Capability Progression, Archetype Rotation, RPE/GI/Mental-Fit und progression-aware Today Options sind implementiert. Der neue Engpass liegt nicht mehr in fehlender Intelligenz, sondern in **Plan-Aktivierung und Vertrauensabschluss**: bestehende Wochen zeigen nicht automatisch, ob sie mit der neuesten Logik erzeugt wurden, und der Nutzer muss verstehen, wann ein Refresh sinnvoll ist und wann Garmin geschrieben wird.

Groesste Staerke: Pulse kombiniert inzwischen Garmin-Ausfuehrung, mentale Lage, RPE, GI/Fueling und Capability in einer lokalen, persoenlichen Logik, die Top-Apps in dieser Kombination selten so direkt anbieten. Groesstes Risiko: Die UI kann diese Logik noch zu indirekt zeigen, besonders wenn ein alter Plan im Frontend steht oder der erste mobile Screen viel Kontext, aber wenig Entscheidungskraft zeigt.

## Frische Evidence

- `npm run qa:ux-evidence`: passed, `2 passed`.
- Desktop/mobile routes: Home, Coach compatibility route, Data, Data Mental, Data Analysen, Plan, Settings.
- Mobile route evidence reports no horizontal document overflow; the Plan WeekStrip still reports off-viewport child nodes inside the intended horizontal scroller, but `documentScrollWidth` remains equal to viewport width.
- Live server browser smoke after deploy:
  - `https://192.168.178.46:5175/` desktop/mobile: 200, no console errors.
  - `https://192.168.178.46:5175/plan?tab=training` desktop/mobile: 200, no console errors.
- Live note: no open live workout was present during the read-only browser smoke, so the new `Warum diese Einheit` row appears after the next plan generation/regeneration, not retroactively on old/no-plan states.

## Fresh Benchmark Sources

- TrainerRoad: [Plan Builder](https://support.trainerroad.com/hc/en-us/articles/360037923191-Plan-Builder-Overview), [TrainNow](https://support.trainerroad.com/hc/en-us/articles/360057075531-TrainNow-Overview), [Workout Levels](https://support.trainerroad.com/hc/en-us/articles/360061003592-Workout-Levels).
- TrainingPeaks: [Annual Training Plan](https://help.trainingpeaks.com/hc/en-us/articles/224662768-Annual-Training-Plan-Methodologies), [Structured Workout Sync](https://help.trainingpeaks.com/hc/en-us/articles/115000325647-Structured-Workout-sync-and-Manual-Export), [WKO5](https://www.trainingpeaks.com/wko5/).
- JOIN: [JOIN cycling training app](https://join.cc/).
- Intervals.icu: [feature overview/login page](https://app.intervals.icu/login).

## Benchmark Delta After The Latest PRs

| Area | Benchmark pattern | Pulse status now | Remaining gap |
|---|---|---|---|
| Daily workout choice | TrainerRoad TrainNow gives quick choices by duration/type and uses recent history. | Today Options now uses capability progression and blocks hard GI-risk choices. | UI should label the signal directly: productive, recovery, fueling-protect, mental-protect. |
| Plan creation | TrainerRoad Plan Builder accounts for goals, available time and history, then applies to calendar. | Pulse plan generation uses goals, availability, load, season, capabilities, RPE, GI, mental and Garmin contracts. | Existing plans need a visible refresh/diff gate when the logic or current data changed. |
| Workout difficulty | TrainerRoad makes workout levels visible per training zone/system. | Pulse shows capability levels and `Warum diese Einheit` on generated workouts. | Need plan-level summary: why this week changed, which systems progress, which are protected. |
| Device delivery | TrainingPeaks structured workouts sync to devices and show sync state; Garmin window is limited and explicit. | Pulse has Plan `Ausführung` with Garmin readback and repair actions. | After plan refresh/apply, show a post-sync readback summary in the same flow. |
| Long-term season | TrainingPeaks ATP supports duration/TSS/Event CTL methods and event priority. | Pulse Season Strategy provides annual hours/TSS and safe compensation. | Goal limiter demands should become more explicit: why this workout maps to this race limiter. |
| Deep analytics | WKO/Intervals emphasize power-duration, fatigue/form and model provenance. | Pulse has power-quality and durability foundations. | Keep analytics decision-oriented; avoid a dashboard race unless it changes next actions. |
| Busy-life adaptation | JOIN emphasizes availability updates and adapting around non-planned rides. | Pulse handles completed/off-plan rides and Today Options. | Add a safer "Plan Refresh Preview" for off-plan rides so adaptation is obvious but not automatic. |

## Top Findings

### Hoch - Plan Refresh Is Not A First-Class Flow

- **Problem:** The new plan intelligence only becomes visible after generation/regeneration. A user looking at an old or empty week sees no clear "this plan is stale relative to new data" state.
- **Why it matters:** TrainerRoad/JOIN make adaptation feel continuous. Pulse should not silently improve the engine while the visible plan remains old.
- **Recommendation:** Add a read-only Plan Refresh Preview that compares current plan vs regenerated proposal, explains data triggers, and requires explicit apply before Garmin writes.
- **Likely files:** `backend/src/pulse/routes/training-routes.ts`, `backend/src/pulse/services/plan-scenario-preview.ts`, `frontend/src/pages/Plan.tsx`, `frontend/src/features/plan/strategy/strategy-components.tsx`.

### Hoch - Garmin Apply Needs A Post-Apply Readback

- **Problem:** Plan `Ausführung` can show remote state, but plan generation/apply is still a separate mental model from post-sync proof.
- **Why it matters:** The user wants workouts on watch/Edge. "Applied" and "on device/calendar" must become one closed loop.
- **Recommendation:** After any explicit plan apply/regenerate, show expected Garmin operations, then read back remote diff and show success/repair in the same Plan flow.
- **Likely files:** `backend/src/pulse/services/garmin-execution-diff.ts`, `backend/src/pulse/routes/garmin-routes.ts`, `frontend/src/components/GarminExecutionTrustPanel.tsx`, `frontend/src/pages/Plan.tsx`.

### Hoch - Today Options Signal Labels Are Still Too Indirect

- **Problem:** The backend can now mark productive/recovery/fueling-protect decisions, but the visible card language still relies on detail text and evidence chips.
- **Why it matters:** On iPhone, the decision should be readable in two seconds.
- **Recommendation:** Add compact labels on Today Options: `Produktiv`, `Recovery`, `Fueling schützen`, `Mental schützen`, with one reason line.
- **Likely files:** `frontend/src/components/TodayOptionsCard.tsx`, `frontend/e2e/fixtures/pulse-api.ts`, `frontend/e2e/pulse-usability.spec.ts`.

### Mittel - GI/Fueling Debt Has No Clear Closure Condition In UI

- **Problem:** GI discomfort can now block hard training, but the app does not clearly tell the user what resolves the blocker.
- **Why it matters:** A protection rule without closure can feel arbitrary.
- **Recommendation:** Add a Fueling Closure micro-flow: log next long/easy fueling result, mark GI issue as resolved/observed, and show when hard training is allowed again.
- **Likely files:** `backend/src/pulse/services/fueling-recovery.ts`, `backend/src/pulse/services/today-options.ts`, `frontend/src/pages/ActivityDetail.tsx`, `frontend/src/pages/Data.tsx`.

### Mittel - Goal Limiters Need Stronger Workout Mapping

- **Problem:** Pulse has goal limiter evidence, but a workout row still does not always explain which race limiter it serves.
- **Why it matters:** TrainingPeaks ATP and strong paid plans are trusted because workouts map to event demands.
- **Recommendation:** Add limiter mapping to `Warum diese Einheit`: e.g. `Kraichgau limiter: lange aero-Fueling-Praxis`, `Threshold limiter: kontrollierter Sweetspot/Schwelle`.
- **Likely files:** `backend/src/pulse/services/goal-limiters.ts`, `backend/src/pulse/services/plan-engine.ts`, `frontend/src/features/plan/training/training-components.tsx`.

### Niedrig - Route Evidence Still Captures `/coach`

- **Problem:** `/coach` remains a compatibility route in evidence packs, while the active IA no longer treats Coach as a primary tab.
- **Why it matters:** It can keep pulling attention back to a hidden fifth surface.
- **Recommendation:** Keep `/coach` in smoke/evidence for deep-link safety, but label it explicitly as compatibility in QA output and roadmap summaries.
- **Likely files:** `docs/qa/route-evidence-pack.md`, `frontend/e2e/route-evidence.spec.ts`.

## Recommended Next Roadmap

1. **Plan Refresh Preview v1**
   - Read-only diff: current week vs regenerated week.
   - Shows triggers: new Garmin activity, RPE 9, GI issue, mental protect, capability update, stale plan logic.
   - Apply is explicit; Garmin writes only after apply.

2. **Plan Apply + Garmin Readback Closure**
   - Pre-apply operation summary: create/update/delete counts.
   - Post-apply remote readback: template/calendar/repeat proof.
   - Repair stays explicit.

3. **Today Options Signal Labels**
   - UI chips for productive/recovery/fueling/mental decisions.
   - Mobile first card must state "why this action" before details.

4. **Fueling Debt Closure**
   - Clear state for "GI issue open" vs "GI tolerated on next controlled session".
   - Hard-workout block explains the closure condition.

5. **Limiter-to-Workout Mapping**
   - Make race/goal limiter text part of `Warum diese Einheit`.
   - Data/Plan can show which limiter improved or remains protected.

6. **Evidence Automation**
   - Add a no-Garmin-write browser/API QA mode that can generate preview plans against fixtures and verify rationale, Today Options labels, and Garmin readback UI.

## Non-Goals

- No new top-level navigation tab.
- No copied TrainerRoad/TrainingPeaks workout library.
- No automatic FTP/profile mutation from analytics.
- No live Garmin writes in generic browser QA.
