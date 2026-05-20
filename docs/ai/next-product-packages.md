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
- Use `npm run verify:<track>:fast` for the first implementation loop, `npm run verify:<track>:pr` before Fast Lane PRs, and the full `npm run verify:<track>` gate for Full Lane, high-risk UI changes or slices where local rendered proof is the point.
- Use Playwright for 1-2 package-level UI smokes that prove rendered route behavior, responsive safety or click-path handoff; for normal Fast Lane PRs this rendered proof may be left to CI `browser-tests` after the local `:pr` gate is green.
- If a package touches several Home decision signals, move toward a data-driven signal registry/priority table instead of adding more one-off branches.
- PR bodies should name the track, package outcome, local checks, CI state and whether deploy is required.

## Automerge Rule

- When manifest-selected local `:pr` checks are green and CI has no special review risk, prefer GitHub auto-merge instead of blocking the session on active waiting.
- Inspect and fix failed checks.
- Runtime changes still deploy only after the PR is merged to `main`.
- Docs-only and planning-only PRs normally do not require server deploy.

## Current Package Order

The first two passes through all three Performance-OS tracks are shipped: `Tagesentscheidung` delivered Home closure/registry/follow-up work, `Trainingsanpassung` delivered the weekly decision contract, handoffs and local receipts, and `Lernschleifen` delivered Data action contracts, the training-risk contract and learning calibration gates. Track 1 and Track 2 also have third-pass learning-calibration packages, Track 1 has the fourth-pass `Tageskonflikt` signal, the fifth-pass completed-day closure learning, the sixth-pass today-only tradeoff learning, the seventh-pass resolved tradeoff quietness and the eighth-pass fresh Home reopen explanation, Track 2 carries repeated Tageskonflikte into the weekly decision receipt, gates classified tradeoff patterns to true weekly decisions and keeps handled receipts quiet until fresh weekly evidence appears, and Track 3 classifies tradeoff evidence as action, plan decision, resolved quiet context or evidence gap, keeps resolved evidence quiet and names source-specific fresh reopen evidence.

Keep the next three package cards ready so Time-to-Market is not spent re-planning. Unless Tobi explicitly reprioritizes or a regression appears, take the first unshipped package in this order:

1. `Trainingsanpassung`: **Plan erklaert frische Tradeoff-Reopens nach Evidenzquelle.**
2. `Lernschleifen`: **Data buendelt wiederkehrende Reopen-Quellen zu Lerntrends.**
3. `Tagesentscheidung`: **Home zeigt Reopen-Quellen als Tageskontext statt alte Konflikte neu zu starten.**

## Track 1: Tagesentscheidung

Status: **shipped eighth-pass package plus later ready card**. PRs #464-#466 delivered completed-day Daily Decision golden coverage, Home-to-Activity closure evidence, Activity Detail language alignment and the first local Daily Decision signal registry. The second pass added a `Folge` signal from Daily Delta plus result previews for Decision Quality and Personal Response, so Home can explain what changed since the last decision without creating a new form or hidden write. The third pass lets Home use the shared Data learning calibration only when gates make it a true `today_action`; weak fueling or response evidence stays visible as watch context. The fourth pass makes Home name the single body/goal/everyday tradeoff before the safest action. The fifth pass makes completed Tageskonflikt days learnable through existing Activity feedback. The sixth pass lets Home use repeated tradeoff learning only when it changes today's adaptive option. The seventh pass keeps resolved tradeoff learning out of the daily lead and shows it only as quiet continuity/evidence unless fresh evidence changes today. The eighth pass makes fresh Home-impact reopens lead with only the new Heute evidence while old handled history stays context.

Later ready package: **Home zeigt Reopen-Quellen als Tageskontext statt alte Konflikte neu zu starten.**

Outcome: after Data groups repeated reopen sources, Home should say whether today's fresh reason is isolated or part of a repeated source trend while keeping the CTA focused on the current adaptive action.

Why it matters: once reopen sources become trends, Home should not sound like a new old conflict every time. It should preserve daily clarity while hinting whether Recovery, Alltag or Planlast is becoming the learning pattern.

Package PRs:

- Add Daily Decision golden scenarios for isolated fresh reopen source versus repeated reopen-source trend.
- Keep the leading factor focused on today's adaptive option and one concise trend hint.
- Keep detailed trend/source evidence in continuity/evidence or Data handoff, without turning Home into a trend report.
- Use the Fast Lane `verify:tagesentscheidung:pr` gate plus one CI/Home smoke unless local rendered behavior is changed.

Shipped package: **Home erklaert frische Tradeoff-Reopens ohne alte Muster zu wiederholen.**

Outcome: after Data/Plan can name reopen reasons, Home leads only with the fresh reason that changes today and keeps older resolved history as short continuity/evidence, not as repeated explanation.

Why it matters: fresh evidence should feel like a new daily decision, not like Pulse forgot an old one. Home needs the calm "what changed today" layer after Data explains the evidence.

Package PRs:

- Add Daily Decision golden scenarios for fresh Home-impact reopen reasons versus old resolved history.
- Keep the leading factor focused on the new evidence source and today's adaptive option.
- Keep old resolved evidence in continuity/evidence only, without repeating the full historical pattern.
- Use the Fast Lane `verify:tagesentscheidung:pr` gate plus one CI/Home smoke unless local rendered behavior is changed.

Shipped package: **Home haelt geloeste Tradeoff-Lernmuster aus der Tagesfuehrung raus.**

Outcome: after Plan/Data mark tradeoff patterns as resolved or already handled, Home keeps them as quiet continuity or evidence instead of reopening the daily lead unless fresh evidence changes today's safest action.

Why it matters: a private Performance OS should get calmer after it learns. Resolved tradeoffs make Home more confident, not make the same old pattern compete with today's body, Garmin, Plan or training signal.

Package PRs:

- Add Daily Decision golden scenarios for resolved versus fresh tradeoff learning evidence.
- Keep resolved patterns out of the leading factor and primary CTA.
- Show resolved patterns only as continuity/evidence when they explain why today's answer stayed quiet.
- Use the Fast Lane `verify:tagesentscheidung:pr` gate plus one CI/Home smoke unless local rendered behavior is changed.

Shipped package: **Home nutzt wiederholte Tradeoff-Lernmuster nur bei echter Tageswirkung.**

Outcome: after Plan/Data classify repeated tradeoff evidence, Home should surface the pattern only when it changes today’s safest action or follow-up; otherwise it stays quiet context so the daily answer does not repeat old explanations.

Why it matters: repeated daily conflict is useful only when it changes what Tobi does today. Home should stay calm and avoid turning every historical tradeoff into a new leading factor.

Package PRs:

- Add Daily Decision golden scenarios for repeated tradeoff learning as `today_action` versus watch context.
- Keep weak or already-handled tradeoff patterns below Recovery, Garmin, Plan and current-day Training signals.
- Route strong repeated patterns to the smallest existing Plan/Data decision target without hidden writes.
- Use the Fast Lane `verify:tagesentscheidung:pr` gate plus one CI/Home smoke unless local rendered behavior is changed.

Shipped package: **Home macht Tageskonflikt-Abschluss lernbar.**

Outcome: after a body/goal/everyday tradeoff day is completed, Home should say what Pulse learned from the chosen or changed option, route to the existing smallest closure surface, and update the next safest option/result preview without a new form or hidden Plan/Garmin write.

Why it matters: the new `Tageskonflikt` signal is only fast in practice if the next day can close the loop. This turns a hard daily tradeoff into reusable learning evidence instead of another one-off explanation.

Package PRs:

- Add Daily Decision golden scenarios for completed tradeoff outcome, changed option and missed closure.
- Reuse the signal registry/result-preview path so tradeoff learning does not become a separate Home branch.
- Route closure to existing Activity/Data/Plan surfaces with explicit no-hidden-write copy.
- Use the Fast Lane `verify:tagesentscheidung:pr` gate plus one CI/Home smoke unless local rendered behavior is changed.

Shipped package: **Home erklaert Koerper, Ziel und Alltag als einen Tageskonflikt.**

Outcome: when the planned workout, body state, goal pressure and everyday option disagree, Home should lead with one `Tageskonflikt` signal, route to the lighter explicit Plan option and keep Plan/Garmin unchanged until the conscious click.

Why it matters: this is the central Performance-OS promise in daily language: the intelligent action is not just what the plan wants, what the body tolerates or what the calendar allows, but the calm tradeoff between all three.

Package PRs:

- Add a Daily Decision golden scenario for body + at-risk goal + everyday alternative.
- Keep the signal in the registry/priority table instead of a loose branch.
- Route the CTA to the existing lighter day option with a no-hidden-write result preview.
- Add one rendered Home smoke for the tradeoff and click path.

Shipped package: **Home nutzt kalibrierte Data-Lernsignale.**

Outcome: Home should use the new Data learning calibration only when it is strong enough to change today or the follow-up decision; incomplete fueling or response evidence stays visible as watch context and should not steal the leading factor.

Why it matters: this brings the MacroFactor-like learning gate back into the Oura/WHOOP-style daily command surface without making weak trends feel certain.

Shipped package PRs:

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

Status: **shipped sixth-pass package plus later ready card**. The shared weekly decision contract now appears in Plan Review and Change Inbox, exposes preview-only `Beibehalten`, `Anpassen` and `Spaeter` controls, ties goal/recovery/Garmin debt into one decision language, receives Home/Data Plan-/Load handoffs at `#plan-weekly-decision`, can store a local decision receipt without Plan/Garmin writes, uses gated learning calibration as explicit weekly decision evidence, carries repeated Tageskonflikte into the weekly decision receipt, consumes the shared tradeoff classifier only for true weekly decisions and keeps handled tradeoff receipts quiet until fresh weekly evidence appears.

Later ready package: **Plan erklaert frische Tradeoff-Reopens nach Evidenzquelle.**

Outcome: after Data/Home can name why a resolved tradeoff reopened, Plan should explain whether the fresh weekly evidence comes from plan load, recovery, Garmin execution or goal pressure, and map `Anpassen` to the smallest preview-only weekly action.

Why it matters: once handled receipts can reopen, the weekly command surface should not say only "old Tageskonflikt again". It should say what changed in the week and which explicit Plan/Garmin-safe decision is now worth previewing.

Package PRs:

- Add Plan weekly decision scenarios for source-specific fresh reopen evidence after a handled receipt.
- Keep the older handled receipt visible as continuity while the leading weekly copy names the new evidence source.
- Make `Anpassen` preview copy point to the smallest existing scenario or refresh target without hidden Plan/Garmin writes.
- Use the Fast Lane `verify:trainingsanpassung:pr` gate plus one CI/Plan smoke unless local rendered behavior is changed.

Shipped package: **Plan haelt erledigte Tradeoff-Receipts ruhig, bis neue Wochenwirkung entsteht.**

Outcome: after Data/Home mark a tradeoff as handled or resolved, Plan should keep the local receipt as quiet continuity and reopen `Anpassen` only when fresh weekly evidence appears.

Why it matters: the weekly command loop should become calmer after a conscious decision. A handled conflict should explain why Plan stayed stable, not behave like a new plan problem on every visit.

Package PRs:

- Add Plan weekly decision scenarios for handled receipt versus stale-with-new-weekly-evidence.
- Keep handled receipts visible as continuity without changing the primary option from `Beibehalten`.
- Reopen `Anpassen` only when new plan, recovery, Garmin or classified `plan_decision` evidence arrives.
- Use the Fast Lane `verify:trainingsanpassung:pr` gate plus one CI/Plan smoke unless local rendered behavior is changed.

Shipped package: **Plan nutzt klassifizierte Tradeoff-Muster nur bei echter Wochenwirkung.**

Outcome: after Data classifies tradeoff patterns as `plan_decision` versus watch context, Plan should consume only the weekly-relevant classification and avoid reopening the weekly decision for already-handled or weak tradeoff history.

Why it matters: Plan should become faster and quieter as Data gets better at classification. Repeated conflict should influence the week only when it changes the weekly choice, not because old evidence was phrased loudly.

Package PRs:

- Add Plan weekly decision scenarios for Data-classified tradeoff `plan_decision` versus watch context.
- Keep already-handled patterns attached to the receipt without reopening `Anpassen`.
- Route weekly-relevant patterns to the same preview-only options and no-hidden-write receipt.
- Use the Fast Lane `verify:trainingsanpassung:pr` gate plus one CI/Plan smoke unless local rendered behavior is changed.

Shipped package: **Plan uebernimmt wiederholte Tageskonflikte in die Wochenentscheidung.**

Outcome: when several daily tradeoffs point in the same direction, Plan should surface them as explicit weekly decision evidence, show whether `Beibehalten`, `Anpassen` or `Spaeter` is safest, and keep the receipt preview-only until the existing apply/sync actions are used.

Why it matters: the weekly loop should not ignore the daily Performance-OS learning. Repeated body/goal/everyday conflicts are the exact signal that the plan may need a conscious weekly adjustment.

Package PRs:

- Add Plan weekly decision contract scenarios for repeated tradeoff evidence versus isolated one-day conflict.
- Surface tradeoff evidence in Plan Review and Change Inbox without mutating Plan or Garmin.
- Attach the evidence to local weekly receipts so Home/Data handoffs reopen the same decision.
- Use the Fast Lane `verify:trainingsanpassung:pr` gate plus one CI/Plan smoke unless local rendered behavior is changed.

Shipped package: **Plan nutzt kalibrierte Lernsignale explizit.**

Outcome: Plan should let strong Home/Data learning calibration inform the weekly decision language, while weak Decision Quality, response or fueling evidence remains watch context and never mutates Plan or Garmin before an explicit weekly decision.

Why it matters: this carries the MacroFactor-style learning gate into the TrainerRoad/TrainingPeaks/JOIN weekly control loop without making learning evidence a hidden plan write.

Shipped package PRs:

- Add Plan weekly decision scenarios for `today_action` learning calibration versus watch-only learning evidence.
- Surface strong calibration as decision evidence in Plan Review and Change Inbox without changing the current week automatically.
- Keep weak fueling/response evidence as watch context attached to the decision receipt or open decision state.
- Add fast tests proving no Plan/Garmin writes happen before explicit weekly controls.

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

Status: **shipped fifth-pass package plus later ready card**. PRs #471 and #473 delivered Data action-effect contracts, Fueling learning-loop copy, Home watch-context gating and a compact Data training-risk contract. The second pass adds Data learning calibration across Decision Quality, Personal Response and Fueling trends with shared Fueling trend gates. The third pass classifies repeated body/goal/everyday tradeoff evidence as `today_action`, `plan_decision` or `watch_context`, the fourth pass keeps resolved tradeoff patterns quiet until fresh evidence appears, and the fifth pass explains source-specific fresh reopen evidence while older handled evidence stays context.

Later ready package: **Data buendelt wiederkehrende Reopen-Quellen zu Lerntrends.**

Outcome: after Home and Plan consume fresh reopen reasons, Data should show whether reopen sources are isolated or becoming a trend across Recovery, Alltag, Planlast, Garmin execution or goal pressure.

Why it matters: source-specific reopen copy is useful for one card; trend-level grouping is what turns repeated reopen causes into a durable learning loop instead of another per-day explanation.

Package PRs:

- Add fast Data action-contract scenarios for repeated reopen source groups versus one-off fresh evidence.
- Keep one-off fresh evidence as direct Home/Plan action copy, but summarize repeated source groups as learning trends.
- Preserve old handled evidence as context and avoid routing trend summaries unless the current fresh source still changes Home or Plan.
- Use the Fast Lane `verify:lernschleifen:pr` gate plus one CI/Data smoke unless local rendered behavior is changed.

Shipped package: **Data erklaert Reopen-Gruende fuer geloeste Tradeoffs nur bei frischer Evidenz.**

Outcome: after resolved tradeoff patterns stay quiet by default, Data should explain precisely why a pattern reopened: which fresh evidence appeared, whether it changes Home or Plan, and why older resolved history remains only context.

Why it matters: quiet learning is only trustworthy if reopen moments are legible. When a handled conflict becomes active again, Data should make the new evidence obvious instead of making it feel like Pulse forgot the prior decision.

Package PRs:

- Add fast Data action-contract scenarios for resolved history, fresh Home-impact evidence and fresh Plan-impact evidence.
- Make reopened cards name the fresh evidence source and keep older handled evidence as context.
- Keep resolved patterns quiet when freshness is missing or only copied from suggested copy.
- Use the Fast Lane `verify:lernschleifen:pr` gate plus one CI/Data smoke unless local rendered behavior is changed.

Shipped package: **Data haelt geloeste Tradeoff-Muster ruhig und zeigt nur neue Evidenz.**

Outcome: after Home and Plan consume classified tradeoff signals, Data marks patterns as active, resolved or still-evidence-gap and avoids re-routing already-handled history unless fresh evidence changes the next action.

Why it matters: the learning loop should become quieter as it learns. A repeated conflict that was already handled stays useful evidence instead of reopening Home or the weekly decision on every analysis visit.

Package PRs:

- Add fast Data action-contract scenarios for active, resolved and stale-with-new-evidence tradeoff patterns.
- Keep resolved patterns as watch/quiet context with clear evidence notes.
- Route only fresh strong evidence to Home or the weekly Plan decision.
- Use the Fast Lane `verify:lernschleifen:pr` gate plus one CI/Data smoke unless local rendered behavior is changed.

Shipped package: **Data erklaert Tradeoff-Muster als Handlung, Planentscheidung oder Watch-Kontext.**

Outcome: Data should classify body/goal/everyday tradeoff evidence as a `today_action`, `plan_decision` or `watch_context`, explain what is still missing, and route only strong repeated evidence toward Home or the weekly Plan decision.

Why it matters: this keeps the MacroFactor/Intervals-style learning layer honest. One hard day is context; repeated tradeoff outcomes can change the next recommendation or the weekly plan.

Package PRs:

- Add fast Data action-contract scenarios for isolated versus repeated tradeoff evidence.
- Keep weak or incomplete tradeoff evidence visible as watch context.
- Route strong repeated tradeoffs to the smallest existing Home/Plan decision target.
- Use the Fast Lane `verify:lernschleifen:pr` gate plus one CI/Data smoke unless local rendered behavior is changed.

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

- Shipped support package: **Delivery manifest + gate mapping.** `npm run delivery:manifest` prints a compact PR/package manifest and changed-files-to-track-gate map so Codex can choose local checks, expected CI jobs, auto-merge eligibility and deploy requirement without rediscovering scope each session.
- Delivery-speed support now uses `Fast Lane` versus `Full Lane`: one-track frontend/docs/support changes without backend, shared-contract, dependency, migration, workflow, deploy or LLM risk can auto-merge after listed local checks and green CI; Full Lane PRs keep explicit CI/review attention.
- Start known packages with `npm run delivery:intake -- --track <track> --outcome "..."` so the package outcome, fast development gate, PR gate and evidence rules are fixed before broad exploration.
- Use the contract-only gates while implementing: `npm run verify:tagesentscheidung:fast`, `npm run verify:trainingsanpassung:fast` and `npm run verify:lernschleifen:fast`; run the manifest-selected `verify:<track>:pr` gate before Fast Lane PRs and the full `verify:<track>` gate for Full Lane or high-risk local UI proof.
- Covered track contract-test files do not add the full `npm run test:scripts` suite to Fast Lane manifests; uncovered script/tooling changes still do.
- Script-only support changes run through the CI `build` job and script guards, not the heavier backend service test job.
- Keep `docs/ai/current-focus.md` below roughly 80 short lines and link detailed status to this file, the canonical roadmap and decisions.
- Use the track-specific gates instead of re-deriving local checks per PR: `npm run verify:tagesentscheidung:pr`, `npm run verify:trainingsanpassung:pr` and `npm run verify:lernschleifen:pr` for Fast Lane; full track gates for Full Lane.
- Extract Daily Decision contract fixtures from Playwright into fast unit/golden tests.
- Introduce data-driven signal registry/priority tables when package work touches multiple signal contracts.
- Prefer package PRs with 3-5 related changes over repeated one-signal PRs when the evidence surface is shared.

## Evidence Gates

- Nutrition trend summaries stay gated until at least three comparable complete `during` logs exist with carbs, duration/activity context and GI comfort.
- Sodium, heat and sweat-rate claims remain explicit evidence gaps until measured.
- Real Garmin calendar/workout writes are only run for explicit sync repair/testing.
- Push activation and iPhone certificate trust remain manual per browser/device.
- Native iOS remains a future decision only after repeated real iPhone/PWA friction is recorded.
