# 2026-05-21 - Home Learning Language

## Trigger

Fresh current-main route evidence at `09af022` showed the free-day Home decision leading with internal learning language:

- `Lernkalibrierung`
- `Kalibrierung prüfen`
- `Watch-Kontext`

The logic was correct, but the first daily decision violated the roadmap rule that Home should translate evidence into one calm everyday action before deeper analysis language appears.

## Change

- Home-facing learning-calibration signals now appear as `Lernschleife`.
- The primary CTA is `Muster prüfen` for Decision Quality and `Reaktion prüfen` for Personal Response.
- The Home detail and safest option say weaker patterns are only observed, instead of showing `Watch-Kontext`.
- Data/Plan analysis vocabulary stays unchanged where deeper evidence context is the point.

## Evidence

- Before evidence root: `/tmp/pulse-2026-05-21-current-route-evidence-09af022`
- After evidence root: `/tmp/pulse-2026-05-21-home-learning-language`
- After summary: 9 desktop screenshots, 17 mobile screenshots, 0 horizontal overflow.
- Manual spot-check: `mobile-chromium/01-home.png` shows `Lernschleife`, `Muster prüfen` and no primary-card `Kalibrierung` or `Watch-Kontext`.

## Verification

- `npm run verify:tagesentscheidung:fast`
- `npx playwright test frontend/e2e/pulse-smoke.spec.ts -g "Home daily decision opens strong learning calibration from Data evidence" --project=desktop-chromium --project=mobile-chromium`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-21-home-learning-language npm run qa:ux-evidence`
- `npm run qa:ux-summary -- /tmp/pulse-2026-05-21-home-learning-language`
