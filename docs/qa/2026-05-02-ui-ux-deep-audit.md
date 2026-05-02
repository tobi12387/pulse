# UI/UX Deep Audit - 2026-05-02

> Scope: deployed Pulse UI on `https://192.168.178.46:5175`, with emphasis on daily iPhone/PWA use, repeated morning/evening flows, route-to-route continuity, visible recovery from errors and evidence tooling.

## Methods

| Method | Result |
|---|---|
| Deployed browser audit | Playwright Chromium opened Home, Coach, Data, Plan, Insights and Settings on desktop `1440x1000` and iPhone `390x844`. Screenshots and DOM audit JSON were written to `/private/tmp/pulse-ux-audit/`. |
| Route screenshot review | Desktop and iPhone screenshots were visually reviewed for first-viewport priority, density, scrolling burden and route-specific friction. |
| E2E regression sweep | `npm run test:e2e -- --grep "Mobile navigation|Coach|Settings|PWA|Plan|Data|Insights"` passed with `77 passed, 1 skipped` after rerunning outside the sandbox because the local Vite test server could not bind inside the sandbox. |
| Static route inspection | Home, Coach, Data, Plan, Insights, Settings, shared layout and extracted feature components were inspected for interaction risks. |
| Documentation/plan audit | Completed plans were checked so the new work does not rebuild prior UX waves. The new plan pack builds on the current deployed app and the real iPhone field evidence. |
| Parallel explorer audit | Two read-only explorer agents reviewed code structure and QA/design evidence independently. Their findings were folded into the priorities below. |

## Executive Summary

Pulse is functionally broad and the deployed app is reachable on iPhone over VPN, but the remaining UI/UX risk is daily friction rather than missing feature count. The app already has the main ingredients: daily decision, Coach, Plan, Data, Insights and Settings diagnostics. The next work should make those ingredients feel like one reliable daily loop.

The strongest evidence points to five improvement themes:

1. Close concrete mobile containment and tap-target issues before adding more surface area.
2. Make Home, Coach and Plan behave like one daily flow, not three separate dashboards.
3. Replace route-level failure states and silent mutation failures with local recovery.
4. Bring Settings device/PWA/push diagnostics to the top of the route and make deep links possible.
5. Refresh Canva/Figma/WebKit evidence so design decisions are based on the current app, not stale handoff material.

## Priority Findings

| Priority | Finding | Evidence | Follow-up plan |
|---|---|---|---|
| P1 | Data has confirmed horizontal overflow on iPhone. | The iPhone `/data` DOM audit found `20` overflowing nodes, all around the `Domain-Abdeckung` table with `minWidth: 520`. Desktop had no overflow. | `2026-05-02-mobile-touch-and-containment-ux.md` |
| P1 | Many mobile controls are below comfortable touch size. | Examples from the iPhone audit: Data tabs `27px` high, Insights range buttons `25px`, Plan arrows `19x21`, Settings action buttons `22-35px`, Coach `Verlauf loeschen` `97x14`. | `2026-05-02-mobile-touch-and-containment-ux.md` |
| P1 | Coach can hide the daily guidance once chat history exists. | The daily briefing and starter prompts are empty-state content; returning users can land on prior chat content without a persistent today panel. | `2026-05-02-daily-loop-route-priority-ux.md` |
| P1 | The daily loop is not addressable enough. | Data/Plan tabs are local state only, Settings sections have no URL anchors, and QA covers fragments rather than one continuous Home -> Coach -> Plan -> evidence journey. | `2026-05-02-daily-loop-route-priority-ux.md` |
| P1 | Error and mutation recovery are too coarse. | Home can collapse to a whole-route error on readiness/load failure; Plan alternatives, plan generation, Coach send and Settings/health-state mutations mostly show pending state but not consistent inline retry/error outcomes. | `2026-05-02-feedback-resilience-ux.md` |
| P1 | `AdjustTodayCard` dismissal looks local and fragile. | Static audit found the hide selector attached to the button itself, so the proposal can reappear after refetch instead of becoming a durable daily decision. | `2026-05-02-feedback-resilience-ux.md` |
| P2 | Plan first viewport does not prioritize the next useful training action on iPhone. | On the current test date, Plan repeats the Home day-off decision first; the next workout decision sits lower in the scroll. This reinforces the user's concern that planning can feel repetitive rather than context-aware. | `2026-05-02-daily-loop-route-priority-ux.md` |
| P2 | Settings hides high-value device/PWA/push state too far down the page. | The iPhone first viewport starts with profile/coach settings; push and device access state appear much later, despite current field friction being certificate/PWA related. | `2026-05-02-settings-diagnostics-matrix.md` |
| P2 | Canva/Figma evidence is stale relative to the deployed app. | Follow-up completed: route evidence pack exists, FigJam has the current evidence loop, and Canva is explicitly marked stale/approval-gated. | `completed/2026-05-02-ux-evidence-toolchain-refresh.md` |
| P2 | WebKit/PWA automated coverage is optional and thin. | Follow-up completed: `iphone-webkit` remains optional and has a bounded Settings/PWA diagnostics regression slice plus route evidence command. | `completed/2026-05-02-ux-evidence-toolchain-refresh.md` |
| P3 | Desktop data-dense routes leave useful width unused. | Desktop screenshots show a narrow centered content column on Plan/Data/Insights even where scanning, comparison and route-level evidence would benefit from wider layouts. | Later slice after P1/P2 |
| P3 | Interaction language and iconography are inconsistent. | Examples include `SYNC`, `OUT`, `x`, arrow glyphs, German action labels and mixed icon conventions. | Later polish after flow fixes |

## Route Notes

### Home

- Strong: first viewport clearly communicates the daily decision and main readiness signals.
- Risk: if the main readiness/load query fails, useful independent cards can disappear behind one route-level error.
- Risk: desktop layout is readable but conservative; data-rich sections do not use much horizontal space.

### Coach

- Strong: chat response works on iPhone and the input is reachable in the deployed field test.
- Risk: returning sessions can hide the daily guided context because starter prompts are empty-state content.
- Risk: `Verlauf loeschen` is visually and physically too small for a touch action.
- Risk: keyboard/visual viewport behavior is not yet explicitly regression-tested beyond the manual iPhone pass.

### Data

- Strong: route split into coverage, recovery and mental feature groups is clean.
- Risk: the coverage table is the only confirmed horizontal overflow from the browser audit.
- Risk: mobile tabs and range buttons are compact enough to be error-prone in repeated use.

### Plan

- Strong: Plan now has decision quality, season strategy, race context, review and alternatives.
- Risk: the mobile first viewport repeats the Home day-off card before showing the next training decision.
- Risk: tiny arrows and compact tab controls hurt repeated touch use.
- Risk: the UI needs to make it obvious that not every available day must be filled and that today's Garmin/mental data influence the plan.

### Insights

- Strong: decision quality and trend context are visible and the route is resilient from prior waves.
- Risk: chart/range interactions are dense on mobile, and the route needs stronger "what changes today?" translation.

### Settings

- Strong: Garmin, account, coach, health-state, equipment, PWA and push sections exist.
- Risk: the current iPhone concern is device access/certificate/push, but the route starts with profile/coach settings.
- Risk: no URL section anchors means support links cannot land directly on PWA, push or Garmin diagnostics.

## Recommended Sequence

1. `2026-05-02-mobile-touch-and-containment-ux.md`
2. `2026-05-02-daily-loop-route-priority-ux.md`
3. `2026-05-02-feedback-resilience-ux.md`
4. `2026-05-02-settings-diagnostics-matrix.md`
5. `completed/2026-05-02-ux-evidence-toolchain-refresh.md`

Do not start a broad visual redesign first. The evidence says Pulse needs less route friction, clearer daily priority and stronger recovery states before it needs a new look.
