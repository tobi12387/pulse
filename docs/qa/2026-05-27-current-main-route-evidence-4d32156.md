# Current Main Route Evidence 4d32156

## Scope

Fresh current-main route evidence after the compact Performance gate session-card tooling landed. This is an evidence-capture slice only: it checks whether the latest deployed/product UI state creates a new ungated UI/UX implementation slice.

The current Performance-OS blockers remain manual Fueling GI comfort evidence and real iPhone/PWA field evidence. No product coding is justified unless this route evidence shows concrete route friction or a manual gate opens.

## Commands

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-27-current-main-4d32156 npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-27-current-main-4d32156
npm run audit:performance-gates -- --today 2026-05-27
npm run audit:performance-session -- --today 2026-05-27
```

## Route Evidence Summary

- commit: `4d32156`
- desktop Chromium: 9 screenshots, 0 horizontal overflow
- mobile Chromium: 17 screenshots, 0 horizontal overflow
- evidence root: `/tmp/pulse-2026-05-27-current-main-4d32156`
- mobile manifest: `/tmp/pulse-2026-05-27-current-main-4d32156/2026-05-27-4d32156/mobile-chromium/manifest.json`
- desktop manifest: `/tmp/pulse-2026-05-27-current-main-4d32156/2026-05-27-4d32156/desktop-chromium/manifest.json`

## Manual Review

Reviewed mobile:

- `01-home.png`: primary Home decision remains action-first; no overlap in the first viewport.
- `03-data.png`: default Data action is readable and compact; no route-tab overflow.
- `06-plan.png`: weekly decision remains visible with preview-first copy and no hidden-write implication.
- `09-settings.png`: iPhone field proof and Push readiness remain visible in the first Settings section.
- `15-data-fueling-action.png`: Fueling action shows the target log, GI CTA, allowed choices, manual rule and remaining candidates in the intended order.
- `16-activity-fueling-anchor.png`: Activity Fueling anchor lands on the GI comfort choice group and still states that Plan/Garmin remain unchanged.
- `17-plan-mobile-intent-scenario.png`: scenario preview stays explicit that it is preview-only before apply.

Reviewed desktop route pack at a summary level; no horizontal overflow or first-viewport regression was recorded.

## Current Gates

`npm run audit:performance-gates -- --today 2026-05-27` still reports:

- Gate: gated
- Open gates: 2
- Expected server commit: `4d32156`
- Next unblock: Fueling learning
- First target: `2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs (54 g/h)`
- First target URL: `https://192.168.178.46:5175/plan/activity/3a77af7f-3ece-40ea-8879-c6d878519c61#activity-fueling-log`
- Allowed GI comfort options: `ok=Magen ok`, `mild_issue=Magen leicht unruhig`, `issue=Magenprobleme`

`npm run audit:performance-session -- --today 2026-05-27` now renders the compact manual handoff card from clean `main`, without feature-branch local-planning mode.

## Conclusion

No new UI/UX implementation slice is justified from this evidence. The next product-unblocking action is still manual: choose the real GI comfort value for the existing long carb logs, then capture one future complete long-session log. The iPhone/PWA field run remains the second manual gate and must be recorded against the current expected commit.
