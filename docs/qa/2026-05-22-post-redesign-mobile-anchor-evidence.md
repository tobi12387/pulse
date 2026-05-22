# 2026-05-22 - Post-Redesign Mobile Anchor Evidence

## Scope

Fresh route evidence was regenerated after the route-wide UI/UX redesign reached
`main` and was deployed.

- Commit: `d8010a6`
- Branch: `codex/post-redesign-route-evidence`
- Evidence root: `test-results/route-evidence/2026-05-22-d8010a6/`
- Projects: `desktop-chromium`, `mobile-chromium`

## Commands

```bash
npm run audit:performance-gates -- --today 2026-05-22 --local-planning
npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-05-22-d8010a6
git diff --check
```

The Performance gate audit used `--local-planning`, so server mirror
verification stayed deferred on the feature branch. The expected deployed
runtime commit for manual field work remains `d8010a6`.

## Route Evidence Summary

```text
# Route Evidence Summary

Root: /root/pulse/test-results/route-evidence/2026-05-22-d8010a6
Manifests: 2

## desktop-chromium (2026-05-22 - d8010a6)
- base: https://127.0.0.1:5173
- screenshots: 9
- overflow: 0
- manifest: /root/pulse/test-results/route-evidence/2026-05-22-d8010a6/desktop-chromium/manifest.json

## mobile-chromium (2026-05-22 - d8010a6)
- base: https://127.0.0.1:5173
- screenshots: 17
- overflow: 0
- manifest: /root/pulse/test-results/route-evidence/2026-05-22-d8010a6/mobile-chromium/manifest.json

No horizontal overflow recorded. Review the screenshots manually before opening a UI/UX implementation slice.
```

## Finding And Fix

Manual screenshot review found one post-redesign mobile friction point:

- `mobile-chromium/14-data-mental-first-viewport.png` initially landed the
  `#data-mental` deep link inside the Quick Check-in card, leaving the `Mental
  Check-in` context clipped above the sticky mobile topbar.
- Mobile anchor screenshots could also show old route content through the
  translucent top and bottom chrome, which made direct handoffs feel less
  clean than the new command-surface design.

Fix applied:

- The Data mental deep link now targets the complete mental task section,
  including the `Mental Check-in` context and the Quick Check-in card.
- Mobile app chrome now uses the solid surface color instead of translucent
  glass, so anchor jumps do not bleed previous content through the topbar or
  bottom navigation.
- Mobile evidence sections use a smaller scroll margin, keeping focused
  handoff targets close to the visible chrome without hiding headings.
- Route evidence now asserts that the mobile `Mental Check-in` heading lands
  below the fixed mobile topbar.

## Manual Screenshot Review

Reviewed the regenerated post-fix screenshots:

- `mobile-chromium/14-data-mental-first-viewport.png`: the `Mental Check-in`
  heading, context sentence, Quick Check-in choices and `Heute speichern`
  action are visible in one mobile handoff view.
- `mobile-chromium/15-data-fueling-action.png`: Data still leads with
  `Fueling-Evidenz schliessen`, a visible `GI-Komfort ergaenzen` CTA and
  `Trend-Evidenz 0/3`.
- `mobile-chromium/16-activity-fueling-anchor.png`: the Activity Fueling deep
  link still focuses the missing GI-comfort action group and shows all three
  structured stomach-response options.
- `mobile-chromium/17-plan-mobile-intent-scenario.png`: Plan scenario preview
  remains readable with `Nur Vorschau`, no-hidden-write copy and apply/cancel
  controls.
- `desktop-chromium/03-data.png` and `desktop-chromium/06-plan.png`: desktop
  Data and Plan did not pick up a layout or overflow regression.

## Gate State

The current Performance-OS blockers remain manual evidence gates:

1. Fueling learning: `0/3` comparable complete logs. The first existing target
   is
   `https://192.168.178.46:5175/plan/activity/3a77af7f-3ece-40ea-8879-c6d878519c61#activity-fueling-log`.
2. Allowed first GI-comfort options remain `ok=Magen ok`,
   `mild_issue=Magen leicht unruhig`, and `issue=Magenprobleme`.
3. iPhone/PWA field evidence must be rerun against deployed runtime commit
   `d8010a6`.

## Conclusion

The post-redesign route pass found and closed one concrete mobile deep-link
clarity issue. No broader product-logic package is unblocked yet; the next real
Performance-OS unlock remains Fueling GI-comfort capture followed by current
iPhone/PWA real-device evidence.
