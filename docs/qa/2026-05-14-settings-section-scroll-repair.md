# Settings Section Scroll Repair QA

## Scope

Repair the main-branch browser regression where `/settings?section=push` did not scroll the `Benachrichtigungen` section into the first viewport after the new desktop Settings grid.

## Evidence

- Red reproduction:
  - `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Data, Plan and Settings preserve URL-backed UI state" --project=desktop-chromium`
  - Result before fix: failed at `frontend/e2e/pulse-usability.spec.ts:2099`.
  - Actual heading y-position: `844.859375`, expected `< 260`.
- Root cause:
  - The existing one-frame `scrollIntoView` ran before async Settings cards expanded.
  - The target section then shifted below the first viewport.
- Fix:
  - Settings section anchors now re-scroll during the short initial layout stabilization window.

## Verification

- Focused regression:
  - `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Data, Plan and Settings preserve URL-backed UI state" --project=desktop-chromium`
  - Result after fix: 1 passed.
- Focused Settings desktop/mobile route checks:
  - `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Data, Plan and Settings preserve URL-backed UI state|Settings uses desktop width|Settings diagnostics matrix is visible first|Settings groups actions by risk" --project=desktop-chromium --project=mobile-chromium`
  - Result: 8 passed.
- Build:
  - `npm run build`
  - Result: passed.
- Static diff:
  - `git diff --check`
  - Result: passed.
- Route evidence:
  - `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-settings-section-scroll-repair-final npm run qa:ux-evidence`
  - Result: 2 passed.
  - `npm run qa:ux-summary -- /tmp/pulse-settings-section-scroll-repair-final`
  - Result: 2 manifests, 24 screenshots, 0 horizontal overflow.
- Server deploy verification: pending PR merge.
