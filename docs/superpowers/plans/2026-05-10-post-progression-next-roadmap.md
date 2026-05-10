# Post-Progression Next Roadmap

> **For agentic workers:** Progression Library v2 is complete. Use this roadmap for the next phases. Do not rebuild completed plans under `docs/superpowers/plans/completed/`.

**Goal:** Turn the post-progression benchmark into the next Pulse product upgrades, focused on plan activation, Garmin closure and daily iPhone usability.

**Evidence:** `docs/qa/2026-05-10-post-progression-benchmark-ui-review.md`.

---

## Phase 1: Plan Refresh Preview v1

**Problem:** New planning intelligence only appears after regeneration. Users need to know when the visible week is stale relative to new Garmin/RPE/GI/Mental/Capability evidence.

**Story:** As Tobi, I want Pulse to show a preview of how my current week would change before anything is saved or synced, so I can understand whether a refresh is worth applying.

**Acceptance Criteria**

- Plan shows a `Plan prüfen` / `Refresh Preview` entry when relevant signals exist.
- Preview compares current workouts vs proposed workouts by date, sport, zone, duration, archetype and `Warum diese Einheit`.
- Preview lists triggers: new activity, RPE 9, GI issue, mental protect, capability update, missed/replaced workout, stale plan engine version.
- No DB mutation and no Garmin write happens until explicit `Vorschau anwenden`.
- Tests cover read-only preview and apply-only mutation boundary.

**Likely Files**

- `backend/src/pulse/routes/training-routes.ts`
- `backend/src/pulse/services/plan-scenario-preview.ts`
- `backend/src/pulse/services/plan-engine.ts`
- `frontend/src/pages/Plan.tsx`
- `frontend/e2e/pulse-usability.spec.ts`

---

## Phase 2: Plan Apply + Garmin Readback Closure

**Problem:** Applying a plan and trusting it on Garmin are still two mental steps.

**Story:** As Tobi, I want Pulse to show what Garmin will change before apply and then prove that the new workouts are actually present remotely.

**Acceptance Criteria**

- Apply preview shows expected Garmin create/update/delete counts.
- After apply, Plan opens or refreshes `Ausführung` and shows template/calendar/repeat status.
- Broken repeat, missing template and missing calendar states remain repairable by explicit click only.
- Browser QA never triggers real Garmin writes unless the test is explicitly marked as live-write.

**Likely Files**

- `backend/src/pulse/services/garmin-execution-diff.ts`
- `backend/src/pulse/routes/garmin-routes.ts`
- `frontend/src/components/GarminExecutionTrustPanel.tsx`
- `frontend/src/pages/Plan.tsx`

---

## Phase 3: Today Options Signal Labels

**Problem:** Today Options now uses better logic, but the visible card needs faster signal recognition on iPhone.

**Story:** As Tobi, I want each Today Option to show why it is offered in one compact label, so I can decide without reading long evidence.

**Acceptance Criteria**

- Today Options can show labels such as `Produktiv`, `Recovery`, `Fueling schützen`, `Mental schützen`.
- The primary card explains the single strongest reason first.
- Productive free-day endurance options show capability progression in plain language.
- Hard planned workouts with open GI/protect signals do not appear as primary actions.
- Mobile E2E verifies labels and no overflow.

**Likely Files**

- `frontend/src/components/TodayOptionsCard.tsx`
- `frontend/e2e/fixtures/pulse-api.ts`
- `frontend/e2e/pulse-usability.spec.ts`

---

## Phase 4: Fueling Debt Closure

**Problem:** GI discomfort can block hard work, but the UI does not yet explain what resolves the protection.

**Story:** As Tobi, I want Pulse to tell me exactly what to log or observe after a GI issue, so the next hard or long session feels justified again.

**Acceptance Criteria**

- Fueling state distinguishes `open GI issue`, `controlled fueling practice planned`, `tolerated follow-up`, and `resolved`.
- Activity Fueling Log can close the open GI blocker when a controlled follow-up is tolerated.
- Plan/Today Options show the closure condition while the blocker is open.
- Tests cover GI open -> controlled long/easy session -> resolved.

**Likely Files**

- `backend/src/pulse/services/fueling-recovery.ts`
- `backend/src/pulse/services/today-options.ts`
- `backend/src/pulse/services/plan-engine.ts`
- `frontend/src/pages/ActivityDetail.tsx`
- `frontend/src/pages/Data.tsx`

---

## Phase 5: Limiter-To-Workout Mapping

**Problem:** Goals and limiters influence planning, but workout rows do not always make the race/goal purpose obvious.

**Story:** As Tobi, I want every key workout to say which limiter or event demand it serves, so the plan feels intentional instead of generic.

**Acceptance Criteria**

- `Warum diese Einheit` includes a limiter phrase when a goal limiter is active.
- Plan week summary groups workouts by limiter/protected system.
- Data can show whether a limiter has recent supporting evidence or remains stale.
- No proprietary workout catalog is imported.

**Likely Files**

- `backend/src/pulse/services/goal-limiters.ts`
- `backend/src/pulse/services/plan-engine.ts`
- `backend/src/pulse/services/training-capabilities.ts`
- `frontend/src/features/plan/training/training-components.tsx`

---

## Phase 6: No-Garmin-Write Plan QA Harness

**Problem:** Browser QA should verify generation, rationale and Garmin UI without touching real Garmin.

**Story:** As a maintainer, I want a deterministic QA mode that generates preview plans and Garmin diff fixtures without live writes.

**Acceptance Criteria**

- QA can exercise Plan Refresh Preview, Today Options labels and Garmin Execution UI with fixture data.
- Live server smoke remains read-only by default.
- Any real Garmin-write test must be manually invoked and clearly named.

**Likely Files**

- `frontend/e2e/fixtures/pulse-api.ts`
- `frontend/e2e/pulse-usability.spec.ts`
- `docs/qa/route-evidence-pack.md`
- `scripts/`

---

## Order

1. Plan Refresh Preview v1.
2. Plan Apply + Garmin Readback Closure.
3. Today Options Signal Labels.
4. Fueling Debt Closure.
5. Limiter-To-Workout Mapping.
6. No-Garmin-Write Plan QA Harness.

Do not add a new top-level tab for these phases. Use Home for daily command, Plan for preview/apply/execution, Data for evidence and Settings for diagnostics.
