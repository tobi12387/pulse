# 2026-05-26 Data Fueling Mobile CTA

## Scope

- Branch: `codex/current-route-evidence-251bf85`
- Base commit: `251bf85`
- Trigger: fresh route-evidence pass after the deployed manual Fueling safety support.

## Before Evidence

Command:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-26-current-route-evidence-251bf85 npm run qa:ux-evidence
```

Result:

- Desktop Chromium passed.
- Mobile Chromium failed on `/data` with the actionable Fueling gap.
- Failed assertion: `data-primary-action` button `GI-Komfort ergänzen` was not in the viewport.
- Failed screenshot: `test-results/route-evidence-Route-evide-aa556-utes-with-manifest-metadata-mobile-chromium/test-failed-1.png`

Observed friction:

- The safety copy was correct, but the card order put long follow-up details before the next click.
- On mobile, Tobi could read the Fueling rule but had to scroll before acting on the primary task.

## Change

- Moved the Data primary action CTA inside the action copy, before candidate-log and new-log details.
- Kept the target log, allowed GI choices, manual safety rule and capture plan above the CTA.
- Removed the duplicate `Manuelle Regel:` prefix from the body copy because the label already carries it.

## After Evidence

Commands:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-26-current-route-evidence-251bf85-fix PULSE_ROUTE_EVIDENCE=true npx playwright test frontend/e2e/route-evidence.spec.ts --project=mobile-chromium
npm run qa:ux-summary -- /tmp/pulse-2026-05-26-current-route-evidence-251bf85-fix
npm run qa:ux-evidence -- --project=desktop-chromium --project=mobile-chromium
npm run qa:ux-summary -- test-results/route-evidence/2026-05-26-251bf85
```

Summary:

- Focused mobile route evidence: passed, 17 screenshots, 0 horizontal overflow.
- Full desktop/mobile route evidence: passed, 9 desktop screenshots, 17 mobile screenshots, 0 horizontal overflow.
- Focused screenshot reviewed: `test-results/route-evidence/2026-05-26-251bf85/mobile-chromium/15-data-fueling-action.png`

## Conclusion

This is a small follow-up to the Fueling safety support, not a new product package. The Data card now keeps the manual GI rule visible while restoring the next action to the mobile first viewport.
