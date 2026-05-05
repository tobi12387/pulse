# Contextual Coach Actions QA

## Scope

This PR keeps Coach out of primary navigation, but lets Home and Plan open `/coach` with a prepared draft prompt through `?focus=...&prompt=...`. The Coach route pre-fills the input and still requires an explicit send. Existing push/action links such as `/coach?actionId=...&decisionId=...` remain compatible and do not auto-fill a prompt.

## Evidence

- Route evidence command: `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/contextual-coach-actions npm run qa:ux-evidence`
- Path: `test-results/route-evidence/contextual-coach-actions/2026-05-05-46b114f/`
- Viewports:
  - Desktop Chromium: `1280x720`
  - Mobile Chromium: `412x839`
- Manifest result: no horizontal overflow on `/`, `/coach`, `/data`, `/data?tab=mental`, `/data?tab=analysen`, `/plan`, or `/settings`.

## Verification

- `git diff --check`: passed.
- `npm run build -w frontend`: passed.
- `npm run build`: passed.
- Red test before implementation: `npm run test:e2e -- --project=desktop-chromium --grep "prompt deep links|Home daily decision can open Coach|Plan empty training decision"` failed because query prompts were ignored, Home had no prepared Coach action, and Plan opened plain `/coach`.
- `npm run test:e2e -- --project=desktop-chromium --grep "prompt deep links"`: passed, `2 passed`.
- `npm run test:e2e -- --project=desktop-chromium --grep "prompt deep links|action deep links|Home daily decision can open Coach|Plan empty training decision"`: passed, `4 passed`.
- `npm run test:e2e -- --project=mobile-chromium --grep "prompt deep links|action deep links|Home daily decision can open Coach|Plan empty training decision|Mobile navigation"`: passed, `5 passed`.
- `npm run test:e2e -- --project=desktop-chromium --project=mobile-chromium --grep "prompt deep links|action deep links|Home daily decision can open Coach|Plan empty training decision|Home owns the full daily decision|Coach daily briefing|Daily loop keeps context|primary navigation exposes"`: passed, `18 passed`.
- `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/contextual-coach-actions npm run qa:ux-evidence`: passed, `2 passed`.

## Route Notes

- `/coach?focus=daily&prompt=...`: fills the Coach draft and sends nothing automatically.
- Opening a second prompt deep link fills the new prepared draft and still sends nothing automatically.
- `/coach?actionId=...&decisionId=...`: remains a compatibility route with an empty draft.
- Home daily decision now exposes a visible `Gespräch damit starten` action that opens Coach with the derived daily-decision prompt.
- Plan empty training state opens Coach with a short plan-specific draft instead of a plain `/coach` jump.
