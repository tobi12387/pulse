# 2026-05-21 - iPhone WebKit Stage Strip Evidence

## Trigger

Current-main iPhone WebKit evidence on `0fbc316` passed the automated gate, but
manual screenshot review showed the Home stage strip cramping the active
`01 DECIDE - JETZT` label in the first iPhone viewport. This was a concrete
iPhone/PWA readability issue, not a broad product-package unlock.

## Change

- Kept the three-stage strip stable at three equal segments.
- Let the active `JETZT` status wrap onto its own line inside the active segment.
- Added a mobile Playwright assertion that the active status stays inside its
  segment bounds.

## Verification

- Branch: `codex/iphone-pwa-current-evidence`
- Commit with fix: `9b6c7d7`
- Focused mobile check:

```bash
PULSE_E2E_WEBKIT=true npx playwright test frontend/e2e/pulse-usability.spec.ts -g "Mobile navigation and tabs keep core labels readable" --project=iphone-webkit --project=mobile-chromium
```

Result: 2 passed.

- Bounded iPhone WebKit PWA gate:

```bash
PULSE_E2E_WEBKIT=true npm run test:e2e -- --project=iphone-webkit --grep "PWA|service workers|Mobile navigation|Settings PWA diagnostics|renders"
```

Result: 14 passed.

- Frontend build:

```bash
npm run build -w frontend
```

Result: passed.

- Screenshot pack:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-21-iphone-webkit-stage-strip-9b6c7d7 npm run qa:ux-evidence:iphone
npm run qa:ux-summary -- /tmp/pulse-2026-05-21-iphone-webkit-stage-strip-9b6c7d7
```

Result:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- iPhone WebKit: 9 screenshots, 0 horizontal overflow.
- Evidence root: `/tmp/pulse-2026-05-21-iphone-webkit-stage-strip-9b6c7d7/2026-05-21-9b6c7d7/`

Reviewed screenshot:

- Home iPhone WebKit after fix: `/tmp/pulse-2026-05-21-iphone-webkit-stage-strip-9b6c7d7/2026-05-21-9b6c7d7/iphone-webkit/01-home.png`

Finding:

- `01 DECIDE` and `JETZT` stay readable inside the first stage segment.
- Home, Data, Plan and Settings keep their first-viewport mobile structure and no horizontal overflow is recorded.

## Product Conclusion

The simulated iPhone WebKit gate remains green after the Home stage strip fix.
This does not replace the real iPhone/VPN/PWA field gate: certificate trust,
Push activation and offline behavior still need real-device evidence.
