# Mobile Route Tab Rail - 2026-05-22

Branch: `codex/performance-ux-friction-2`
Track: UI/UX evidence support

## Trigger

Tobi asked to continue the UI/UX redesign with freedom to redefine cards and
routes where useful. Fresh route evidence after the deployed redesign showed no
horizontal overflow, but the mobile Data and Plan route tabs still read as
separate boxed content before the actual daily task or weekly decision.

## Before Evidence

Commands:

```bash
npm run audit:performance-gates -- --today 2026-05-22 --local-planning
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-22-ux-friction-2-baseline npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-22-ux-friction-2-baseline
```

Summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Performance gates stayed manual: Fueling GI comfort first, then iPhone/PWA
  field evidence against deployed runtime `da38f07`.

Manual review:

- `mobile-chromium/03-data.png`: the four Data tabs were stable and visible,
  but looked like four heavy mini cards competing with the first Data action.
- `mobile-chromium/06-plan.png`: the five Plan tabs had the same boxed weight
  directly above the weekly decision surface.

## Change

- Mobile route tabs now render as one light pill rail with a single active
  surface instead of individual boxed tabs.
- The 44px touch target remains intact, all labels stay in the visible viewport,
  and desktop route tabs keep the existing segmented-control treatment.
- Added a Plan mobile subnavigation smoke so both Data and Plan route tabs stay
  visible in narrow viewport checks.

## After Evidence

Focused mobile proof:

```bash
PULSE_ROUTE_EVIDENCE=true PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-22-ux-friction-2-tabs npx playwright test frontend/e2e/route-evidence.spec.ts --project=mobile-chromium
npm run qa:ux-summary -- /tmp/pulse-2026-05-22-ux-friction-2-tabs
npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=mobile-chromium -g "Data mobile subnavigation|Data mobile deep links|Plan mobile subnavigation"
```

Result:

- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Focused mobile tab/deep-link smokes: 3 passed.
- Reviewed screenshots:
  - `/tmp/pulse-2026-05-22-ux-friction-2-tabs/2026-05-22-da38f07/mobile-chromium/03-data.png`
  - `/tmp/pulse-2026-05-22-ux-friction-2-tabs/2026-05-22-da38f07/mobile-chromium/06-plan.png`

Full route proof:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-22-ux-friction-2-final npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-22-ux-friction-2-final
```

Result:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.

## Conclusion

This is a small route-wide Redesign follow-up, not a new product-logic package.
Data and Plan keep the same information architecture and deep links, but mobile
route switching now behaves like navigation chrome instead of another content
card. The next true Performance-OS unblock remains manual Fueling GI-comfort
capture followed by current iPhone/PWA field evidence.
