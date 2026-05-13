# Plan Mobile Scenario Copy

> Status: implemented in the `codex/plan-mobile-scenario-copy` slice.

## Context

The Focus roadmap says every action needs a contract, but optional evidence should not bury the next action. The mobile Plan scenario preview had the correct safety semantics, yet repeated "preview/no write" language across header, context, summary and reasons.

## Scope

- Keep the scenario preview read-only until explicit apply.
- Keep `Nach Apply`, `Sicherste Entscheidung`, Garmin impact and apply/cancel actions.
- Filter summary/reason text that only repeats the no-write safety reminder for quick scenario entries.
- Leave backend scenario preview data and mutation semantics untouched.

## Non-Goals

- No Garmin write behavior changes.
- No Plan scenario model changes.
- No custom workout or availability flow redesign.

## TDD Contract

1. Add a mobile E2E contract proving the quick-availability scenario result does not repeat no-write copy in summary/reasons.
2. Verify the test fails against the previous UI.
3. Implement a small UI-level filter.
4. Re-run focused Plan/mobile tests, build, route evidence and live verification before merge.
