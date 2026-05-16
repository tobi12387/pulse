# 2026-05-16 Performance OS Next Intake

## Evidence

- Evidence branch: `codex/performance-os-evidence-intake`
- Implementation branch: `codex/offplan-restplan-entry`
- Evidence baseline commit: `80db7d0`
- Implementation baseline commit: `7db0700`
- Command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-performance-os-next-intake npm run qa:ux-evidence`
- Summary: `npm run qa:ux-summary -- /tmp/pulse-performance-os-next-intake`
- Result: 2 manifests, 9 desktop screenshots, 15 mobile screenshots, 0 horizontal overflow.

## Finding

The broad Home/Data/Plan/Insights/Settings route pack did not show a new layout or overflow blocker. The next concrete daily-decision friction is inside the off-plan flow: after a spontaneous Garmin activity is closed with Fueling and Feedback evidence, `Planwirkung pruefen` opened the scenario preview as generic `source=everyday-adaptation`.

That weakened the product contract because the preview was no longer explicitly about real off-plan Zusatzlast. The smallest useful change is to give that handoff its own read-only `offplan-restplan` source and context copy while keeping the same explicit preview/apply boundary.

## Scope

- Change only the Off-plan Restplan preview entry source/copy.
- Keep `Weniger Zeit`, `Nicht bereit`, `Heute skippen` and normal Alltag adaptation paths unchanged.
- Keep the preview read-only until explicit Apply; no automatic Plan or Garmin writes.

## Verification Plan

- Red/green focused Daily Flow for off-plan long activity.
- Focused Plan scenario/adaptation regressions.
- Frontend lint/build.
- Route evidence was already clean for the broad route baseline.
