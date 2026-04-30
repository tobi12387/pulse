/**
 * Backfill Garmin activities via pagination.
 * Run: BACKFILL_ACTIVITIES_START=2026-01-01 BACKFILL_ACTIVITIES_END=2026-12-31 \
 *   node --env-file=/root/pulse/.env /root/pulse/backend/dist/scripts/backfill-activities.js
 */
import { getGarminActivitiesInRange, upsertGarminActivities } from '../lib/garmin-activities.js';

const USER_ID   = process.env['PULSE_USER_ID'] ?? '00000000-0000-0000-0000-000000000001';
const START     = process.env['BACKFILL_ACTIVITIES_START'] ?? '2026-01-01';
const END       = process.env['BACKFILL_ACTIVITIES_END'] ?? new Date().toISOString().slice(0, 10);
const PAGE_SIZE = Number(process.env['BACKFILL_ACTIVITY_PAGE_SIZE'] ?? 100);

const { GarminConnect } = await import('garmin-connect').then((m: any) => m.default ?? m);

const { env } = await import('../lib/env.js');
const gc = new GarminConnect({ username: env.GARMIN_EMAIL, password: env.GARMIN_PASSWORD });
await gc.login(env.GARMIN_EMAIL, env.GARMIN_PASSWORD);
console.log('Garmin login OK');

console.log(`Backfilling Garmin activities for ${START}..${END}`);

const activities = await getGarminActivitiesInRange(gc, START, END, PAGE_SIZE);
const total = await upsertGarminActivities(USER_ID, activities);
console.log(`\nDone. Total activities imported: ${total}`);
process.exit(0);
