# Current Main Route Evidence dda3d77

## Scope

Fresh current-main route evidence after the targeted Performance session-card
tooling landed in PR #725. This is an evidence-capture slice only: it checks
whether the latest `main` UI state creates a new ungated UI/UX implementation
slice.

The current Performance-OS blockers remain manual Fueling GI comfort evidence
and real iPhone/PWA field evidence. No product coding is justified unless this
route evidence shows concrete route friction or a manual gate opens.

## Commands

```bash
npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence
npm run audit:performance-gates -- --today 2026-05-27
npm run audit:performance-session -- --today 2026-05-27 --gate iphone_pwa
```

## Route Evidence Summary

- commit: `dda3d77`
- evidence root: `/root/pulse/test-results/route-evidence/2026-05-27-dda3d77`
- desktop Chromium: 9 screenshots, 0 horizontal overflow
- desktop manifest: `/root/pulse/test-results/route-evidence/2026-05-27-dda3d77/desktop-chromium/manifest.json`
- mobile Chromium: 17 screenshots, 0 horizontal overflow
- mobile manifest: `/root/pulse/test-results/route-evidence/2026-05-27-dda3d77/mobile-chromium/manifest.json`

## Manual Review

Reviewed mobile:

- `01-home.png`: primary Home decision, CTA and readiness state remain visible
  in the first viewport; the lower timeline continues below the fixed nav
  without creating horizontal overflow.
- `06-plan.png`: weekly decision surface remains preview-first, with the local
  evidence action and `Plan/Garmin unveraendert` contract visible before deeper
  detail.
- `07-activity-detail.png`: Activity closure starts with RPE/load context and a
  direct Fueling check, while the lower Fueling section remains reachable.
- `09-settings.png`: iPhone field proof and Push readiness remain visible in
  the first Settings section.
- `15-data-fueling-action.png`: Data still leads the Fueling evidence gap with
  target log, GI CTA, allowed choices, manual rule and directly closable logs.
- `16-activity-fueling-anchor.png`: the Activity Fueling anchor lands on the GI
  comfort choice group and repeats that Plan/Garmin stay unchanged.
- `17-plan-mobile-intent-scenario.png`: mobile intent still opens a preview-only
  scenario, not a hidden Plan or Garmin write.

Reviewed desktop route pack at a summary level; no horizontal overflow or
first-viewport regression was recorded.

## Current Gates

`npm run audit:performance-gates -- --today 2026-05-27` reports:

- Gate: gated
- Open gates: 2
- Expected server commit: `dda3d77`
- Server deploy mirror: ready
- Next unblock: Fueling learning
- First target: `2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs (54 g/h)`
- First target URL: `https://192.168.178.46:5175/plan/activity/3a77af7f-3ece-40ea-8879-c6d878519c61#activity-fueling-log`
- Allowed GI comfort options: `ok=Magen ok`, `mild_issue=Magen leicht unruhig`,
  `issue=Magenprobleme`

`npm run audit:performance-session -- --today 2026-05-27 --gate iphone_pwa`
now renders the compact iPhone/PWA card from clean `main` against commit
`dda3d77`, while the default unpinned session card still starts with Fueling.

## Conclusion

No new UI/UX implementation slice is justified from this evidence. The next
product-unblocking action is still manual: choose the real GI comfort value for
the existing long carb logs, then capture one future complete long-session log.
The iPhone/PWA field run remains the second manual gate and must be recorded
against the current expected commit.
