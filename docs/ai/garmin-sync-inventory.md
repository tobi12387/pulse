# Garmin Sync Inventory

Current operating model: local single-user Garmin Connect login via `GARMIN_EMAIL`/`GARMIN_PASSWORD`. The server owns Garmin sync; the sidecar adapter remains a fallback for worker contexts without a Fastify app.

| Area | File | Access path | Notes |
|---|---|---|---|
| Daily manual/background sync | `backend/src/routes/garmin.ts` | `getGarminClient()` + library methods + `garminApi.getDailyUserSummary()` | Canonical source for Pulse daily/sleep/activity/weight sync. |
| Backfill | `backend/src/pulse/routes/garmin-routes.ts`, `backend/src/pulse/services/garmin-sync-day.ts` | `syncGarminDay()` | Bounded sequential day sync, no separate Garmin client. |
| Activity detail cache | `backend/src/pulse/routes/activity-routes.ts` | `garminApi.getActivitySplits()` / `getActivityHrTimeInZones()` | Raw reads are named because garmin-connect has no typed method. |
| Workout upload/schedule | `backend/src/pulse/routes/training-routes.ts`, `backend/src/pulse/routes/garmin-routes.ts` | `gc.addWorkout()` + `garminApi.scheduleWorkout()` | Garmin library creates workout; raw adapter schedules it. |
| Calendar repair/cleanup | `backend/src/pulse/routes/garmin-routes.ts`, `backend/src/pulse/services/garmin-calendar-workouts.ts` | `garminApi.getCalendarMonth()`, `getWorkout()`, delete helpers | Raw endpoints kept behind named adapter methods. |
| Plan generation background sync | `backend/src/pulse/routes/training-routes.ts` | Same workout/calendar adapter methods | Fire-and-forget after plan generation. |
| Nightly profile sync | `backend/src/jobs/garmin-sync.job.ts` | `getGarminClient()` + `syncProfileFromGarmin()` | Single settings read plus stored activity candidates. |
| Queue worker fallback | `backend/src/pulse/queues/workers.ts` | `syncGarminDay()` when app exists; sidecar `syncGarminForDate()` otherwise | Direct path is preferred for local Pulse. |
| Legacy sidecar adapter | `backend/src/pulse/adapters/garmin-client.ts` | `GARMIN_SIDECAR_URL` | Retained for legacy/isolated worker contexts only. |
| CLI backfill script | `backend/src/scripts/backfill-garmin.ts` | `syncGarminDay()` | Uses the same canonical day sync. |
