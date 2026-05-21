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

The first two passes through all three Performance-OS tracks are shipped: `Tagesentscheidung` delivered Home closure/registry/follow-up work, `Trainingsanpassung` delivered the weekly decision contract, handoffs and local receipts, and `Lernschleifen` delivered Data action contracts, the training-risk contract and learning calibration gates. Track 1 and Track 2 also have third-pass learning-calibration packages, Track 1 has the fourth-pass `Tageskonflikt` signal, the fifth-pass completed-day closure learning, the sixth-pass today-only tradeoff learning, the seventh-pass resolved tradeoff quietness, the eighth-pass fresh Home reopen explanation, the ninth-pass reopen-source trend context, the tenth-pass closed source-trend continuity, the eleventh-pass weekly receipt learning confidence, the twelfth-pass calibrated receipt-confidence continuity, the thirteenth-pass weekly receipt trust duration, the fourteenth-pass weekly receipt renewal checks, the fifteenth-pass quiet goal-progress motivation and the sixteenth-pass compact quiet goal-continuity evidence, Track 2 carries repeated Tageskonflikte into the weekly decision receipt, gates classified tradeoff patterns to true weekly decisions, keeps handled receipts quiet until fresh weekly evidence appears, names source-specific fresh Plan reopens, uses repeated reopen-source trends as weekly decision context, keeps closed source trends as quiet weekly receipts, shows weekly receipt learning confidence as stable Plan confidence, calibrates that confidence after follow-up evidence, shows weekly receipt trust duration, keeps weekly receipt renewal checks as quiet Plan confidence and keeps stable/watch goal progress as quiet weekly confidence, and Track 3 classifies tradeoff evidence as action, plan decision, resolved quiet context or evidence gap, keeps resolved evidence quiet, names source-specific fresh reopen evidence, groups repeated reopen sources into learning trends, closes handled source trends after weekly decisions, shows weekly receipt source trends as learning confidence, calibrates that confidence after follow-up evidence, shows weekly receipt trust duration, names the next receipt renewal check and makes goal progress motivating Data evidence.

Keep the next package cards ready so Time-to-Market is not spent re-planning. Unless Tobi explicitly reprioritizes or a regression appears, take the first unshipped package in this order:

### Replenishment Audit — 2026-05-21

The canonical roadmap was rechecked against current docs and evidence after PR #551; see `docs/qa/2026-05-21-performance-os-backlog-replenishment-audit.md`. The old short-term roadmap rows for UX Task Contract foundation and Today/Home simplification are shipped foundations, not new package cards: Home/Heute, Data, Plan, Settings and the main action-contract slices already carry the one-action/why/result grammar.

The remaining named roadmap implementation themes are still gates, not unblocked backlog:

- **Nutrition trend summaries:** still require three comparable complete `during` logs with activity/duration context, carbs and GI comfort.
- **iPhone/PWA field reliability:** still requires real-device iPhone/VPN/PWA evidence; simulated WebKit and Chromium evidence do not replace the manual field gate.

Until one of those gates opens, a new route/user-friction report appears, or Tobi explicitly reprioritizes, autonomous work should stay limited to evidence capture, docs/tooling support, CI/deploy repair, or a fresh route-evidence pass that proves a concrete regression.

No ungated product package is currently queued after the Home quiet-continuity follow-up. Do not start product coding from stale history; first replenish this backlog from the roadmap, fresh route evidence or Tobi's explicit direction. The roadmap's remaining named implementation themes are gated: Nutrition trend summaries need enough comparable complete logs, and iPhone/PWA field reliability needs real-device evidence. Refresh all current blockers with `npm run audit:performance-gates -- --today <YYYY-MM-DD>`; the combined audit promotes the first open `Next unblock` before the per-gate details, and JSON includes structured `nextUnblock.metadata` for paths/options/Fueling candidate context/evidence checklists/runbooks. Use `npm run audit:performance-next -- --today <YYYY-MM-DD>` for a concise first-action handoff and `--fail-on-gated` only for automation that should fail on any open gate. For focused follow-up, use `npm run audit:fueling-gate -- --today <YYYY-MM-DD>` and `npm run audit:iphone-pwa-gate`. A 2026-05-21 local nutrition DB audit found 4 during logs and 0/3 comparable complete Fueling logs; two existing long carb logs need structured GI comfort before they can count, and one new complete long-session log is still needed after that.

2026-05-21 route evidence first captured 9 desktop and 15 mobile screenshots and found narrow first-viewport friction, but no new package-sized backlog: the Plan mobile scenario preview label now says `Nur Vorschau`, Home learning calibration no longer steals completed-day review or leaves calibration CTAs with generic fallback detail, Home translates primary learning-calibration actions as `Lernschleife`/`Muster pruefen` instead of analysis jargon, and Activity Fueling deep links now focus the GI comfort action group when that is the missing evidence. Latest current-main evidence at `93e6036` extends the `ae3285d` route pass: 9 desktop and 17 mobile screenshots still had 0 horizontal overflow, the Activity Fueling closure path now uses sport-neutral `langen During-Log` copy for long endurance logs instead of run-specific wording, and the refreshed audit keeps Fueling, iPhone/PWA field evidence and SSH deploy-auth gated. Simulated iPhone WebKit evidence at `9b6c7d7` fixed a concrete Home stage-strip `JETZT` clipping issue and passed the bounded WebKit PWA gate, but it does not replace real-device iPhone/VPN/PWA field evidence. No additional daily-flow or Fueling UI/UX slice is currently justified. See `docs/qa/2026-05-21-performance-os-next-evidence.md`, `docs/qa/2026-05-21-plan-preview-label-evidence.md`, `docs/qa/2026-05-21-home-calibration-review-clarity.md`, `docs/qa/2026-05-21-post-fueling-route-evidence.md`, `docs/qa/2026-05-21-current-main-route-evidence.md`, `docs/qa/2026-05-21-current-main-route-evidence-20caf40.md`, `docs/qa/2026-05-21-current-main-evidence-0d8cd63.md`, `docs/qa/2026-05-21-current-main-evidence-ae3285d.md`, `docs/qa/2026-05-21-iphone-webkit-stage-strip.md`, `docs/qa/2026-05-21-activity-fueling-action-focus.md`, `docs/qa/2026-05-21-home-learning-language.md`, `docs/qa/2026-05-21-fueling-long-session-copy.md`, `docs/qa/2026-05-21-fueling-evidence-checklist.md`, `docs/qa/2026-05-21-iphone-field-checklist-audit.md` and `docs/qa/2026-05-21-server-runbook-gate-render.md` before proposing new UI/UX work from current route state.

## Track 1: Tagesentscheidung

Status: **shipped sixteenth-pass package**. PRs #464-#466 delivered completed-day Daily Decision golden coverage, Home-to-Activity closure evidence, Activity Detail language alignment and the first local Daily Decision signal registry. The second pass added a `Folge` signal from Daily Delta plus result previews for Decision Quality and Personal Response, so Home can explain what changed since the last decision without creating a new form or hidden write. The third pass lets Home use the shared Data learning calibration only when gates make it a true `today_action`; weak fueling or response evidence stays visible as watch context. The fourth pass makes Home name the single body/goal/everyday tradeoff before the safest action. The fifth pass makes completed Tageskonflikt days learnable through existing Activity feedback. The sixth pass lets Home use repeated tradeoff learning only when it changes today's adaptive option. The seventh pass keeps resolved tradeoff learning out of the daily lead and shows it only as quiet continuity/evidence unless fresh evidence changes today. The eighth pass makes fresh Home-impact reopens lead with only the new Heute evidence while old handled history stays context, the ninth pass says whether the fresh reopen source is isolated or part of a repeated source trend, the tenth pass keeps closed source trends as quiet continuity/evidence, the eleventh pass shows weekly receipt learning confidence only as quiet Home continuity/evidence, the twelfth pass calibrates that confidence as confirmed quietness or review context after follow-up evidence, the thirteenth pass shows weekly receipt trust duration only as quiet continuity/evidence, the fourteenth pass keeps weekly receipt renewal checks quiet as Data continuity/evidence, the fifteenth pass keeps stable/watch goal progress as quiet daily motivation/evidence, and the sixteenth pass keeps quiet goal continuity compact in Home while Data keeps the detailed explanation.

Shipped package: **Home haelt ruhige Ziel-Kontinuitaet kompakt.**

Outcome: after Data, Home and Plan separate stable/watch goal progress from real goal risk, Home should keep that quiet continuity to one compact Data-evidence line so the primary daily card remains action-first on mobile.

Why it matters: quiet goal progress is motivating only if it stays quiet. Home should reassure Tobi that the goal signal is accounted for without repeating Data's full goal and limiter explanation above the primary action.

Package PRs:

- Add golden and rendered coverage that stable/watch goal progress stays out of `Heute entscheidet`, CTA and `Sicherste Option`.
- Shorten the quiet goal-progress continuity line while preserving the Data goal-projection handoff.
- Use fresh route evidence to prove the mobile decision card remains compact and overflow-free.
- Preserve at-risk or blocked goal limiter precedence for real daily/Plan action.

Shipped package: **Home haelt Ziel-Fortschritt als ruhige Tagesmotivation.**

Outcome: after Data separates on-track progress, watch limiters and at-risk limiters, Home should keep on-track and watch goal progress out of `Heute entscheidet`, CTA and `Sicherste Option`, show it only as quiet motivation/continuity, and keep at-risk goal limiter evidence on the existing explicit daily or Plan decision path.

Why it matters: the daily surface should feel motivating when a goal is on course, without turning every progress update into a demand. Goal risk should still become action only when it changes the intelligent next step for body, goal and Alltag.

Package PRs:

- Add Daily Decision golden scenarios for on-track goal progress, watch limiter progress and at-risk limiter action.
- Keep stable/watch progress out of the leading factor, CTA and safest option.
- Show stable/watch goal progress only in continuity/evidence with the smallest Data handoff.
- Preserve the existing at-risk goal intervention precedence for real limiter risk.
- Use the Fast Lane `verify:tagesentscheidung:pr` gate plus one CI/Home smoke unless local rendered behavior is changed.

Shipped package: **Home haelt Wochenreceipt-Erneuerungschecks als Data-Kontinuitaet ruhig.**

Outcome: after Data can name the next weekly receipt renewal check, Home should keep that check out of `Heute entscheidet`, CTA and `Sicherste Option`, show it only as small Data continuity when receipt trust is quiet, and let fresh today recurrence continue to lead the existing daily review path.

Why it matters: a renewal check is useful learning context, not a new daily demand. Home should inherit the trust signal without turning Data maintenance into today's action.

Package PRs:

- Add Daily Decision golden scenarios for confirmed renewal check, unrefreshed renewal check and fresh today recurrence after a renewal check.
- Keep renewal-check language out of the leading factor, CTA and safest option.
- Show the renewal check only in continuity/evidence with the smallest Data handoff.
- Use the Fast Lane `verify:tagesentscheidung:pr` gate plus one CI/Home smoke unless local rendered behavior is changed.

Shipped package: **Home zeigt Wochenreceipt-Vertrauensdauer als Tagesruhe.**

Outcome: after Data can summarize how long a weekly receipt stayed confirmed, Home should show that duration only as quiet continuity/evidence and keep unrefreshed receipt trust calm unless fresh today evidence already changes the safest option.

Why it matters: the daily surface should inherit stronger Data trust without becoming a receipt log. Duration can make calmness feel earned, but it should never compete with today's body, goal, Garmin or recovery action.

Package PRs:

- Add Daily Decision golden scenarios for confirmed receipt trust duration, unrefreshed receipt trust and fresh today recurrence after a receipt.
- Keep receipt duration out of `Heute entscheidet`, CTA and `Sicherste Option`.
- Show trust duration only in continuity/evidence with the smallest Data handoff.
- Use the Fast Lane `verify:tagesentscheidung:pr` gate plus one CI/Home smoke unless local rendered behavior is changed.

Shipped package: **Home zeigt kalibriertes Wochenreceipt-Lernvertrauen als Tagesruhe.**

Outcome: after Data can say whether weekly receipt confidence was confirmed or weakened by follow-up evidence, Home should use confirmed confidence only as a small quiet-continuity reason and mention weakened confidence only as context when fresh today evidence already changes the safe option.

Why it matters: the daily surface should inherit Data's calibrated learning without becoming a receipt report. Confirmed confidence should make Home calmer; weakened confidence should explain why a fresh recurrence is real, not make the old receipt the daily lead.

Package PRs:

- Add Daily Decision golden scenarios for confirmed receipt confidence versus weakened receipt confidence with fresh today recurrence.
- Keep calibrated receipt confidence out of `Heute entscheidet`, CTA and `Sicherste Option` unless fresh today evidence already leads.
- Show confirmed/weakened receipt confidence only in continuity/evidence with the smallest Data handoff.
- Use the Fast Lane `verify:tagesentscheidung:pr` gate plus one CI/Home smoke unless local rendered behavior is changed.

Shipped package: **Home zeigt Wochenreceipt-Lernvertrauen als ruhige Tageskontinuitaet.**

Outcome: after Data exposes weekly receipt source trends as learning confidence, Home should use that confidence only as a short continuity reason for staying quiet and still reopen the daily lead only when fresh today evidence changes the safest option.

Why it matters: the daily command surface should not merely suppress old trends; it should feel trustworthy because Pulse can say which weekly receipt made staying quiet intelligent.

Package PRs:

- Add Daily Decision golden scenarios for weekly receipt confidence versus fresh today recurrence after receipt confidence.
- Keep receipt confidence out of `Heute entscheidet`, CTA and `Sicherste Option`.
- Show receipt confidence only in continuity/evidence with the smallest Data handoff.
- Use the Fast Lane `verify:tagesentscheidung:pr` gate plus one CI/Home smoke unless local rendered behavior is changed.

Shipped package: **Home haelt geschlossene Reopen-Quellentrends als Kontinuitaet ruhig.**

Outcome: after Data can mark source trends as handled by a weekly decision, Home should keep the daily lead quiet, show at most one short continuity hint, and reopen only when fresh source evidence changes today's safest option.

Why it matters: the daily command surface should feel calmer after Plan/Data learned. A handled Recovery-, Alltag-, Planlast-, Garmin- or Zielrisiko trend is trust-building context, not a new `Heute entscheidet`.

Package PRs:

- Add Daily Decision golden scenarios for handled source trends versus fresh source-trend recurrence.
- Keep handled trends out of `Heute entscheidet`, CTA and `Sicherste Option`.
- Show handled source trends only as continuity/evidence with the smallest Data handoff.
- Use the Fast Lane `verify:tagesentscheidung:pr` gate plus one CI/Home smoke unless local rendered behavior is changed.

Shipped package: **Home zeigt Reopen-Quellen als Tageskontext statt alte Konflikte neu zu starten.**

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

Status: **shipped fourteenth-pass package**. The shared weekly decision contract now appears in Plan Review and Change Inbox, exposes preview-only `Beibehalten`, `Anpassen` and `Spaeter` controls, ties goal/recovery/Garmin debt into one decision language, receives Home/Data Plan-/Load handoffs at `#plan-weekly-decision`, can store a local decision receipt without Plan/Garmin writes, uses gated learning calibration as explicit weekly decision evidence, carries repeated Tageskonflikte into the weekly decision receipt, consumes the shared tradeoff classifier only for true weekly decisions, keeps handled tradeoff receipts quiet until fresh weekly evidence appears, explains fresh reopens by source, uses repeated reopen-source trends as weekly decision context, keeps closed source trends as quiet weekly receipts, shows weekly receipt learning confidence as stable Plan confidence, calibrates that confidence after follow-up evidence, shows weekly receipt trust duration as stable Plan confidence, keeps weekly receipt renewal checks as quiet Plan confidence and keeps stable/watch goal progress as quiet weekly confidence.

Shipped package: **Plan haelt Ziel-Fortschritt als Wochenvertrauen ruhig.**

Outcome: after Data separates goal progress and Home keeps stable/watch progress quiet, Plan should show on-track and watch goal progress as weekly confidence/evidence, keep it out of the primary `Anpassen` preview, and keep at-risk or blocked goal limiters on the existing explicit weekly decision path.

Why it matters: the weekly surface should inherit goal progress without making every reachable goal a plan change. Goal risk should still become a weekly decision only when the limiter really changes the week.

Package PRs:

- Add Plan weekly decision scenarios for on-track goal progress, watch limiter progress and at-risk/blocked goal limiter action.
- Keep stable/watch goal progress out of the primary `Anpassen` preview and Garmin/Plan write path.
- Show stable/watch progress only as `Beibehalten` confidence, receipt/evidence continuity or a Data handoff.
- Preserve existing at-risk goal limiter precedence for real weekly risk.
- Use the Fast Lane `verify:trainingsanpassung:pr` gate plus one CI/Plan smoke unless local rendered behavior is changed.

Shipped package: **Plan haelt Wochenreceipt-Erneuerungschecks als Wochenvertrauen ruhig.**

Outcome: after Data/Home can show the next renewal check, Plan should keep the check in learned/evidence/receipt continuity for `Beibehalten`, out of the primary `Anpassen` preview, and let fresh weekly recurrence open the existing `Anpassen` path.

Why it matters: a renewal check is weekly confidence maintenance, not a new plan change by itself. Plan should inherit Data/Home trust without making the preview louder until real weekly evidence changes the decision.

Package PRs:

- Add Plan weekly decision scenarios for confirmed renewal check, unrefreshed renewal check and fresh weekly recurrence after a renewal check.
- Keep renewal-check language out of the primary `Anpassen` preview.
- Show renewal check as receipt/evidence continuity only.
- Use the Fast Lane `verify:trainingsanpassung:pr` gate plus one CI/Plan smoke unless local rendered behavior is changed.

Shipped package: **Plan zeigt Wochenreceipt-Vertrauensdauer im Wochenvertrauen.**

Outcome: after Data/Home can summarize receipt trust duration, Plan should show confirmed duration as stable `Beibehalten` evidence, keep unrefreshed trust calm, and use fresh weekly recurrence only to open `Anpassen`.

Why it matters: the weekly control surface should inherit durable receipt trust without turning the preview into a receipt log. Duration can make stability feel earned, while unrefreshed trust should not become broken confidence by itself.

Package PRs:

- Add Plan weekly decision scenarios for confirmed receipt trust duration, unrefreshed trust and fresh weekly recurrence after a receipt.
- Keep duration in receipt/evidence continuity, out of the primary `Anpassen` preview.
- Show unrefreshed trust as quiet context, not broken confidence.
- Use the Fast Lane `verify:trainingsanpassung:pr` gate plus one CI/Plan smoke unless local rendered behavior is changed.

Shipped package: **Plan zeigt kalibriertes Wochenreceipt-Lernvertrauen im Wochenvertrauen.**

Outcome: after Data/Home distinguish confirmed versus weakened receipt confidence, Plan should show confirmed confidence as stable `Beibehalten` evidence and use weakened confidence only as context when fresh weekly evidence opens `Anpassen`.

Why it matters: the weekly control surface should inherit the calibrated learning loop without becoming a receipt report. Confirmed confidence should make Plan stability feel earned; weakened confidence should explain why a fresh weekly recurrence is real.

Package PRs:

- Add Plan weekly decision scenarios for confirmed receipt confidence versus weakened receipt confidence with fresh weekly recurrence.
- Keep confirmed confidence in receipt/evidence continuity and out of the primary `Anpassen` path.
- Show weakened receipt confidence only as context when fresh weekly evidence already opens `Anpassen`.
- Use the Fast Lane `verify:trainingsanpassung:pr` gate plus one CI/Plan smoke unless local rendered behavior is changed.

Shipped package: **Plan zeigt Wochenreceipt-Lernvertrauen als stabiles Wochenvertrauen.**

Outcome: after Data and Home expose weekly receipt source trends as learning confidence, Plan should show which receipt supports `Beibehalten`, keep the preview stable, and reopen `Anpassen` only when fresh weekly source evidence changes the week.

Why it matters: the weekly control surface should not merely stay quiet; it should make stability feel earned because Pulse can name the receipt that closed the source trend.

Package PRs:

- Add Plan weekly decision scenarios for weekly receipt confidence versus fresh weekly source recurrence after receipt confidence.
- Keep receipt confidence out of the primary `Anpassen` path and preview change copy.
- Show receipt confidence only as receipt continuity/evidence with the smallest Data/Plan handoff.
- Use the Fast Lane `verify:trainingsanpassung:pr` gate plus one CI/Plan smoke unless local rendered behavior is changed.

Shipped package: **Plan haelt geschlossene Reopen-Quellentrends als Wochenreceipt ruhig.**

Outcome: after Data and Home can mark handled source trends as quiet continuity, Plan should keep the weekly receipt stable, show closed source trends only as confidence/continuity evidence, and reopen `Anpassen` only when fresh weekly source evidence appears.

Why it matters: the weekly control loop should also get calmer after a conscious source-trend decision. A handled Recovery-, Alltag-, Planlast-, Garmin- or Zielrisiko trend should explain why the week stayed stable, not behave like a new plan problem.

Package PRs:

- Add Plan weekly decision scenarios for handled source trends versus fresh weekly source-trend recurrence.
- Keep handled source trends out of the primary `Anpassen` path and preview choice.
- Show handled source trends only as receipt continuity/evidence with the smallest Data/Plan handoff.
- Use the Fast Lane `verify:trainingsanpassung:pr` gate plus one CI/Plan smoke unless local rendered behavior is changed.

Shipped package: **Plan nutzt Reopen-Quellentrends als Wochenentscheidungs-Kontext.**

Outcome: after Data groups repeated reopen sources and Home shows the daily trend hint, Plan should decide whether a repeated source trend changes the weekly choice or stays watch context.

Why it matters: source-specific reopen copy is useful once; repeated source trends are what should change the week. Plan should not re-explain every source instance if Data has already grouped the pattern.

Package PRs:

- Add Plan weekly decision scenarios for repeated reopen-source trend versus isolated fresh source.
- Keep source trends in learned/changed context and open `Anpassen` only when they create weekly action.
- Preserve preview-only `Beibehalten`, `Anpassen` and `Spaeter` contracts plus handled receipt continuity.
- Use the Fast Lane `verify:trainingsanpassung:pr` gate plus one CI/Plan smoke unless local rendered behavior is changed.

Shipped package: **Plan erklaert frische Tradeoff-Reopens nach Evidenzquelle.**

Outcome: after Data/Home can name why a resolved tradeoff reopened, Plan explains whether the fresh weekly evidence comes from plan load, recovery, Garmin execution or goal pressure, and maps `Anpassen` to the smallest preview-only weekly action.

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

Status: **shipped twelfth-pass package**. PRs #471 and #473 delivered Data action-effect contracts, Fueling learning-loop copy, Home watch-context gating and a compact Data training-risk contract. The second pass adds Data learning calibration across Decision Quality, Personal Response and Fueling trends with shared Fueling trend gates. The third pass classifies repeated body/goal/everyday tradeoff evidence as `today_action`, `plan_decision` or `watch_context`, the fourth pass keeps resolved tradeoff patterns quiet until fresh evidence appears, the fifth pass explains source-specific fresh reopen evidence while older handled evidence stays context, the sixth pass groups repeated reopen sources into trend-level learning, the seventh pass closes handled source trends after weekly decisions, the eighth pass shows weekly receipt source trends as learning confidence, the ninth pass calibrates that confidence after follow-up evidence, the tenth pass shows weekly receipt trust duration, the eleventh pass names the next receipt renewal check and the twelfth pass makes goal progress motivating Data evidence.

Shipped package: **Data macht Ziel-Fortschritt als motivierende Performance-Evidenz sichtbar.**

Outcome: after Goal Projection and Season evidence exist, Data should distinguish on-track progress, watch limiters and at-risk limiters as understandable performance evidence. Stable progress stays motivating evidence; only actionable limiter risk routes to existing Home or Plan decisions.

Why it matters: the Performance OS should make goal progress feel legible and motivating, not just diagnostic. Data is the right source layer to separate real limiter action from useful progress context before Home or Plan gets louder.

Package PRs:

- Add Data action-contract scenarios for on-track goal progress, watch limiter and at-risk limiter evidence.
- Keep stable progress as motivating Data evidence without a Home or Plan action.
- Route actionable limiter risk only to existing Home/Plan decision paths with result preview and no hidden writes.
- Use the Fast Lane `verify:lernschleifen:pr` gate plus one CI/Data smoke unless local rendered behavior is changed.

Shipped package: **Data zeigt den naechsten Wochenreceipt-Erneuerungscheck.**

Outcome: after Data/Home/Plan can all show receipt trust duration, Data should say what would refresh unaufgefrischtes Wochenreceipt-Vertrauen next, without making Home or Plan louder until fresh Heute- or Wochen-Evidenz actually changes the action.

Why it matters: trust duration is useful only if the learning loop also knows how it gets refreshed. Data should make the next evidence check visible while keeping the daily and weekly command surfaces calm.

Package PRs:

- Add Data action-contract scenarios for confirmed duration, unrefreshed trust with a missing follow-up check and fresh recurrence after unrefreshed trust.
- Show the smallest Data-only evidence refresh check for unrefreshed receipt trust.
- Keep fresh recurrence routed through existing Home/Plan action paths, with the old receipt only as context.
- Use the Fast Lane `verify:lernschleifen:pr` gate plus one CI/Data smoke unless local rendered behavior is changed.

Shipped package: **Data zeigt Wochenreceipt-Vertrauensdauer.**

Outcome: after Data/Home/Plan all distinguish confirmed versus weakened receipt confidence, Data should summarize how long a weekly receipt has stayed confirmed and when that confidence is merely unrefreshed rather than broken.

Why it matters: a private Performance OS should not show the same receipt forever at the same strength. Confirmed quietness should build trust over time, stale-but-unbroken receipts should stay calm, and fresh recurrence should still be the only route back to Home or Plan action.

Package PRs:

- Add Data action-contract scenarios for repeated confirmed follow-up, unrefreshed receipt confidence and fresh recurrence after a receipt.
- Show receipt trust duration as quiet evidence, not a Home or Plan route by itself.
- Keep stale-but-unbroken receipt confidence separate from weakened confidence caused by fresh today/week recurrence.
- Use the Fast Lane `verify:lernschleifen:pr` gate plus one CI/Data smoke unless local rendered behavior is changed.

Shipped package: **Data kalibriert Wochenreceipt-Lernvertrauen nach Folgewirkung.**

Outcome: after Home and Plan both consume weekly receipt learning confidence, Data should say whether the receipt confidence is still confirmed by follow-up evidence or needs review because fresh recurrence appeared.

Why it matters: receipt confidence should become calibrated learning, not a permanent quiet label. Data is the place to show when a closed source trend stayed stable and when fresh follow-up evidence makes that confidence weaker.

Package PRs:

- Add Data action-contract scenarios for confirmed receipt confidence versus receipt confidence weakened by fresh follow-up recurrence.
- Keep confirmed confidence as quiet evidence only, without routing Home or Plan.
- Route weakened confidence through the existing fresh today/week action paths while naming the old receipt as context.
- Use the Fast Lane `verify:lernschleifen:pr` gate plus one CI/Data smoke unless local rendered behavior is changed.

Shipped package: **Data macht Wochenreceipt-Quellentrends als Lernvertrauen sichtbar.**

Outcome: after Plan can keep closed source trends as weekly receipts, Data should show which weekly receipt closed the trend, use it as learning confidence, and still route only fresh recurrence back to Home or Plan.

Why it matters: the evidence workbench should make calm learning visible. A closed Planlast-, Recovery-, Garmin-, Alltag- or Zielrisiko trend is not just absence of action; it is proof that Pulse learned and that Home/Plan are staying quiet for a reason.

Package PRs:

- Add Data action-contract scenarios for weekly receipt confidence versus fresh source-trend recurrence after a receipt.
- Show handled source trends as receipt confidence/evidence, not as a new Home or Plan action.
- Keep fresh recurrence routing explicit with old receipt confidence as context.
- Use the Fast Lane `verify:lernschleifen:pr` gate plus one CI/Data smoke unless local rendered behavior is changed.

Shipped package: **Data schliesst Reopen-Quellentrends nach Wochenentscheidungen.**

Outcome: after Plan can consume source trends as explicit weekly context, Data should show whether a repeated source trend is already handled by a weekly decision or has fresh evidence that reopens Home or Plan.

Why it matters: a learning loop is only calm if it gets quieter after a conscious decision. Reopen-source trends should become continuity once handled, and only new source evidence should restart the daily or weekly action.

Package PRs:

- Add Data action-contract scenarios for handled reopen-source trends versus fresh source-trend recurrence.
- Keep handled source trends as quiet evidence unless fresh today or weekly evidence changes the action.
- Show whether the trend is resolved continuity, watch context or a renewed Home/Plan action.
- Use the Fast Lane `verify:lernschleifen:pr` gate plus one CI/Data smoke unless local rendered behavior is changed.

Shipped package: **Data buendelt wiederkehrende Reopen-Quellen zu Lerntrends.**

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
