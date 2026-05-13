# QA — Mental Check-in State Density

Date: 2026-05-13
Branch: `codex/mental-checkin-state-density`

## Scope

- Compact the three Mental Check-in state choices on `/data?tab=today#data-mental`.
- Keep qualitative state selection, arrow-key radio behavior, quick save and numeric fine-tuning intact.
- Move repeated `Mental Health` / `Mental Fitness` explanation out of the cards; keep the derived summary as the single explanation source.

## Red / Green

- Red: `Mental state choices keep the quick check-in compact on mobile` failed because no compact state-group contract existed.
- Green: after adding a compact state-group and removing repeated badges from the state cards, the new mobile density contract passed.

## Verification

- `npx playwright test frontend/e2e/ux-data-mental.spec.ts --project=mobile-chromium -g "Mental state choices keep the quick check-in compact" --workers=1`
- `npx playwright test frontend/e2e/ux-data-mental.spec.ts frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Mental state choices keep|Mental button-radio groups|Mental check-in can be saved|Data mental check-in uses quick choices|Data mental check-in keeps the primary save action|Data mental focus keeps evidence context|Data mental check-in turns free text" --workers=1`
- `npm run build`
- `git diff --check`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-mental-checkin-state-density-final npm run qa:ux-evidence && npm run qa:ux-summary -- /tmp/pulse-mental-checkin-state-density-final`

## Evidence

- Local route evidence: `/tmp/pulse-mental-checkin-state-density-final/`
- Desktop screenshots: 9
- Mobile screenshots: 15
- Horizontal overflow: 0
- Manual screenshot check: mobile `04-data-mental.png` shows the three state choices as a compact one-row control, with `Heute speichern`, `Mehr beschreiben` and `Feinjustieren` visible without the repeated card badges.
