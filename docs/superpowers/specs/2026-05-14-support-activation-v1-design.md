# Support Activation v1 Design

Date: 2026-05-14
Status: review-ready spec
Decision owner: Tobi + Codex

## Problem

Pulse is now oriented as a personal resilience and performance coach, not only a training dashboard. Training, nutrition, recovery and mental wellbeing already influence daily decisions, plan safety and Coach context, but one part of the north star is still missing as a real product path: timely, user-approved support activation.

The current app has useful building blocks:

- Mental check-ins and guided mental companion questions.
- Mental trend risk signals that stay safety-bounded and never become clinical diagnoses.
- Coach prompt rules for acute danger wording.
- Daily actions and Coach CTAs that can route the user toward reflection.

The gap is that Pulse cannot yet represent "when I am slipping, this is the support I have already approved." Without that, support activation remains generic Coach copy rather than a trusted personal plan.

## Selected Approach

Approach A: Configured Support Plan v1.

Pulse stores an explicit support plan that Tobi controls in Settings. Pulse may suggest opening or using this plan when existing mental trend or overload evidence is present, but it never contacts anyone automatically, never escalates silently and never assigns a clinical label.

The support plan is a preference surface, not an emergency automation system. It should answer:

- what early warning signs Tobi wants Pulse to take seriously;
- which stabilizing actions are worth trying first;
- which trusted support path or contact note Tobi wants visible when things are harder;
- what wording style feels acceptable when Pulse suggests support.

## Architecture

Use the existing Coach preferences boundary for v1.

Backend:

- Extend `pulse_coach_preferences` with additive support-plan fields.
- Serialize the fields through `GET /api/pulse/coach/preferences`.
- Persist updates through `PATCH /api/pulse/coach/preferences`.
- Include the support plan in `buildRichSystemPrompt` only as explicit user-provided support preferences.
- Keep all LLM calls routed through `backend/src/lib/llm.ts` via the existing Coach engine.

Frontend:

- Extend `PulseCoachPreferences` shared types and `frontend/src/pulse/api-client.ts` usage.
- Add a compact `Unterstuetzung` section inside Settings > Coach preferences.
- Keep the read view short and the edit view explicit.
- Use existing Settings group layout and form patterns instead of introducing a new route.

Daily/mental surfaces:

- V1 can route support-relevant mental actions to Coach or Settings with explicit wording such as `Supportplan oeffnen`.
- V1 should not add a new top-level tab, notification topic, automatic push, or direct contact action.
- Any CTA must explain that it opens a plan or prepared Coach prompt; it does not send messages or mutate Garmin/training plans.

## Data Shape

Additive fields on `pulse_coach_preferences`:

- `support_warning_signs text[] not null default ARRAY[]::TEXT[]`
- `support_stabilizing_actions text[] not null default ARRAY[]::TEXT[]`
- `support_contact_note text not null default ''`
- `support_activation_preference varchar(32) not null default 'suggest_only'`

Allowed activation preferences:

- `suggest_only`: Pulse may suggest opening the support plan when relevant evidence exists.
- `coach_prompt`: Pulse may prepare a Coach prompt that uses the support plan.
- `manual_only`: Pulse stores the plan but does not proactively surface it.

All values are explicit user input or explicit selection. Do not store inferred sensitive labels.

## Product Behavior

Settings > Coach shows the support plan as optional and user-controlled.

Read state:

- Show whether a support plan is configured.
- Show warning signs, stabilizing actions and contact note only if present.
- Show the activation preference in everyday language.
- State that Pulse never contacts anyone automatically.

Edit state:

- Warning signs are one-per-line text entries.
- Stabilizing actions are one-per-line text entries.
- Contact note is free text. It may be a person, group, therapist, hotline reminder, or "none"; Pulse treats it as private user text.
- Activation preference is a select control.

Coach context:

- If a support plan exists, append it under a clearly labeled explicit-preferences section.
- Wording must say these are user-provided support preferences.
- Coach can suggest using the plan when mental stress, overload or low-mood evidence is already present, but must stay non-diagnostic.

## Safety Rules

- No clinical diagnosis.
- No hidden sensitive inference.
- No automatic messages, calls, push escalations, emails, Telegram, or third-party contact.
- No support activation based on a private label that is not visible to Tobi.
- No alarmist copy for ordinary warn-level patterns.
- Acute danger handling remains in Coach safety instructions: if Tobi names immediate danger, self-harm or danger to others, Coach directs to emergency help, local crisis support or a trusted nearby person.
- Support plan copy should frame actions as reflection, boundaries, routine repair and user-approved support.

## Error Handling

- Missing support plan is a valid state, not a Settings problem.
- Save validation should reject only malformed payloads, overlong entries, or invalid activation preference values.
- If saving fails, keep the form open and show the existing Settings message pattern.
- If Coach preferences fail to load, keep the rest of Settings usable.

## Testing

Backend:

- Defaults: `GET /api/pulse/coach/preferences` returns empty support-plan fields for users without preferences.
- Persistence: `PATCH /api/pulse/coach/preferences` saves support fields and returns them.
- Validation: invalid activation preference or overlong entries return 400.
- Coach context: `buildRichSystemPrompt` includes configured support preferences as explicit user input and omits them when empty.

Frontend:

- Settings > Coach renders the support section in read state.
- Editing and saving support fields calls the existing preferences mutation with support fields.
- The read state clearly says Pulse does not contact anyone automatically.
- If a support-relevant CTA is added in this slice, cover the route or prompt behavior with a focused test.

Docs/static:

- Add a decision-log entry for the support-plan scope.
- If implementation changes the durable roadmap order or manual gates, update `docs/ai/current-focus.md`; otherwise leave it alone.

## First Implementation Scope

One PR-sized slice:

1. Add shared types, additive migration and backend route serialization/persistence.
2. Add support-plan prompt formatting to Coach context.
3. Add Settings > Coach support-plan UI.
4. Add focused backend and frontend verification.
5. Record the decision in `docs/decisions.md`.

## Non-Goals

- No automatic contact or escalation.
- No new notification topic.
- No Telegram integration.
- No data export.
- No new top-level navigation.
- No diagnosis, severity scoring, or hidden mental-health labels.
- No plan or Garmin mutation when the support plan is opened.
- No broad redesign of Coach, Data, Home or Settings beyond the support-plan section.
