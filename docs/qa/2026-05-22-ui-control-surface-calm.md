# UI Control Surface Calm — 2026-05-22

Branch: `codex/performance-ux-friction`

## Intake

- User friction: Tobi asked for continued UI/UX redesign freedom, including redefining cards and routes where useful.
- Before evidence: `/tmp/pulse-2026-05-22-ux-friction-baseline/2026-05-22-639662b/`
- Before summary: 9 desktop screenshots, 17 mobile screenshots, 0 horizontal overflow.

Manual review of the before screenshots found no hard layout break, but a real mobile clarity issue: Home stage tabs, route tabs and secondary detail buttons still read as heavy boxed content competing with the primary action.

## Change

- Lightened route-wide surface tokens, card borders and shadows.
- Changed mobile segmented controls from a single heavy container into individual compact control buttons.
- Made the Home stage strip a compact command rail on mobile.
- Reduced visual weight of action-detail buttons and Data secondary actions.
- Kept mobile Plan option detail accessible through explicit `aria-label` while removing the visually hidden 1px text blocks from overflow checks.

## After Evidence

- Final evidence root: `/tmp/pulse-2026-05-22-ux-friction-final2/2026-05-22-639662b/`
- Final summary:
  - desktop-chromium: 9 screenshots, 0 overflow
  - mobile-chromium: 17 screenshots, 0 overflow

Focused screenshots reviewed:

- Mobile Home: `/tmp/pulse-2026-05-22-ux-friction-final2/2026-05-22-639662b/mobile-chromium/01-home.png`
- Mobile Plan: `/tmp/pulse-2026-05-22-ux-friction-final2/2026-05-22-639662b/mobile-chromium/06-plan.png`
- Mobile Data Fueling: `/tmp/pulse-2026-05-22-ux-friction-final2/2026-05-22-639662b/mobile-chromium/15-data-fueling-action.png`

## Verification

- `git diff --check`
- `npm run verify:trainingsanpassung`
- `npm run verify:lernschleifen`
- `npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts -g "Mobile navigation and tabs keep core labels readable|Mobile routes avoid unintended horizontal overflow" --project=mobile-chromium`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-22-ux-friction-final2 npm run qa:ux-evidence`
- `npm run qa:ux-summary -- /tmp/pulse-2026-05-22-ux-friction-final2`
