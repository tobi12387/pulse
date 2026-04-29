/**
 * Backfill all Garmin activities since 2025-01-01 via pagination.
 * Run: node --env-file=/root/pulse/.env /root/pulse/backend/dist/scripts/backfill-activities.js
 */
import { db } from '../lib/db.js';
import { pulseActivities } from '../db/pulse-schema.js';

const USER_ID   = '00000000-0000-0000-0000-000000000001';
const CUTOFF    = new Date('2025-01-01');
const PAGE_SIZE = 100;

const { GarminConnect } = await import('garmin-connect').then((m: any) => m.default ?? m);

const { env } = await import('../lib/env.js');
const gc = new GarminConnect({ username: env.GARMIN_EMAIL, password: env.GARMIN_PASSWORD });
await gc.login(env.GARMIN_EMAIL, env.GARMIN_PASSWORD);
console.log('Garmin login OK');

function mapActivityType(typeKey: string): 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other' {
  const k = typeKey.toLowerCase();
  if (k.includes('running') || k.includes('run')) return 'run';
  if (k.includes('cycling') || k.includes('biking') || k.includes('bike')) return 'bike';
  if (k.includes('swimming') || k.includes('swim')) return 'swim';
  if (k.includes('strength') || k.includes('weight')) return 'strength';
  if (k.includes('hiking') || k.includes('hike')) return 'hike';
  return 'other';
}

let start  = 0;
let total  = 0;
let done   = false;

while (!done) {
  const page = await (gc as any).getActivities(start, PAGE_SIZE) as any[];
  if (!page || page.length === 0) break;

  const toInsert = [];
  for (const a of page) {
    const startRaw = a.startTimeGMT ?? a.startTimeLocal ?? '';
    const startTime = new Date(a.startTimeGMT ? `${a.startTimeGMT}Z` : a.startTimeLocal);
    if (startTime < CUTOFF) { done = true; break; }

    toInsert.push({
      userId:   USER_ID,
      externalId: String(a.activityId),
      source:   'garmin' as const,
      startTime,
      activityType: mapActivityType(a.activityType?.typeKey ?? ''),
      name:     a.activityName ?? null,
      durationSec: a.duration != null ? Math.round(a.duration) : null,
      distanceM:   a.distance ?? null,
      avgHr:    a.averageHR ?? null,
      maxHr:    a.maxHR ?? null,
      avgPowerW: a.avgPower != null ? Math.round(a.avgPower) : null,
      normalizedPowerW: a.normPower != null ? Math.round(a.normPower) : null,
      tss:      a.trainingStressScore ?? null,
      calories: a.calories != null ? Math.round(a.calories) : null,
      elevationGainM: a.elevationGain ?? null,
      trainingEffectAerobic:   a.aerobicTrainingEffect ?? null,
      trainingEffectAnaerobic: a.anaerobicTrainingEffect ?? null,
      vo2maxEstimate: a.vO2MaxValue ?? null,
    });
  }

  if (toInsert.length > 0) {
    await db.insert(pulseActivities)
      .values(toInsert)
      .onConflictDoUpdate({
        target: [pulseActivities.externalId, pulseActivities.source],
        set: {
          name: pulseActivities.name,
          durationSec: pulseActivities.durationSec,
          distanceM: pulseActivities.distanceM,
          avgHr: pulseActivities.avgHr,
          tss: pulseActivities.tss,
          calories: pulseActivities.calories,
        },
      });
    total += toInsert.length;
    console.log(`Imported ${total} activities so far (latest page start: ${start})`);
  }

  start += PAGE_SIZE;
  if (page.length < PAGE_SIZE) break;
  await new Promise(r => setTimeout(r, 1000));
}

console.log(`\nDone. Total activities imported: ${total}`);
process.exit(0);
