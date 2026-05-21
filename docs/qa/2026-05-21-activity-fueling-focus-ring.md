# 2026-05-21 — Activity Fueling Focus Ring

## Scope

- Current-main route evidence on `47943ff` captured the Activity Fueling deep
  link target with no horizontal overflow, but the focused GI comfort action used
  Chromium's default focus ring on mobile.
- The default ring was visually heavier than the local Pulse focus treatment and
  sat over the GI action copy/buttons.
- The fix reuses the existing `.evidence-section:focus` treatment for the
  focused GI comfort action target.

## Evidence

Before:

```text
test-results/route-evidence/2026-05-21-47943ff/mobile-chromium/16-activity-fueling-anchor.png
```

After:

```text
test-results/route-evidence-focus-fix/2026-05-21-47943ff/mobile-chromium/16-activity-fueling-anchor.png
```

## Verification

```bash
npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-05-21-47943ff
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence-focus-fix npm run qa:ux-evidence -- --project=mobile-chromium
npm run qa:ux-summary -- test-results/route-evidence-focus-fix/2026-05-21-47943ff
```

Result: 9 desktop and 17 mobile screenshots were captured before and after; both
runs reported 0 horizontal overflow. The after screenshot shows the Activity
Fueling GI target with the Pulse accent focus outline instead of the default
browser ring.
