# Pulse Route Evidence Pack

Purpose: create repeatable UI/UX screenshot evidence without committing large image files.

## Commands

Default desktop plus mobile Chromium pack:

```bash
npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence
```

Optional desktop plus iPhone WebKit pack:

```bash
npm run test:e2e:install:webkit
npm run qa:ux-evidence:iphone
```

Plan/Garmin read-only harness:

```bash
npm run qa:plan:no-garmin-write
```

This harness uses mocked Pulse API fixtures to exercise Plan Refresh Preview, Today Options signal labels and Garmin Execution Readback together. It must stay free of Garmin or plan mutation calls. Real Garmin-write browser tests must be manually invoked, must not run in the default smoke/evidence commands, and should include `live-write` in the filename, test title or npm script name.

Use `PULSE_ROUTE_EVIDENCE_DIR=/path/to/output` to override the output directory. By default the pack writes to:

```text
test-results/route-evidence/<date>-<commit>/<project>/
```

`test-results/` is git-ignored. Do not commit PNGs unless the repo explicitly changes that policy.

`npm run qa:ux-summary -- <evidence-root>` prints a compact manifest summary with screenshot counts and horizontal-overflow findings. Use it to sanity-check the pack before opening images manually.

## Captured Routes

Primary route set:

- `/`
- `/coach` (compatibility route; Coach is not a primary nav item)
- `/data`
- `/data?tab=today#data-mental`
- `/data?tab=analysis`
- `/plan`
- `/plan/activity/activity-detail`
- `/insights`
- `/settings`

Mobile Daily Command evidence routes:

- `/` with planned workout command and no generic availability intent
- `/` with `today-availability-intent` under `unplanned_trainable`
- `/` with completed Garmin activity and no `today-availability-intent`
- `/` with `recovery_protect` and no `today-availability-intent`
- `/data?tab=today#data-mental` with the primary `Heute speichern` action in the first viewport
- `/plan?tab=training&source=mobile-intent&scenario=workout...#plan-scenario-preview`

Each project directory contains:

- numbered core route PNGs for the routes above
- `manifest.json`
- `README.md`

The `mobile-chromium` project additionally contains:

- mobile Daily Command scenario PNGs after the core route set

## Manifest Fields

The manifest records:

- capture timestamp and date
- Git commit SHA
- Playwright project
- base URL
- viewport
- screenshot file paths
- route URLs
- horizontal overflow summary per route

## Review Loop

1. Run the pack before UI/UX planning or after relevant UI changes.
2. Run `npm run qa:ux-summary -- <evidence-root>` and fix any horizontal overflow before adding new UI scope.
3. Review screenshots locally from `test-results/route-evidence/`.
4. Record the generated path, summary output and conclusions in the active `docs/qa/` record.
5. Use Canva/FigJam as visual companions only after the repo evidence record is current.

## Next-Slice Intake

Before creating a UI/UX implementation PR, write a short QA record that answers:

- Which route and viewport has the friction?
- Is it a real daily-flow problem, or only aesthetic preference?
- What is the smallest change that reduces decision load without adding another summary card?
- Which screenshot or browser interaction proves the before-state?
- Which focused test or route-evidence rerun proves the after-state?

If the answer is only "more polish might be nice", keep the finding as a note and do not open an implementation slice yet.
