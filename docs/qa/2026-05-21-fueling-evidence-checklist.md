# 2026-05-21 - Fueling Evidence Checklist

## Trigger

The first open Performance-OS unblock is Fueling learning. The audits already
named the target activity, accepted GI comfort values and completion candidates,
but the manual capture flow did not have a dedicated checklist like the server
SSH recovery path.

## Change

- Added `docs/ai/checklists/fueling-evidence-capture.md`.
- Made `npm run audit:fueling-gate` print the checklist beside the next action.
- Made `npm run audit:performance-next` expose the same checklist in text and
  JSON as `metadata.evidenceChecklist`.
- Kept the gate strict: no inferred GI comfort, no direct DB edit path and no
  nutrition trend unlock without three comparable complete `during` logs.

## Verification

- `node --test scripts/fueling-gate-audit.test.mjs`
- `node --test scripts/performance-gates-audit.test.mjs`
- `npm run audit:fueling-gate -- --today 2026-05-21`
- `npm run audit:performance-next -- --today 2026-05-21`
- `npm run audit:performance-next -- --today 2026-05-21 --json`

Live audit result remains gated:

- 0/3 comparable complete Fueling logs.
- 2 existing logs completable now by adding structured GI comfort.
- 1 new complete long-session log still needed after those candidates.

## Product Conclusion

This is tooling support for the MacroFactor-style nutrition learning loop. It
does not add nutrition conclusions; it makes the next manual evidence step
harder to lose between sessions.
