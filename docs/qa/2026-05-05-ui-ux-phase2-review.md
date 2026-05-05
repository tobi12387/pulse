# UI/UX Phase 2 Review

## Scope

Review after PR #175 and PR #176 were merged and deployed. Focus: daily iPhone/PWA and desktop flows, not broad redesign.

## Evidence

- Server deploy verified: `scripts/verify-server.sh`
- Deployed commit: `35e5263`
- Route evidence command: `npm run qa:ux-evidence`
- Route evidence path: `test-results/route-evidence/2026-05-05-35e5263/`
- Desktop viewport: `1280x720`
- Mobile viewport: `412x839`
- Captured routes: `/`, `/coach`, `/data`, `/data?tab=mental`, `/data?tab=analysen`, `/plan`, `/settings`
- Manifest result: 7 screenshots per viewport, `horizontalOverflow=0`

## Review Summary

Pulse is now materially less bulky than before: Home/Data/Plan/Settings are the only primary destinations, Data starts with a useful overview, Mental Check-in can be saved through qualitative state cards, and Garmin repeat repair detection covers 0-iteration repeat groups.

The next usability gap is trust closure. The app collects better signals and syncs better workout templates, but the UI still needs to show more clearly what changed because of those signals and whether a planned workout is really ready on Garmin.

## Prioritized Findings

| Priority | Area | Finding | User Impact | Next Plan |
|---|---|---|---|---|
| P1 | Home / daily loop | Home can answer the day but still routes no-training closure toward Coach instead of local close/anchor actions. | The daily loop can feel unfinished unless the user starts a chat. | `docs/superpowers/plans/2026-05-05-home-daily-decision-closure.md` |
| P1 | Mental signal | Mental input is easier, but the app does not yet consistently show how the saved state changes Home, Plan or Coach. | Check-in risks feeling like data entry rather than decision support. | `docs/superpowers/plans/2026-05-05-mental-signal-impact-loop.md` |
| P2 | Garmin workout sync | Repeat repair is fixed, but Plan does not yet provide one clear "ready on Garmin" confidence surface. | The user has to infer whether a planned workout is on the watch/Edge correctly. | `docs/superpowers/plans/2026-05-05-garmin-workout-sync-confidence.md` |
| P2 | Mobile controls / accessibility | Some touch targets are below 44px and custom radios lack full arrow-key behavior. | iPhone and keyboard/assistive use remain less robust than the visual UI suggests. | `docs/superpowers/plans/2026-05-05-mobile-a11y-controls-polish.md` |
| P2 | Evidence trail | Evidence chips and Data overview are useful but do not consistently deep-link to the exact evidence behind the daily decision. | The app is explainable in pieces, not yet as one trail. | `docs/superpowers/plans/2026-05-05-data-decision-evidence-trail.md` |

## Non-Duplicated Completed Work

Do not rebuild these completed waves:

- UI/UX Deep Friction Closure
- Daily Loop Slimming
- Insights Into Data
- Mental Check-in Simplification
- Coach primary-nav removal
- Contextual Coach prompt links
- Data overview default
- Settings Garmin diagnostics
- Garmin Data Quality / Signal Usefulness
- Daily Decision Quality
- PR #176 qualitative Mental cards and Garmin repeat repair

## Manual Gates

- iPhone certificate trust remains manual if warning-free Safari/PWA behavior is required.
- Push activation and test push remain manual per browser/device.
- Real Garmin calendar/workout sync should only be triggered when explicitly validating or repairing Garmin workouts.
- Fueling and recovery guidance remains preference-gated.
