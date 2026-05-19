# Pulse Next Product Packages

Purpose: keep autonomous work pointed at the 2026 Performance Operating System goal without re-deriving the next slice from a long PR history.

Use this file after `docs/ai/current-focus.md` and before opening broad code context. Keep package work in PR-sized slices, but pick slices from these packages instead of polishing isolated signals by default.

## Selection Rules

- Prefer a package slice when it improves the answer to: `Was ist heute die intelligenteste Handlung fuer meinen Koerper, mein Ziel und meinen Alltag?`
- Do not add hidden Plan, Garmin, Coach, notification or LLM writes. Action contracts must preview what changes after a click.
- Keep Home as the daily translator, Plan as the adaptation/execution surface, Data as the evidence workbench and Settings as readiness/diagnostics unless fresh route evidence proves a clearer navigation.
- Use fast contract tests for decision logic first; reserve Playwright for route, responsive and click-path proof.
- Record real-world gates separately from buildable work. iPhone/PWA reliability, Push activation, real Garmin writes and Nutrition trend summaries still need their own evidence gates.

## Package 1: Daily Closure And Learning Loop

Outcome: completed days become learning evidence, not loose ends. After planned or off-plan training, Pulse should name the smallest closure step, explain why it matters and route to the exact existing surface that captures the evidence.

Why it matters: this is the MacroFactor-style learning loop joined to Garmin/device reality and TrainingPeaks-style plan feedback. It turns actual execution into better next-day judgment.

Best next slices:

- Add fast golden tests for `deriveDailyDecision` covering completed-day feedback, fueling, recovery, goal and Garmin precedence.
- Make Plan Review name what yesterday's completed workout changed for the next plan decision when feedback/fueling evidence is present.
- Keep Activity Detail evidence quality aligned with Home closure steps, especially RPE, GI comfort, carbs, duration context and measured hydration context.

Done evidence:

- Contract tests prove signal priority, CTA target, safest option and result preview for the main completed-day cases.
- One desktop/mobile Playwright path proves the user can click from Home to the exact capture surface.
- No Plan/Garmin write happens until an explicit apply/sync action on the destination surface.

## Package 2: Adaptive Week Control Loop

Outcome: Plan should feel like a weekly command surface, not a list plus diagnostics. It should tell Tobi what changed, what decision is open, and what accepting/changing/deferring does to the week.

Why it matters: this is the TrainerRoad/TrainingPeaks/JOIN/Runna layer. Pulse already has many deterministic signals; the next gain is making the weekly control loop feel obvious and trustworthy.

Best next slices:

- Make Plan Review and Change Inbox share one current weekly decision contract: learned, changed, risk, next explicit action.
- Add a read-only week impact preview for accepting, adapting or intentionally deferring a plan change.
- Tie Goal Projection, Recovery pressure and Garmin execution debt into the same weekly decision language without automatic Garmin writes.

Done evidence:

- Plan first viewport exposes one current weekly job and one primary next action.
- Tests prove accept/change/defer previews do not mutate plan or Garmin before explicit apply.
- Home and Data deep links land on the same weekly decision evidence without duplicate copy.

## Package 3: Analysis-To-Action Bridge

Outcome: deep evidence should end in a concrete next action only when it is actionable. Data > Analyse should explain whether the evidence changes today's action, changes a plan decision, or stays as watch context.

Why it matters: this is the Intervals.icu/WKO depth translated into Oura/WHOOP-style daily clarity. It prevents more analytics from becoming more interpretation work.

Best next slices:

- Standardize Data > Analyse action contracts across Personal Response, Durability, Power quality, Goal Projection, Decision Quality and Fueling evidence.
- Add fast tests for the mapping from analysis signal type to CTA label, target path and result preview.
- Only escalate analysis evidence into Home when it beats current-day Recovery, Mental, Data trust, Fueling or Garmin execution needs.

Done evidence:

- Data analysis tests prove each actionable signal has a target and a correct result preview.
- Home tests prove non-actionable watch evidence does not steal the leading factor.
- Route evidence shows Data remains an evidence workbench, not a second Home dashboard.

## Package 4: Build-Speed Foundations

Outcome: agents spend less time rediscovering state and less time paying full E2E cost for pure contract logic.

Why it matters: the current build rate is high but expensive. The app will move faster when context is short, package order is explicit and decision contracts have fast proof.

Best next slices:

- Keep `docs/ai/current-focus.md` below roughly 80 short lines and link detailed status to this file, the canonical roadmap and decisions.
- Extract Daily Decision contract fixtures from Playwright into fast unit/golden tests.
- Prefer package PRs with 2-4 tightly related contract changes when they share the same evidence and verification surface.

Done evidence:

- New sessions can identify the next package without reading a long PR archive.
- A focused decision-contract test runs without starting Vite.
- PR bodies name the package, slice, and verification evidence.

## Evidence Gates

- Nutrition trend summaries stay gated until at least three comparable complete `during` logs exist with carbs, duration/activity context and GI comfort.
- Sodium, heat and sweat-rate claims remain explicit evidence gaps until measured.
- Real Garmin calendar/workout writes are only run for explicit sync repair/testing.
- Push activation and iPhone certificate trust remain manual per browser/device.
- Native iOS remains a future decision only after repeated real iPhone/PWA friction is recorded.
