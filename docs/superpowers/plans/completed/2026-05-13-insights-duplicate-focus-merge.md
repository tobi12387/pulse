# Insights Duplicate Focus Merge

> Status: implemented in the `codex/insights-duplicate-focus-merge` slice.

## Context

The canonical roadmap says Pulse should lead, then explain, and avoid adding more summary cards. Fresh route evidence showed `/insights` had become cleaner technically, but still repeated the same Fueling recommendation in the hero and the adjacent next-check card.

## Scope

- Keep `Aktueller Fokus` as the owner of the primary recommendation.
- Detect when the primary next check duplicates the focus title.
- Replace the duplicate intervention row with a compact confirmation.
- Keep secondary checks accessible behind the existing disclosure.
- Preserve deep analysis behavior and avoid new API writes.

## Non-Goals

- No new Insights route or tab.
- No Garmin, plan, or nutrition model changes.
- No deep AI-analysis loading on page load.

## TDD Contract

1. Add a mobile E2E contract proving `/insights` does not repeat the current focus inside `insights-next-actions`.
2. Verify the test fails on the previous UI.
3. Implement the smallest component change.
4. Re-run focused Insights checks, build, route evidence and live verification before merge.
