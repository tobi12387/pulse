# QA — Data Mental Context Disclosure

Date: 2026-05-13
Branch: `codex/data-mental-context-disclosure`

## Scope

- `/data?tab=today#data-mental` keeps the Mental Check-in as the first daily action.
- Readiness, Garmin freshness and Plan/Load context move behind an explicit `Kontext anzeigen` disclosure.
- The normal `/data` overview still exposes the provenance triage after `Weitere Datenbereiche anzeigen`.

## Red / Green

- Red: `Data mental focus keeps evidence context behind disclosure` failed because `data-evidence-triage` was rendered immediately.
- Green: after the Data-page change, the focused mental tests passed on mobile.

## Verification

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=mobile-chromium -g "Data mental focus keeps evidence context|Data mental check-in keeps the primary save action" --workers=1`
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Data mental focus keeps evidence context|Data mental check-in keeps the primary save action|Data overview exposes provenance shortcuts|Data starts with one daily action|Data Plan Load triage|Mobile routes avoid unintended horizontal overflow" --workers=1`
- `npm run build`
- `git diff --check`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-data-mental-context-disclosure-final npm run qa:ux-evidence && npm run qa:ux-summary -- /tmp/pulse-data-mental-context-disclosure-final`

## Evidence

- Local route evidence: `/tmp/pulse-data-mental-context-disclosure-final/`
- Desktop screenshots: 9
- Mobile screenshots: 15
- Horizontal overflow: 0
- Manual screenshot check: mobile `04-data-mental.png` and `14-data-mental-first-viewport.png` show the Mental Check-in first and no immediate `data-evidence-triage` card in the first mental context.
