# Focus Handoff Alignment QA — 2026-05-12

## Scope

- Align the current Focus UI implementation with `codex-handoff/` where the gap is small and safe.
- Keep product-evolved screens intact instead of reverting Data, Plan, Insights or Settings to the static mock.
- Treat `/plan/activity/:id` as the canonical Activity Detail route while keeping `/activity/:id` as compatibility.

## Evidence

Generated with:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-focus-handoff-alignment npm run qa:ux-evidence
```

Output:

- Desktop: `/tmp/pulse-focus-handoff-alignment/2026-05-12-b841d57/desktop-chromium/`
- Mobile: `/tmp/pulse-focus-handoff-alignment/2026-05-12-b841d57/mobile-chromium/`

Routes captured:

- `/`
- `/coach`
- `/data`
- `/data?tab=today#data-mental`
- `/data?tab=analysis`
- `/plan`
- `/plan/activity/activity-detail`
- `/insights`
- `/settings`

Result: desktop and mobile route evidence passed with no horizontal overflow.

## Verification

- `npx vitest run src/pulse/services/next-best-actions.test.ts src/pulse/services/daily-delta.test.ts src/pulse/services/today-options.test.ts --fileParallelism=false` — passed.
- `npm run build -w backend` — passed.
- `npm run build -w frontend` — passed.
- `npx playwright test frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium --project=mobile-chromium` — passed.
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-focus-handoff-alignment npm run qa:ux-evidence` — passed.

## Remaining Intentional Differences

- Data, Plan, Insights and Settings keep the product-evolved task hierarchy instead of the original static mock copy.
- `/coach` remains available as a compatibility route, but is not a primary nav tab.
- `/activity/:id` remains available as a compatibility route; generated app paths now prefer `/plan/activity/:id`.
