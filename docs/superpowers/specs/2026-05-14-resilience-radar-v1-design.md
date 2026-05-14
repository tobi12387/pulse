# Resilience Radar v1 Design

## Completion Audit Against The North Star

Objective: Pulse should become a personal resilience and performance coach that connects training, nutrition, recovery and mental wellbeing, notices overload or low-mood patterns earlier, supports healthy routines and activates appropriate user-approved support.

Prompt-to-artifact checklist:

| Requirement | Current evidence | Gap |
|---|---|---|
| Physical training is connected to daily decisions | Home/Plan use readiness, load, plan trace, workout alternatives, Garmin execution and goal projection. | Covered for v1. |
| Nutrition is part of performance guidance | Fueling preferences, workout guidance, debt closure, activity logs and goal projection use fueling evidence. | Trend summaries remain data-gated by explicit roadmap decision. |
| Recovery is connected to training choices | Readiness, sleep, HRV, Body Battery, TSB and boundary guidance already affect Plan/Data/Home language. | Covered for v1. |
| Mental wellbeing is first-class | Mental check-in, mental impact language, Coach context, mental support actions and Data > Mental guidance exist. | Mostly covered for single-day state. |
| Depressive/overload patterns are noticed earlier | Risk engine has a mental negative streak signal; mental themes and load overlay exist. | Missing a calm, visible, multi-day resilience layer that combines these signals for the user. |
| Healthy routines are supported | Daily check-in, actions, daily surface and plan review support routine closure. | Missing an explicit routine-stability interpretation when check-ins disappear or repeat low-energy patterns. |
| Support is activated in time | Support Activation v1 stores explicit support preferences and adds them to Coach context. | Missing visible support suggestion when multi-day patterns justify using the stored support plan. |

Result: The total objective is not complete. The next concrete slice should close the visible early-pattern/support-plan gap without widening scope.

## Decision

Build Resilience Radar v1 as a read-only evidence card in Data > Mental backed by a deterministic backend endpoint.

The card answers:

- What pattern is Pulse seeing over the last 14 days?
- Is the strongest next move a check-in, boundary, routine rebuild or support-plan prompt?
- Which evidence made that suggestion visible?

## Scope

In scope:

- Add shared response types for a resilience radar.
- Add a backend service and route at `GET /api/pulse/mental/resilience-radar?days=14`.
- Use existing Pulse tables only: mental check-ins, daily metrics, computed load series and coach support preferences.
- Show a compact card in `Data > Mental`.
- Include a Coach prompt deep link only when support preferences are configured and activation preference is not `manual_only`.
- Cover backend pure logic, route contract and one Playwright mental-flow smoke.

Out of scope:

- New database columns or migrations.
- LLM calls, diagnosis, clinical terminology or hidden sensitive labels.
- Automatic contact, push escalation, plan mutation or Garmin writes.
- Nutrition trend summaries; they remain data-gated until enough comparable logs exist.

## Product Behavior

Radar states:

- `learning`: not enough evidence yet; primary action is the daily check-in.
- `steady`: recent evidence looks manageable; primary action keeps the routine.
- `watch`: one or more signals suggest the day should stay smaller.
- `protect`: repeated low mood, low energy, high stress or high recovery load suggests a boundary/support action.
- `rebuild`: check-in routine has dropped after previous use; primary action restarts the smallest routine.

Signals are visible and evidence-based:

- `low_mood_trend`: recent mood average is low.
- `low_energy_trend`: recent energy average is low.
- `stress_pressure`: recent stress average is high.
- `load_pressure`: negative TSB or high Garmin stress overlaps with mental pressure.
- `routine_gap`: no recent check-in despite previous check-ins in the window.
- `support_plan`: support preferences are configured and the current radar state warrants showing them.

The copy must avoid medical claims. It should use language such as `Schutzmodus`, `Routine neu starten`, `Druck rausnehmen`, `Supportplan vorbereiten`.

## Data Flow

1. Frontend calls `useResilienceRadar(14)`.
2. Backend fetches:
   - recent `pulse_mental_checkins` with scores and themes,
   - recent `pulse_daily_metrics` with stress, sleep and Body Battery,
   - `computeFitnessLoadSeries` for TSB,
   - `pulse_coach_preferences` support fields.
3. Pure builder computes averages, coverage and visible signals.
4. Route returns typed `PulseResilienceRadarResponse`.
5. Data > Mental renders loading, error, learning and evidence states.

## Verification

- Pure service tests for protect/support and learning/routine-gap states.
- Route test verifies authenticated response shape and no mutation path.
- Playwright focused test verifies Data > Mental renders the radar and can open a prepared Coach prompt without sending a message.
- Run `npm run test -w backend -- src/pulse/services/resilience-radar.test.ts src/pulse/plugin.test.ts`.
- Run `npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts -g "Data mental shows resilience radar" --project=desktop-chromium`.
- Run sequential build: `npm run build -w shared && npm run build -w backend && npm run build -w frontend`.
