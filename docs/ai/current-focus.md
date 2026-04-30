# Pulse Current Focus

Keep this file short. Update it whenever the active work queue changes.

## Active Sequence

1. Implement RPE & Post-Workout Feedback in small slices.
2. Then Risk Watch.
3. Then Web Push Notifications.
4. Then revisit Phase 10 / 11 with the latest user priorities.

## Current PRs / Branches

- `codex/fix-drizzle-migration-journal`: Sync Drizzle migration journal with existing SQL migrations and add CI guard.
- Update this section after each merge or newly opened PR.

## Next Recommended Work

- Deploy the Drizzle migration journal fix, mark already-applied server migrations in Drizzle's migration table, then add RPE to Coach/Briefing context and Plan statistics.

## Out Of Scope Unless Reversed

- Telegram integration.
- Habit tracker.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
