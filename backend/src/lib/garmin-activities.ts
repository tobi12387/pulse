import { sql } from 'drizzle-orm';
import { pulseActivities } from '../db/pulse-schema.js';
import { db } from './db.js';

export type PulseActivityType = 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';

export interface GarminActivityUpsertResult {
  id: string;
  date: string;
  activityType: PulseActivityType;
  startTime: Date;
  startLat: number | null;
  startLon: number | null;
  isIndoor: boolean;
}

const DEFAULT_PAGE_SIZE = 100;

export function mapGarminActivityType(typeKey: string): PulseActivityType {
  const k = typeKey.toLowerCase();
  if (k.includes('running') || k.includes('run')) return 'run';
  if (k.includes('cycling') || k.includes('biking') || k.includes('bike')) return 'bike';
  if (k.includes('swimming') || k.includes('swim')) return 'swim';
  if (k.includes('strength') || k.includes('weight')) return 'strength';
  if (k.includes('hiking') || k.includes('hike')) return 'hike';
  return 'other';
}

function activityLocalDate(a: any): string {
  const raw = a.startTimeLocal ?? a.startTimeGMT ?? '';
  return typeof raw === 'string' ? raw.slice(0, 10) : '';
}

function activityStartTime(a: any): Date {
  return new Date(a.startTimeGMT ? `${a.startTimeGMT}Z` : a.startTimeLocal);
}

export function mapGarminActivityForPulse(userId: string, a: any) {
  const startTime = activityStartTime(a);
  const startLat: number | null = typeof a.startLatitude === 'number' ? a.startLatitude : null;
  const startLon: number | null = typeof a.startLongitude === 'number' ? a.startLongitude : null;
  const isIndoor =
    a.eventType?.typeKey === 'indoor' ||
    (a.elevationCorrected === false && a.startLatitude == null) ||
    (startLat == null && startLon == null && (a.distance == null || a.distance === 0));

  return {
    userId,
    externalId: String(a.activityId),
    source: 'garmin' as const,
    startTime,
    activityType: mapGarminActivityType(a.activityType?.typeKey ?? ''),
    name: a.activityName ?? null,
    durationSec: a.duration != null ? Math.round(a.duration) : null,
    distanceM: a.distance ?? null,
    avgHr: a.averageHR ?? null,
    maxHr: a.maxHR ?? null,
    avgPowerW: a.avgPower != null ? Math.round(a.avgPower) : null,
    normalizedPowerW: a.normPower != null ? Math.round(a.normPower) : null,
    tss: a.trainingStressScore ?? null,
    calories: a.calories != null ? Math.round(a.calories) : null,
    elevationGainM: a.elevationGain ?? null,
    trainingEffectAerobic: a.aerobicTrainingEffect ?? null,
    trainingEffectAnaerobic: a.anaerobicTrainingEffect ?? null,
    vo2maxEstimate: a.vO2MaxValue ?? null,
    startLat,
    startLon,
    isIndoor,
    rawData: a,
  };
}

function garminActivityUpdateSet() {
  return {
    userId: sql`excluded.user_id`,
    startTime: sql`excluded.start_time`,
    activityType: sql`excluded.activity_type`,
    name: sql`excluded.name`,
    durationSec: sql`excluded.duration_sec`,
    distanceM: sql`excluded.distance_m`,
    avgHr: sql`excluded.avg_hr`,
    maxHr: sql`excluded.max_hr`,
    avgPowerW: sql`excluded.avg_power_w`,
    normalizedPowerW: sql`excluded.normalized_power_w`,
    tss: sql`excluded.tss`,
    calories: sql`excluded.calories`,
    elevationGainM: sql`excluded.elevation_gain_m`,
    trainingEffectAerobic: sql`excluded.training_effect_aerobic`,
    trainingEffectAnaerobic: sql`excluded.training_effect_anaerobic`,
    vo2maxEstimate: sql`excluded.vo2max_estimate`,
    startLat: sql`excluded.start_lat`,
    startLon: sql`excluded.start_lon`,
    isIndoor: sql`excluded.is_indoor`,
    rawData: sql`excluded.raw_data`,
  } as any;
}

export async function upsertGarminActivity(userId: string, activity: any): Promise<GarminActivityUpsertResult | null> {
  const values = mapGarminActivityForPulse(userId, activity);
  const [row] = await db.insert(pulseActivities)
    .values(values)
    .onConflictDoUpdate({
      target: [pulseActivities.externalId, pulseActivities.source],
      set: garminActivityUpdateSet(),
    })
    .returning({ id: pulseActivities.id });

  if (!row) return null;
  return {
    id: row.id,
    date: activityLocalDate(activity),
    activityType: values.activityType,
    startTime: values.startTime,
    startLat: values.startLat,
    startLon: values.startLon,
    isIndoor: values.isIndoor ?? false,
  };
}

export async function upsertGarminActivities(userId: string, activities: any[]): Promise<number> {
  if (activities.length === 0) return 0;
  await db.insert(pulseActivities)
    .values(activities.map(a => mapGarminActivityForPulse(userId, a)))
    .onConflictDoUpdate({
      target: [pulseActivities.externalId, pulseActivities.source],
      set: garminActivityUpdateSet(),
    });
  return activities.length;
}

export async function getGarminActivitiesForDate(
  gc: any,
  dateStr: string,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<any[]> {
  const matches: any[] = [];
  let start = 0;
  let done = false;

  while (!done) {
    const page = await gc.getActivities(start, pageSize) as any[];
    if (!page || page.length === 0) break;

    for (const activity of page) {
      const localDate = activityLocalDate(activity);
      if (localDate === dateStr) {
        matches.push(activity);
      } else if (localDate && localDate < dateStr) {
        done = true;
        break;
      }
    }

    start += pageSize;
    if (page.length < pageSize) break;
  }

  return matches;
}

export async function getGarminActivitiesInRange(
  gc: any,
  startDate: string,
  endDate: string,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<any[]> {
  const matches: any[] = [];
  let start = 0;
  let done = false;

  while (!done) {
    const page = await gc.getActivities(start, pageSize) as any[];
    if (!page || page.length === 0) break;

    for (const activity of page) {
      const localDate = activityLocalDate(activity);
      if (!localDate) continue;
      if (localDate >= startDate && localDate <= endDate) matches.push(activity);
      if (localDate < startDate) {
        done = true;
        break;
      }
    }

    start += pageSize;
    if (page.length < pageSize) break;
  }

  return matches;
}
