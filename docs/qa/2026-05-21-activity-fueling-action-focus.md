# 2026-05-21 — Activity Fueling Action Focus

## Evidence

- Branch: `codex/activity-fueling-action-focus`
- Before evidence: `docs/qa/2026-05-21-current-main-route-evidence.md`
- Focused command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-21-activity-fueling-action-focus PULSE_ROUTE_EVIDENCE=true npx playwright test frontend/e2e/route-evidence.spec.ts --project=mobile-chromium`
- Summary command: `npm run qa:ux-summary -- /tmp/pulse-2026-05-21-activity-fueling-action-focus`
- Full route command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-21-activity-fueling-action-focus-full npm run qa:ux-evidence`
- Full route summary: `npm run qa:ux-summary -- /tmp/pulse-2026-05-21-activity-fueling-action-focus-full`

## Finding

The Data Fueling action correctly routed to `/plan/activity/:id#activity-fueling-log`, but mobile evidence only proved that the Fueling card was focused. The actual GI comfort choices could sit below the first focused area, so the smallest closure step was not guaranteed to be immediately actionable after the handoff.

## Change

- Keep existing `#activity-fueling-log` links stable.
- When the open evidence gap is GI comfort, Activity Detail now scrolls and focuses the GI comfort action group after nutrition evidence has loaded.
- If no GI comfort action is open, the same hash focuses the evidence-quality block before falling back to the Fueling card.
- Route evidence now asserts that `activity-gi-comfort-action` is focused and that the `Magen ok` choice is in the mobile viewport.

## Verification

- Focused mobile route evidence passed with 17 screenshots and 0 horizontal overflow.
- Full desktop/mobile route evidence passed with 9 desktop screenshots, 17 mobile screenshots and 0 horizontal overflow.
- `npm run verify:tagesentscheidung:pr` passed: 38 contract/golden tests plus frontend build.
- `git diff --check` passed.

## Product Conclusion

This is a narrow closure-path fix for the MacroFactor-style Fueling learning loop. It does not unlock nutrition trend summaries; the real trend gate still requires three comparable complete `during` logs with duration/activity context, carbs and GI comfort.
