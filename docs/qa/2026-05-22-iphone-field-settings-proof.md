# iPhone Field Settings Proof - 2026-05-22

Branch: `codex/iphone-field-settings`
Track: iPhone/PWA evidence support

## Trigger

The combined Performance-OS audit still gates iPhone/PWA readiness on current
real-device evidence. The latest open gaps include stale commit evidence,
missing device/iOS metadata, certificate trust follow-up, Push activation/test
push and the real offline fallback check.

## Change

- The frontend build now exposes the short Git commit as the app build marker.
- Settings -> iPhone & PWA shows a compact `Feldnachweis` block with:
  - `App-Stand`
  - device label
  - iOS field value when the browser exposes it, otherwise `manuell erfassen`
  - launch mode (`Browser` or `Home Screen`)
  - the still-manual checks: certificate, Push test and offline.
- The block does not close the iPhone/PWA gate by itself. It makes the next
  field record easier to capture from the iPhone while preserving the real
  manual proof boundary.

## Verification

```bash
npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Settings PWA field proof exposes the current manual evidence scope"
npm run delivery:manifest -- --files frontend/vite.config.ts frontend/src/vite-env.d.ts frontend/src/features/settings/push/push-components.tsx frontend/e2e/pulse-smoke.spec.ts docs/qa/2026-05-22-iphone-field-settings-proof.md docs/decisions.md docs/ai/current-focus.md
npm run build -w frontend
npm run test:e2e:smoke
```

Result:

- Desktop Chromium: passed.
- Mobile Chromium: passed.
- Delivery manifest: Fast Lane runtime support, deploy required after merge.
- Frontend build: passed.
- Full desktop/mobile smoke suite: 108 passed, 14 skipped.
- Asserted the Settings iPhone/PWA field proof exposes `App-Stand`,
  device, iOS, launch mode and the still-manual certificate/Push/offline checks.
- Asserted the field proof stays in viewport and has no text overflow.

## Conclusion

This is capture support, not field evidence. The next current iPhone field run
still needs `npm run audit:iphone-pwa-gate -- --expected-commit <commit>
--scaffold` or the combined Performance-OS packet, plus a real-device record in
`docs/qa/2026-05-02-iphone-pwa-real-device.md`.
