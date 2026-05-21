# Performance Gate Next Prompts - 2026-05-22

Branch: `codex/performance-gate-refresh-2026-05-22`
Base commit: `b9de0fe`
Mode: local planning from a feature branch; server mirror verification is deferred until clean `main`.

## Purpose

Refresh the current Performance-OS gates after the new Fueling and iPhone/PWA `--next-prompt` helpers landed on `main`.

This is a handoff/evidence slice, not a product feature slice. The product gates remain closed until the manual evidence below is captured.

## Commands

```bash
npm run audit:performance-next -- --today 2026-05-22
npm run audit:performance-gates -- --today 2026-05-22 --local-planning --json
npm run audit:fueling-gate -- --today 2026-05-22 --next-prompt
npm run audit:iphone-pwa-gate -- --expected-commit b9de0fe --next-prompt
npm run audit:performance-checklist -- --today 2026-05-22
```

## Result

- Gate status: `gated`
- Open gates: 2
- Deferred gates: 1
- Expected commit for field/server evidence: `b9de0fe`
- Next unblock: Fueling learning

## Fueling Next Prompt

Fueling trend summaries are still gated:

- Comparable complete logs: `0/3`
- Existing logs completable now: `2`
- New complete long-session logs still needed after existing candidates: `1`

First target:

- Activity: `2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs (54 g/h)`
- Path: `/plan/activity/3a77af7f-3ece-40ea-8879-c6d878519c61#activity-fueling-log`
- URL: `https://192.168.178.46:5175/plan/activity/3a77af7f-3ece-40ea-8879-c6d878519c61#activity-fueling-log`

Manual question:

> Welche echte Magenreaktion hattest du bei diesem vorhandenen langen Carb-Log?

Options:

- `ok` = Magen ok
- `mild_issue` = Magen leicht unruhig
- `issue` = Magenprobleme

Rules:

- Use the Activity Fueling UI for normal evidence capture.
- Do not edit database rows directly.
- GI comfort must come from the real stomach response.
- Do not infer GI comfort from notes, route, RPE, carbs per hour, result, pace or how the workout looks afterward.
- After saving this target, another existing completion candidate remains.
- Rerun after save: `npm run audit:fueling-gate -- --today 2026-05-22`

Second existing completion candidate:

- Activity: `2026-05-04 - Datteln - Radfahren - Z2 - 80min - bike - 80 min - 30 g carbs (23 g/h)`
- URL: `https://192.168.178.46:5175/plan/activity/4f4b873d-bb64-4410-8e63-a382e9729863#activity-fueling-log`
- Missing: GI comfort

## iPhone/PWA Next Prompt

iPhone/PWA field evidence remains gated:

- Evidence file: `docs/qa/2026-05-02-iphone-pwa-real-device.md`
- Expected current commit: `b9de0fe`
- Server commit under test in latest field record: `9e05189`
- First open gap: current-main field evidence is stale

Next action:

1. Verify the server mirror first: `PULSE_EXPECTED_COMMIT=b9de0fe npm run verify:server`
2. If SSH fails before server checks: `PULSE_EXPECTED_COMMIT=b9de0fe npm run verify:server -- --packet`
3. Print the field scaffold: `npm run audit:iphone-pwa-gate -- --expected-commit b9de0fe --scaffold`
4. Rerun after recording: `npm run audit:iphone-pwa-gate -- --expected-commit b9de0fe`

Rules:

- Use a real iPhone over the VPN/local network path.
- Simulated WebKit or Chromium evidence does not close this gate.
- Record Device, iOS version and Server commit under test in the Scope section.
- Never transfer `rootCA-key.pem` or any `*-key.pem` file to the phone.
- Append the field run to `docs/qa/2026-05-02-iphone-pwa-real-device.md`.

## Follow-Up

After manual Fueling evidence is captured, rerun:

```bash
npm run audit:performance-gates -- --today 2026-05-22
```

If the first two GI comfort targets are complete, use the generated future-log checklist:

```bash
npm run audit:fueling-gate -- --today 2026-05-22 --new-log-checklist
```
