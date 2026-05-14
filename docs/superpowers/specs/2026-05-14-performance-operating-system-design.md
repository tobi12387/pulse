# Performance Operating System Design

> Status: draft for Tobi review.
> Scope: docs-only product design. This spec does not implement runtime behavior, migrations, Garmin writes, LLM calls or UI changes.

## Goal

By the end of 2026, Pulse should feel less like a coaching dashboard and more like Tobi's private performance operating system: one calm daily decision that combines body state, goal context, training logic, device execution, everyday constraints, nutrition learning and deep analysis.

The core question is:

```text
What is the smartest action today for my body, my goal and my real life?
```

Pulse should answer that question first, then explain enough evidence that Tobi can trust, override or refine the recommendation.

## Why This Exists

The current roadmap already has many of the foundations: daily decision clarity, Garmin execution contracts, training alternatives, progression labels, mental resilience guidance, personal response evidence, goal projection, season strategy and practical fueling logs. The remaining product risk is not that Pulse lacks data. The risk is that the product keeps adding useful evidence without consistently collapsing it into one action.

This spec turns the 2026 north star into a reviewable contract for future PR-sized slices.

## End-2026 Success Criteria

Pulse reaches the performance operating system target when these criteria are true in normal daily use:

1. **Daily action is primary.** The first daily surface answers what to do today before showing analysis, history or diagnostics.
2. **The action is multi-domain.** Training load, recovery, sleep/readiness proxies, recent Garmin execution, goal pressure, mental state, routine stability and fueling evidence can all change the recommendation.
3. **The action is device-aware.** If the recommendation depends on a planned workout, Pulse states whether the Garmin execution path is ready, missing, stale, repaired or intentionally local-only.
4. **The action is adaptable.** Tobi can say "less time", "not ready", "change today", "done differently" or "skip" and land in an existing explicit review flow instead of a hidden mutation.
5. **The action learns from nutrition.** Practical fueling logs influence future long-session guidance only when evidence is comparable enough; weak sodium, heat or sweat-rate evidence remains labeled as a gap.
6. **The action respects mental resilience.** Low mood, stress, energy and routine-collapse signals can soften the day, suggest boundaries or offer a user-configured support path without clinical diagnosis or hidden sensitive labels.
7. **Deep analysis is translated.** Expert evidence remains available in Data/Analyse, but Home/Plan/Insights translate it into action labels, limiter reasons, confidence and next intervention.
8. **The product is calm.** Each primary surface has one job, one dominant action and optional evidence. Repeated recommendations explain what stayed true or what changed.

## Benchmark Translation

Pulse should borrow product patterns, not proprietary plans, workouts or algorithms.

| Reference | Pattern To Learn | Pulse Translation |
|---|---|---|
| WHOOP / Oura | Calm daily readiness, contributors and trend context. | Start with today's state and action; keep contributors one layer deeper. |
| TrainerRoad | Workout levels, progression fit and TrainNow alternatives. | Label planned and alternative workouts as protective, maintain, productive, stretch or too hard today. |
| TrainingPeaks | Calendar planning, structured workout execution and device sync trust. | Make Plan feel like a week/execution desk, not a generator; surface Garmin readiness as part of the action contract. |
| Garmin | Device-near execution and recent activity truth. | Treat Garmin readback, completion, missed sessions and local-only states as first-class evidence. |
| Runna / JOIN | Adaptation around life constraints and not-feeling-100-percent days. | Give explicit "change today" flows that review impact before mutating plans or Garmin. |
| MacroFactor | Coaching updates from repeated nutrition evidence. | Turn comparable fueling logs into stable/learning trend summaries; avoid claims when evidence is too sparse. |
| Intervals.icu / WKO | Deep model provenance and performance analysis. | Preserve expert analysis in Data, then translate it into limiter, confidence and next-action evidence elsewhere. |

## Product Contract

Future Pulse work should preserve this decision grammar:

```text
Action: what should Tobi do today?
Reason: why is that smart now?
Impact: what changes for the goal, recovery, week or Garmin execution?
Alternatives: what happens if Tobi has less time, lower readiness or does something different?
Evidence: which signals support the call, and what is still weak?
```

This contract applies to Home, Plan, Insights, Data and Coach whenever they surface a task or recommendation. It does not require every page to repeat the same card. The goal is consistent decision logic, not duplicated UI.

## Conceptual Architecture

The performance operating system should be built as a translation layer over existing Pulse evidence, not as a separate product silo.

1. **Evidence sources:** Garmin/readiness/load, planned workouts, execution ledger, mental check-ins, resilience radar, fueling logs, personal response evidence, goal projection and season strategy.
2. **Decision synthesis:** deterministic contracts first, LLM support only through `backend/src/lib/llm.ts` when a future implementation plan explicitly needs narrative synthesis.
3. **Action surfaces:** Home owns the daily action, Plan owns week/execution decisions, Data owns evidence and analysis, Insights owns synthesis, Coach owns explicit reflection and prepared prompts.
4. **Review flows:** any plan change, Garmin write, support prompt or major recommendation change routes through a visible preview/review step.

This architecture keeps the product calm: evidence can be deep, but the primary action remains short and explainable.

## Evidence Flow

Future implementation plans should preserve this flow:

```text
Raw evidence -> shared domain contracts -> daily action synthesis -> explicit review/action -> outcome feedback -> next recommendation
```

Examples:

- Garmin activity readback changes planned-vs-completed evidence, which can change the next daily action and Plan review state.
- A low-fuel long session with GI comfort can update the next long-session target; sparse or incomparable logs remain an evidence gap.
- A low-energy, high-stress check-in can soften the daily action and offer boundary/support prompts without changing the goal model silently.
- Deep analysis can identify a limiter, but Home should show the translated limiter impact instead of asking Tobi to read the full model output.

## Safety And Error Handling

Performance-OS work should fail gently and locally:

- If a signal is missing, stale or weak, label the evidence gap and continue with the best supported action.
- If Garmin status is unknown, avoid pretending the device path is ready.
- If mental or resilience signals are concerning, use boundary/support language, not diagnosis, severity labels or hidden escalation.
- If nutrition evidence is too sparse, keep guidance educational and session-specific instead of trend-like.
- If an action would mutate plan, Garmin, support settings or notifications, require an explicit user action.

## Domain Roles

### Body State

Body state includes readiness, recovery, sleep proxies, HRV/HR signals, fatigue/load and recent subjective check-ins. It can protect the day, allow progression or ask for a lighter alternative. It must use shared thresholds/contracts where available instead of local page heuristics.

### Goal Context

Goal context includes the active season goal, goal probability, limiter risk, next intervention, hard-day cap and weekly progression purpose. It should explain why today's action helps the goal or why protecting recovery is the smarter goal move.

### Training Logic

Training logic includes capability levels, workout fit, planned-vs-completed evidence, progression role, alternatives and season load. Future work should improve the action synthesis around these foundations, not rebuild the completed foundations.

### Garmin Execution

Garmin is part of the decision, not a separate technical afterthought. If a workout is recommended, Pulse should make execution confidence clear: template, calendar, repeats, readback, completion, repair and local-only status. No page should perform hidden Garmin writes on load.

### Everyday Adaptation

Everyday adaptation means the product can handle constraint changes: less time, lower readiness, off-plan activity, missed session, travel, stress, low mood or deliberate rest. Adaptation should route through explicit preview/apply flows with visible plan and Garmin impact.

### Nutrition Learning

Nutrition learning should come from practical logs and repeated comparable sessions. Pulse can recommend concrete next-session fueling targets when the existing evidence supports it, but trend summaries stay gated until enough complete logs exist. Sodium, heat and sweat-rate stay labeled as evidence gaps until measured.

### Deep Analysis

Deep analysis belongs in Data/Analyse and related evidence workbenches. Other surfaces should use short translations: limiter, confidence, changed-since-last-time, next intervention and why this action is still valid.

### Mental Resilience

Mental resilience is part of performance. Pulse may use check-ins, routine gaps, load/recovery and support preferences to suggest boundaries, routine repair or a prepared support prompt. It must not diagnose, infer hidden sensitive labels or contact anyone automatically.

## First PR-Sized Slices

These are candidate slices after this spec is reviewed. They should remain separate unless a future implementation plan proves two are tightly coupled.

1. **Daily Intelligent Action Contract v2**
   - Outcome: Home's primary decision explicitly names the top contributing domains, the goal impact, Garmin execution state and the safest alternative.
   - Constraint: no new data model unless an implementation plan proves an existing contract cannot express the action.

2. **Nutrition Learning Loop v1**
   - Outcome: comparable fueling logs produce a small stable/learning/evidence-gap summary and a next long-session fueling target.
   - Constraint: trend summaries remain gated by at least three comparable complete `during` logs with activity/duration context, carbs and GI comfort.

3. **Everyday Adaptation Inbox v1**
   - Outcome: "less time", "not ready", "done differently" and "skip" decisions are visible as one calm review path with previewed goal, recovery, week and Garmin effects.
   - Constraint: no hidden plan mutation and no automatic Garmin write.

4. **Analysis Translation v1**
   - Outcome: Data/Analyse exposes which deep signal currently matters for the daily action and which signal is interesting but not actionable yet.
   - Constraint: do not create another dashboard; translate evidence into decision impact.

5. **Performance OS Route Evidence Pass**
   - Outcome: route screenshots and UX notes identify whether Home, Plan, Data, Insights, Coach or Settings should change navigation/first-viewport responsibilities before runtime work.
   - Constraint: route evidence comes before broad UI restructuring.

## Non-Goals

- No direct server editing.
- No direct provider SDK calls outside `backend/src/lib/llm.ts`.
- No DB migration in this docs-only spec.
- No automatic Garmin writes, plan mutations, support contact or push escalation.
- No clinical mental-health diagnosis or hidden sensitive inference.
- No Telegram integration.
- No data export.
- No copied proprietary TrainerRoad, TrainingPeaks, JOIN, Runna, Xert, Intervals.icu, WKO, WHOOP, Oura, Garmin or MacroFactor content.
- No native iOS decision without real iPhone/PWA evidence showing a recurring unresolved problem.

## Verification For This Spec

This spec is complete when:

1. It maps every named benchmark family in the north-star prompt to a Pulse product role.
2. It turns the broad end-2026 goal into concrete success criteria.
3. It preserves current Pulse constraints from `AGENTS.md`, `docs/ai/non-negotiables.md` and the canonical roadmap.
4. It produces PR-sized candidate slices instead of one broad rewrite.
5. It leaves implementation behind a separate user-reviewed implementation plan.

Future implementation plans should add focused verification for their touched surface: contract/unit tests for synthesis logic, route evidence for UI hierarchy, no-write guards for Garmin/plan-sensitive flows, and nutrition/resilience fixtures for weak-evidence cases.

## Review Gate

Tobi should review this spec before any implementation plan is written. After approval, the next step is to create a focused implementation plan for the first chosen slice, most likely **Daily Intelligent Action Contract v2** unless Tobi selects a different slice.
