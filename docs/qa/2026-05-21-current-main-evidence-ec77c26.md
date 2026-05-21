# 2026-05-21 - Current Main Evidence ec77c26

## Trigger

`main` now includes the Fueling completion-candidate app/audit handoff from
PR #586 and the compact current-focus refresh from PR #587. This pass refreshes
route, gate and ops evidence before opening any new Performance-OS product
slice.

## Route Evidence

- Branch: `codex/route-evidence-next-friction`
- Commit: `ec77c26`
- Command: `npm run qa:ux-evidence`
- Summary command: `npm run qa:ux-summary -- test-results/route-evidence`
- Evidence root: `test-results/route-evidence/2026-05-21-ec77c26/`

Result:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Route pack passed for Home, Coach compatibility route, Data, Plan, Activity
  Detail, Insights and Settings.
- Mobile Daily Command scenarios passed for planned workout, free trainable day,
  completed Garmin activity, recovery-protect day, Data Mental first viewport,
  Data Fueling action, Activity Fueling anchor and Plan mobile scenario preview.

Reviewed screenshots:

- Home first decision:
  `test-results/route-evidence/2026-05-21-ec77c26/mobile-chromium/01-home.png`
- Data Mental first viewport:
  `test-results/route-evidence/2026-05-21-ec77c26/mobile-chromium/14-data-mental-first-viewport.png`
- Data Fueling primary action:
  `test-results/route-evidence/2026-05-21-ec77c26/mobile-chromium/15-data-fueling-action.png`
- Activity Fueling anchor:
  `test-results/route-evidence/2026-05-21-ec77c26/mobile-chromium/16-activity-fueling-anchor.png`
- Plan mobile intent scenario:
  `test-results/route-evidence/2026-05-21-ec77c26/mobile-chromium/17-plan-mobile-intent-scenario.png`

Findings:

- Home remains action-first on mobile and keeps the current learning signal in
  user-facing language (`Lernschleife` / `Muster pruefen`).
- Data keeps `Fueling-Evidenz schliessen` as the primary action and labels the
  Fueling trend gate as `0/3`.
- Activity Detail opens the Fueling log area with the missing GI comfort choice
  group visible and focused.
- Plan mobile scenario preview keeps `Nur Vorschau`, no-hidden-write copy and
  conscious apply/cancel controls visible.
- No horizontal overflow or concrete route friction was found.

## Gate Evidence

Commands:

```bash
npm run audit:performance-next -- --today 2026-05-21
npm run audit:performance-gates -- --today 2026-05-21
npm run audit:iphone-pwa-gate
PULSE_EXPECTED_COMMIT=ec77c26 npm run verify:server
```

Result:

- Overall Performance-OS gate: `gated`, with 3 open gates.
- Next unblock: Fueling learning.
- Fueling: 0/3 comparable complete logs; 2 existing logs completable now; 1 new
  complete long-session log still needed after candidates.
- First Fueling target: 2026-05-09 Datteln Graveln,
  `/plan/activity/3a77af7f-3ece-40ea-8879-c6d878519c61#activity-fueling-log`,
  missing GI comfort.
- Second Fueling candidate: 2026-05-04 Datteln - Radfahren - Z2 · 80min,
  `/plan/activity/4f4b873d-bb64-4410-8e63-a382e9729863#activity-fueling-log`,
  missing GI comfort.
- Accepted GI comfort values remain `ok`, `mild_issue` and `issue`.
- iPhone/PWA field gate remains open for warning-free certificate trust, Push
  activation/test push, real iPhone VPN/network offline fallback and device/iOS
  metadata.
- Server mirror verification still fails at SSH preflight with
  `Permission denied (publickey,password)`.

## Product Conclusion

Do not open a new UI/UX implementation slice from this evidence alone. Current
routes are readable and overflow-free, and the remaining Performance-OS product
themes are still blocked by real Fueling evidence, real iPhone/PWA field proof
or restored server SSH/deploy access.
