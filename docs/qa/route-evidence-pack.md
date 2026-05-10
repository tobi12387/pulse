# Pulse Route Evidence Pack

Purpose: create repeatable UI/UX screenshot evidence without committing large image files.

## Commands

Default desktop plus mobile Chromium pack:

```bash
npm run qa:ux-evidence
```

Optional desktop plus iPhone WebKit pack:

```bash
npm run test:e2e:install:webkit
npm run qa:ux-evidence:iphone
```

Use `PULSE_ROUTE_EVIDENCE_DIR=/path/to/output` to override the output directory. By default the pack writes to:

```text
test-results/route-evidence/<date>-<commit>/<project>/
```

`test-results/` is git-ignored. Do not commit PNGs unless the repo explicitly changes that policy.

## Captured Routes

Primary route set:

- `/`
- `/data`
- `/data?tab=mental`
- `/data?tab=analysen`
- `/plan`
- `/settings`

Compatibility route still captured while old links and push targets can open it:

- `/coach`

Mobile Daily Command evidence routes:

- `/` with planned workout command and no generic availability intent
- `/` with `today-availability-intent` under `unplanned_trainable`
- `/` with completed Garmin activity and no `today-availability-intent`
- `/` with `recovery_protect` and no `today-availability-intent`
- `/data?tab=mental` with the primary `Heute speichern` action in the first viewport
- `/plan?tab=training&source=mobile-intent&scenario=workout...#plan-scenario-preview`

Each project directory contains:

- `01-home.png` through `07-settings.png`
- `manifest.json`
- `README.md`

The `mobile-chromium` project additionally contains:

- `08-home-planned-command.png` through `13-plan-mobile-intent-scenario.png`

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
2. Review screenshots locally from `test-results/route-evidence/`.
3. Record the generated path and conclusions in the active `docs/qa/` record.
4. Use Canva/FigJam as visual companions only after the repo evidence record is current.
