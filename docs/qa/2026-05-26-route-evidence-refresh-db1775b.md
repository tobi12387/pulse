# 2026-05-26 Route Evidence Refresh at db1775b

## Purpose

Refresh the route evidence after the route-wide top-app UI/UX pass and the iPhone field-runtime tooling update. Product coding is still evidence-gated, so this pass checks whether fresh desktop/mobile screenshots reveal a concrete UI/UX regression or route friction that justifies a new slice.

## Commands

```bash
npm ci
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/2026-05-26-db1775b-post-redesign npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-05-26-db1775b-post-redesign
npm run audit:performance-gates -- --today 2026-05-26
```

First route-evidence attempt in the fresh worktree failed before UI evaluation because the Shared workspace had not been built after `npm ci`; Vite could not resolve `@coaching-os/shared/*`. The QA scripts now build `shared` before route capture, and the rerun passed.

## Evidence Path

```text
test-results/route-evidence/2026-05-26-db1775b-post-redesign/2026-05-26-db1775b/
```

Summary:

- `desktop-chromium`: 9 screenshots, 0 horizontal overflow.
- `mobile-chromium`: 17 screenshots, 0 horizontal overflow.

## Manual Review

- Desktop Home keeps the command-app structure readable: side navigation, compact status, daily decision and readiness evidence remain visible without horizontal pressure.
- Mobile Home stays action-first in the first viewport; the daily answer, primary CTA and readiness block fit without overflow.
- Mobile Data Fueling action now mirrors the active gate shape in route evidence: `0/3 komplett`, `2 vorhandene Logs direkt schließbar`, then `1 neuer Long-Session-Log`; the CTA remains in viewport.
- Activity Fueling deep link keeps the GI-comfort action and all three structured GI options visible above the bottom nav.
- Mobile Plan scenario preview preserves the no-hidden-write contract and keeps `Vorschau anwenden` and `Abbrechen` visible without bottom-nav overlap.
- Settings remains readable in the first viewport; the iPhone/PWA field gate is still a manual evidence gate and not closed by this simulated route pack.

## Conclusion

No new UI/UX implementation slice is justified from this evidence alone. The current autonomous blockers remain:

- Fueling learning: record real GI comfort for the existing long carb logs, starting with the current `audit:performance-gates` first target.
- iPhone/PWA field: rerun the real-device checklist against the current clean-main audit commit and record the app runtime commit from Settings.

Keep future UI/UX work tied to a fresh route/user-friction finding, not aesthetic polish alone.
