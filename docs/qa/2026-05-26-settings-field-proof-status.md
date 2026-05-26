# Settings Field-Proof Status - 2026-05-26

Branch: `codex/settings-field-proof-status`
Track: platform reliability support / UI evidence support

## Why

Fresh post-redesign route evidence on `df62f96` showed no horizontal overflow, but the Settings first viewport said `Kern bereit` while the current Performance-OS audit still had the iPhone/PWA field gate open. The compact `Feldnachweis` card existed lower in the device section, but the first setup status did not make the current manual iPhone evidence work visible.

This is not a new product package and does not close the iPhone/PWA gate. It makes the existing manual field proof easier to find from Settings.

## Before Evidence

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-26-post-redesign-gate-evidence npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-26-post-redesign-gate-evidence
npm run audit:performance-gates -- --today 2026-05-26
```

- Route evidence: 9 desktop and 17 mobile screenshots, 0 horizontal overflow.
- Server mirror gate: ready at `df62f96`.
- iPhone/PWA gate: gated; current field evidence still tested `9e05189` while expected commit was `df62f96`.
- Settings first viewport showed only optional Push in the setup summary; the iPhone/PWA field proof required scrolling or opening the device section.

## Change

- Add `iPhone-Feldnachweis` as an optional setup status row.
- Keep it non-blocking: `Kern bereit` remains true when access, service worker and Garmin are usable.
- Link the row directly to `/settings?section=device`, where the existing `Feldnachweis` card shows App-Stand, device/iOS, launch mode and the manual field-run order.
- Keep Push as a separate optional device action.

## Verification

```bash
git diff --check
npm run build -w shared
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Settings diagnostics matrix is visible first|Settings treats blocked push"
npm run build -w frontend
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-26-settings-field-proof-status npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-26-settings-field-proof-status
```

- Focused Settings tests: 4 passed across desktop and mobile Chromium.
- Frontend build: passed.
- Route evidence after the change: 9 desktop and 17 mobile screenshots, 0 horizontal overflow.
- Screenshots reviewed:
  - `/tmp/pulse-2026-05-26-settings-field-proof-status/2026-05-26-df62f96/desktop-chromium/09-settings.png`
  - `/tmp/pulse-2026-05-26-settings-field-proof-status/2026-05-26-df62f96/mobile-chromium/09-settings.png`

## Remaining Gates

The next real Performance-OS unblock remains manual evidence capture:

- Fueling learning: choose real structured GI comfort for the existing 2026-05-09 and 2026-05-04 long carb logs, then add one new complete long-session log.
- iPhone/PWA field: rerun the real iPhone checklist against the current expected commit from `npm run audit:performance-gates -- --today <YYYY-MM-DD>`.
