# Mobile Page Header Density

## Scope

Small UI/UX slice from fresh route evidence: reduce mobile first-viewport header weight on top-level operational routes without changing route structure, data logic, Garmin behavior or desktop orientation.

## Before Evidence

Fresh local route evidence on `9181179`:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-next-ui-friction npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-next-ui-friction
```

Summary:

- desktop screenshots: 9
- mobile screenshots: 15
- horizontal overflow: 0
- mobile screenshots reviewed:
  - `/tmp/pulse-next-ui-friction/2026-05-13-9181179/mobile-chromium/03-data.png`
  - `/tmp/pulse-next-ui-friction/2026-05-13-9181179/mobile-chromium/06-plan.png`
  - `/tmp/pulse-next-ui-friction/2026-05-13-9181179/mobile-chromium/09-settings.png`

## Finding

Mobile Data, Plan and Settings used long desktop-style route titles in the first viewport:

- `Heute, Trends, Qualität & Analyse`
- `Training, Ziele & Statistik`
- `Profil, Garmin & Geräte`

Those titles repeat information already carried by the route label, eyebrow and tabs. They also push the actual work surface lower while Tobi's stated direction is calmer, less bulky daily use.

## Decision

Add compact mobile titles only for top-level operational page headers:

- Data -> `Data`
- Plan -> `Plan`
- Settings -> `Settings`

Desktop keeps the full descriptive title. No new tabs, cards, interactions or backend contracts are added.

## Verification Plan

- Red/green mobile Playwright contract for visible `h1` text on `/data`, `/plan` and `/settings`.
- Focused route smoke for Data/Plan readiness copy after title split.
- Frontend build.
- Route evidence rerun and summary to confirm no horizontal overflow and review the after-state.

## Verification Result

- Red: `npx playwright test frontend/e2e/ux-a11y-responsive.spec.ts --project=mobile-chromium -g "mobile top-level headers use compact" --workers=1` failed before the implementation with `Expected: "Data"`, `Received: "Heute, Trends, Qualität & Analyse"`.
- Green: same command passed after adding mobile page titles.
- Focused responsive/header checks: `npx playwright test frontend/e2e/ux-a11y-responsive.spec.ts --project=desktop-chromium --project=mobile-chromium -g "mobile top-level headers use compact|desktop Focus operational routes share|mobile Data tabs wrap" --workers=1` passed, with expected viewport skips.
- Focused smoke/navigation checks: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "renders without runtime errors|primary navigation reaches every Pulse page|Data mobile subnavigation|Data mobile deep links|top-level hotkeys" --workers=1` passed.
- Frontend build: `npm run build -w frontend` passed.
- Route evidence after-state: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-mobile-header-density npm run qa:ux-evidence` passed.
- Route evidence summary: `npm run qa:ux-summary -- /tmp/pulse-mobile-header-density` passed with 9 desktop screenshots, 15 mobile screenshots and 0 horizontal overflow.
- Full browser suite: `npm run test:e2e:full` passed with 333 passed and 21 skipped.
