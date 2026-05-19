# 2026-05-19 Data Mental Resilience Radar

## Evidence

- Branch: `codex/route-evidence-next-slice`
- Baseline commit: `b110c76`
- Before command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-19-next-slice npm run qa:ux-evidence`
- Before screenshot: `/tmp/pulse-2026-05-19-next-slice/2026-05-19-b110c76/mobile-chromium/04-data-mental.png`
- After command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-19-next-slice-after npm run qa:ux-evidence`
- After screenshot: `/tmp/pulse-2026-05-19-next-slice-after/2026-05-19-b110c76/mobile-chromium/04-data-mental.png`
- Summary command: `npm run qa:ux-summary -- /tmp/pulse-2026-05-19-next-slice-after`
- Result: 2 manifests, 9 desktop screenshots, 15 mobile screenshots, 0 horizontal overflow.

## Finding

The broad route evidence pack was clean on horizontal overflow, but the mobile `Data > Heute > Mental` screenshot exposed a real daily-flow readability issue in the `Resilienz-Radar`: the CTA column shared the first row with the headline and summary, compressing the copy into a narrow column and visually crowding the action into the decision text.

This is a `Lernschleifen` friction because Data should reduce interpretation load after a mental check-in, not ask Tobi to parse a cramped evidence/action contract on the iPhone path.

## Scope

- Stack the resilience action below the decision copy on narrow mobile viewports.
- Keep the same read-only learning contract, CTA label, target path and desktop card structure.
- Add a focused mobile Playwright guard for the action being below the decision copy.

## Verification

- `npm run test:e2e -- frontend/e2e/ux-a11y-responsive.spec.ts -g "mobile Data mental resilience radar stacks its action below the decision copy" --project=mobile-chromium`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-19-next-slice-after npm run qa:ux-evidence`
- `npm run qa:ux-summary -- /tmp/pulse-2026-05-19-next-slice-after`
