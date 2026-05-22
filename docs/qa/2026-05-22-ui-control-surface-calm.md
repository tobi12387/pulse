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
- Follow-up: changed Settings diagnostics from a nested card-like matrix into a flatter readiness surface with calmer shared action buttons and opt-in diagnostic detail.
- Follow-up: compacted the Coach compatibility route on mobile and restored 44px touch targets for mobile Data tabs and Plan week navigation.
- Review hardening: increased mobile Coach metric label/value size after review so the compact context strip stays readable without reintroducing horizontal overflow.

## After Evidence

- Final evidence root: `/tmp/pulse-2026-05-22-ux-friction-final2/2026-05-22-639662b/`
- Final summary:
  - desktop-chromium: 9 screenshots, 0 overflow
  - mobile-chromium: 17 screenshots, 0 overflow

Focused screenshots reviewed:

- Mobile Home: `/tmp/pulse-2026-05-22-ux-friction-final2/2026-05-22-639662b/mobile-chromium/01-home.png`
- Mobile Plan: `/tmp/pulse-2026-05-22-ux-friction-final2/2026-05-22-639662b/mobile-chromium/06-plan.png`
- Mobile Data Fueling: `/tmp/pulse-2026-05-22-ux-friction-final2/2026-05-22-639662b/mobile-chromium/15-data-fueling-action.png`

## Settings Follow-Up Evidence

- Evidence root: `/tmp/pulse-2026-05-22-ux-settings-readiness/2026-05-22-35f1452/`
- Summary:
  - desktop-chromium: 9 screenshots, 0 overflow
  - mobile-chromium: 17 screenshots, 0 overflow

Focused screenshots reviewed:

- Mobile Settings: `/tmp/pulse-2026-05-22-ux-settings-readiness/2026-05-22-35f1452/mobile-chromium/09-settings.png`
- Desktop Settings: `/tmp/pulse-2026-05-22-ux-settings-readiness/2026-05-22-35f1452/desktop-chromium/09-settings.png`

## Coach Follow-Up Evidence

- Evidence root: `/tmp/pulse-2026-05-22-ux-coach-command/2026-05-22-3c462a1/`
- Summary:
  - desktop-chromium: 9 screenshots, 0 overflow
  - mobile-chromium: 17 screenshots, 0 overflow

Focused screenshots reviewed:

- Mobile Coach: `/tmp/pulse-2026-05-22-ux-coach-command/2026-05-22-3c462a1/mobile-chromium/02-coach.png`
- Mobile Data: `/tmp/pulse-2026-05-22-ux-coach-command/2026-05-22-3c462a1/mobile-chromium/03-data.png`
- Mobile Plan: `/tmp/pulse-2026-05-22-ux-coach-command/2026-05-22-3c462a1/mobile-chromium/06-plan.png`

## PR Review Hardening Evidence

- Evidence root: `/tmp/pulse-2026-05-22-ux-pr683-readability/2026-05-22-4081fd4/`
- Summary:
  - desktop-chromium: 9 screenshots, 0 overflow
  - mobile-chromium: 17 screenshots, 0 overflow

## Verification

- `git diff --check`
- `npm run verify:trainingsanpassung`
- `npm run verify:lernschleifen`
- `npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts -g "Mobile navigation and tabs keep core labels readable|Mobile routes avoid unintended horizontal overflow" --project=mobile-chromium`
- `npm run test:e2e -- frontend/e2e/ux-auth-settings.spec.ts frontend/e2e/pulse-usability.spec.ts -g "Settings diagnostics matrix|Settings uses desktop width|Settings treats blocked push|Settings diagnostics matrix separates|Settings groups actions|Mobile navigation and tabs keep core labels readable" --project=mobile-chromium --project=desktop-chromium`
- `npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts -g "Coach daily briefing guides the first conversation without auto-send|Coach quick prompts prepare a question without sending it|Coach prompt deep links prepare a draft without sending it|Coach action deep links remain compatible without a prompt|Daily loop keeps context from Home to Coach, Plan and evidence tabs|Mobile routes avoid unintended horizontal overflow|Mobile repeated controls have reliable touch targets" --project=mobile-chromium --project=desktop-chromium`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-22-ux-friction-final2 npm run qa:ux-evidence`
- `npm run qa:ux-summary -- /tmp/pulse-2026-05-22-ux-friction-final2`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-22-ux-settings-readiness npm run qa:ux-evidence`
- `npm run qa:ux-summary -- /tmp/pulse-2026-05-22-ux-settings-readiness`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-22-ux-coach-command npm run qa:ux-evidence`
- `npm run qa:ux-summary -- /tmp/pulse-2026-05-22-ux-coach-command`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-22-ux-pr683-readability npm run qa:ux-evidence`
- `npm run qa:ux-summary -- /tmp/pulse-2026-05-22-ux-pr683-readability`
