# 2026-05-21 — iPhone WebKit Evidence at 32a33b8

## Scope

- Current `main` commit under simulated iPhone/WebKit evidence: `32a33b8`.
- Purpose: refresh the optional WebKit/PWA proof while real iPhone/PWA field
  evidence remains manually gated.
- Evidence root:
  `test-results/route-evidence/2026-05-21-32a33b8`.

## Commands

```bash
npm run qa:ux-evidence:iphone
npm run qa:ux-summary -- test-results/route-evidence/2026-05-21-32a33b8
PULSE_E2E_WEBKIT=true npm run test:e2e -- --project=iphone-webkit --grep "PWA|service workers|Mobile navigation|Settings PWA diagnostics|renders"
```

## Result

- Desktop Chromium route evidence: 9 screenshots, 0 horizontal overflow.
- iPhone WebKit route evidence: 9 screenshots, 0 horizontal overflow.
- Bounded iPhone WebKit smoke: 14/14 passed.

## Manual Review

- `iphone-webkit/01-home.png`: Home keeps one primary daily decision card
  readable in the simulated iPhone viewport.
- `iphone-webkit/03-data.png`: Data keeps the primary action card readable.
- `iphone-webkit/06-plan.png`: Plan keeps the weekly decision preview visible
  and does not imply hidden writes.
- `iphone-webkit/07-activity-detail.png`: Activity Detail remains readable in
  the iPhone viewport.
- `iphone-webkit/09-settings.png`: Settings diagnostics remain readable and
  WebKit correctly reports unsupported Push behavior in this simulated context.

## Conclusion

No iPhone/WebKit implementation slice is justified from this pass. This evidence
supports the current PWA/browser surface, but it does not close the real-device
iPhone/PWA field gate. The real gate still requires a physical iPhone run
against current deployed `main`, including device/iOS metadata, certificate
trust, Push activation/test-push evidence and offline fallback evidence.
