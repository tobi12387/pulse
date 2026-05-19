# Pulse Performance-OS Backlog

Purpose: keep autonomous work pointed at the 2026 Performance Operating System goal without re-deriving the next slice from a long PR history.

Use this file after `docs/ai/current-focus.md` and before opening broad code context. This file is the hard ordering for product work unless Tobi explicitly reverses it.

## Build Rules

- Prefer weekly, package-shaped PRs over isolated micro-slices. A package PR should usually contain 3-5 tightly related changes that share one user-facing outcome and one verification surface.
- A micro-slice is allowed for urgent bugs, regressions, CI/deploy repair, docs-only workflow updates, or when a package would cross unrelated ownership boundaries.
- Every product PR must name one backlog track: `Tagesentscheidung`, `Trainingsanpassung` or `Lernschleifen`.
- Work outside those tracks is deferred unless Tobi explicitly reprioritizes it.
- Keep Home as the daily translator, Plan as the adaptation/execution surface, Data as the evidence workbench and Settings as readiness/diagnostics unless fresh route evidence proves a clearer navigation.
- Do not add hidden Plan, Garmin, Coach, notification or LLM writes. Action contracts must preview what changes after a click.

## Verification Rules

- For `frontend/src/pulse/daily-decision.ts`, add or extend fast unit/golden scenario tests before Playwright. Cover signal priority, CTA label/target, safest option and goal impact.
- Use Playwright for 1-2 package-level UI smokes that prove rendered route behavior, responsive safety or click-path handoff.
- If a package touches several Home decision signals, move toward a data-driven signal registry/priority table instead of adding more one-off branches.
- PR bodies should name the track, package outcome, local checks, CI state and whether deploy is required.

## Automerge Rule

- When local checks are green and CI has no special review risk, prefer GitHub auto-merge instead of blocking the session on active waiting.
- Inspect and fix failed checks.
- Runtime changes still deploy only after the PR is merged to `main`.
- Docs-only and planning-only PRs normally do not require server deploy.

## Current Package Order

The first two passes through all three Performance-OS tracks are shipped: `Tagesentscheidung` delivered Home closure/registry/follow-up work, `Trainingsanpassung` delivered the weekly decision contract, handoffs and local receipts, and `Lernschleifen` delivered Data action contracts, the training-risk contract and learning calibration gates.

Next autonomous product work starts the third pass in the same hard order unless Tobi explicitly reverses it:

1. `Tagesentscheidung`: Home nutzt kalibrierte Data-Lernsignale nur dann als Tages-/Folgeentscheidung, wenn Evidenzgates reichen.
2. `Trainingsanpassung`: Plan nutzt kalibrierte Lernsignale erst in expliziten Wochenentscheidungen, ohne hidden writes.
3. `Lernschleifen`: reopen only for regressions or a new explicit Data package.

## Track 1: Tagesentscheidung

Status: **next active package (third Performance-OS pass)**. PRs #464-#466 delivered completed-day Daily Decision golden coverage, Home-to-Activity closure evidence, Activity Detail language alignment and the first local Daily Decision signal registry. The second pass added a `Folge` signal from Daily Delta plus result previews for Decision Quality and Personal Response, so Home can explain what changed since the last decision without creating a new form or hidden write.

Next package: **Home nutzt kalibrierte Data-Lernsignale.**

Outcome: Home should use the new Data learning calibration only when it is strong enough to change today or the follow-up decision; incomplete fueling or response evidence stays visible as watch context and should not steal the leading factor.

Why it matters: this brings the MacroFactor-like learning gate back into the Oura/WHOOP-style daily command surface without making weak trends feel certain.

Best next package PR:

- Extend Daily Decision golden scenarios for Data learning calibration as `today_action` versus `watch_context`.
- Route strong calibration to the smallest existing Data/Activity confirmation surface.
- Keep incomplete Fueling/Decision Quality evidence as context below stronger Recovery, Mental, Data trust, Garmin and Plan signals.
- Add one rendered Home smoke for the learning handoff.

Package: **Home macht die Folge der letzten Entscheidung sichtbar.**

Outcome: Home should show what Pulse learned from the last planned or off-plan decision, how that changed today's safest option or CTA, and where the smallest confirmation step lives. The surface stays one daily decision, not a new dashboard.

Why it matters: this closes the WHOOP/Oura-style daily command loop with MacroFactor-style "what changed since last check-in" feedback, using existing Activity, Data and Plan evidence.

Shipped package PRs:

- Extend Daily Decision golden scenarios for last-decision outcome, signal priority, CTA target, safest option and goal effect.
- Connect existing Activity feedback, Decision Quality and Personal Response evidence into the Home result preview without adding hidden Plan/Garmin writes.
- Keep closure capture on the existing Activity/Data/Plan surfaces instead of creating a second feedback form.
- Use one rendered Home smoke for the click path; keep the rest in fast contract tests.

Baseline package (shipped): **Home lernt abgeschlossene Tage vollstaendig.**

Outcome: completed days become learning evidence, not loose ends. After planned or off-plan training, Pulse names the smallest closure step, explains why it matters and routes to the exact existing surface that captures the evidence.

Why it matters: this is the WHOOP/Oura daily clarity plus MacroFactor-style learning loop joined to Garmin/device reality and TrainingPeaks-style plan feedback.

Shipped package PRs:

- Add Daily Decision golden scenarios for completed-day feedback, fueling, recovery, goal and Garmin precedence.
- Keep the existing Home-to-Activity click path as one desktop/mobile smoke.
- Make Activity Detail evidence quality mirror Home closure language for RPE, GI comfort, carbs, duration context and measured hydration context.
- Prepare the first local signal registry/priority table when touching more than one signal branch.

Done evidence:

- Fast contract tests prove leading factor, CTA, target path, safest option and result preview for the main completed-day cases.
- One rendered Home smoke proves the user can click to the exact capture surface.
- No Plan/Garmin write happens until an explicit apply/sync action on the destination surface.

## Track 2: Trainingsanpassung

Status: **shipped second-pass baseline**. The shared weekly decision contract now appears in Plan Review and Change Inbox, exposes preview-only `Beibehalten`, `Anpassen` and `Spaeter` controls, ties goal/recovery/Garmin debt into one decision language, receives Home/Data Plan-/Load handoffs at `#plan-weekly-decision`, and can store a local decision receipt without Plan/Garmin writes.

Package: **Plan macht Wochenentscheidungen bestaetigbar.**

Outcome: after previewing `Beibehalten`, `Anpassen` or `Spaeter`, Plan should leave an explicit decision receipt that Tobi can revisit from Plan and incoming Home/Data handoffs. The receipt explains intent and next consequence; actual plan/Garmin writes still require explicit existing apply/sync actions.

Why it matters: this turns the TrainerRoad/TrainingPeaks/JOIN weekly control loop from preview-only into a traceable decision ritual without making the first click destructive.

Shipped package PRs:

- Add a read-only decision receipt state for the weekly decision contract.
- Route Plan Review, Change Inbox and Home/Data handoffs to the same receipt or open decision state.
- Show what remains pending before Garmin/calendar execution.
- Add fast tests proving receipts do not mutate plan or Garmin before explicit apply/sync.

Baseline package (shipped): **Plan macht Wochenentscheidung aktiver.**

Outcome: Plan feels like a weekly command surface, not a list plus diagnostics. It tells Tobi what changed, what decision is open, and what accepting/changing/deferring does to the week.

Why it matters: this is the TrainerRoad/TrainingPeaks/JOIN/Runna layer. Pulse already has many deterministic signals; the next gain is making the weekly control loop obvious and trustworthy.

Best next package PR:

- Make Plan Review and Change Inbox share one current weekly decision contract: learned, changed, risk, next explicit action.
- Add a read-only week impact preview for accepting, adapting or intentionally deferring a plan change.
- Tie Goal Projection, Recovery pressure and Garmin execution debt into the same weekly decision language without automatic Garmin writes.
- Add fast tests proving accept/change/defer previews do not mutate plan or Garmin before explicit apply.

Done evidence:

- Plan first viewport exposes one current weekly job and one primary next action.
- Tests prove preview-only behavior before explicit apply.
- Home and Data deep links land on the same weekly decision evidence without duplicate copy.

## Track 3: Lernschleifen

Status: **shipped second-pass baseline**. PRs #471 and #473 delivered Data action-effect contracts, Fueling learning-loop copy, Home watch-context gating and a compact Data training-risk contract. The second pass adds Data learning calibration across Decision Quality, Personal Response and Fueling trends with shared Fueling trend gates.

Package: **Data kalibriert Decision Quality und Fueling-Trends nach Evidenzgates.**

Outcome: Data should explain when repeated decisions or fueling logs are strong enough to change the next recommendation, and when they are still only watch context. Nutrition trend summaries stay gated until comparable complete evidence exists.

Why it matters: this is the MacroFactor/Intervals/WKO layer: Pulse should learn visibly from repeated outcomes without turning weak evidence into confident coaching.

Shipped package PRs:

- Gate trend summaries behind comparable complete logs and explicit quality thresholds.
- Connect Decision Quality, Personal Response and Fueling evidence into one "what changed / not enough evidence yet" learning note.
- Keep action contracts explicit: `today_action`, `plan_decision` or `watch_context`.
- Add fast tests for threshold boundaries and one Data smoke for the rendered learning handoff.

Baseline package (shipped): **Data erklaert Trainingsrisiko und Analyse naechste Handlung besser.**

Outcome: deep evidence ends in a concrete next action only when it is actionable. Data > Analyse explains whether the evidence changes today's action, changes a plan decision, or stays as watch context.

Why it matters: this is Intervals.icu/WKO depth translated into Oura/WHOOP-style daily clarity and MacroFactor-like coaching updates. It prevents more analytics from becoming more interpretation work.

Shipped package PRs:

- Standardize Data > Analyse action contracts across Personal Response, Durability, Power quality, Goal Projection, Decision Quality and Fueling evidence.
- Add fast tests for mapping analysis signal type to CTA label, target path and result preview.
- Only escalate analysis evidence into Home when it beats current-day Recovery, Mental, Data trust, Fueling or Garmin execution needs.
- Add a compact `Trainingsrisiko` contract that routes Plan/load risk to the weekly decision, blocked Power quality to Data evidence and stable states to Watch-Kontext.
- Keep nutrition trend summaries gated until comparable complete evidence exists.

Done evidence:

- Data analysis tests prove each actionable signal has a target and correct result preview.
- Home tests prove non-actionable watch evidence does not steal the leading factor.
- Route evidence shows Data remains an evidence workbench, not a second Home dashboard.

## Supporting Build-Speed Work

These improvements are mandatory support for the three tracks, not a fourth product track:

- Keep `docs/ai/current-focus.md` below roughly 80 short lines and link detailed status to this file, the canonical roadmap and decisions.
- Extract Daily Decision contract fixtures from Playwright into fast unit/golden tests.
- Introduce data-driven signal registry/priority tables when package work touches multiple signal contracts.
- Prefer package PRs with 3-5 related changes over repeated one-signal PRs when the evidence surface is shared.

## Evidence Gates

- Nutrition trend summaries stay gated until at least three comparable complete `during` logs exist with carbs, duration/activity context and GI comfort.
- Sodium, heat and sweat-rate claims remain explicit evidence gaps until measured.
- Real Garmin calendar/workout writes are only run for explicit sync repair/testing.
- Push activation and iPhone certificate trust remain manual per browser/device.
- Native iOS remains a future decision only after repeated real iPhone/PWA friction is recorded.
