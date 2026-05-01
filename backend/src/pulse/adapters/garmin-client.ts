import { env } from '../../lib/env.js';
import { db } from '../../lib/db.js';
import { pulseDailyMetrics, pulseSleepSessions } from '../../db/pulse-schema.js';

// Sidecar fallback for worker contexts that do not receive the Fastify app.
// Normal local Pulse operation uses `syncGarminDay()` with the server-side
// single-user Garmin Connect client.
interface SidecarResponse {
  status: string;
  date: string;
  hrv_rmssd?: number;
  hrv_status?: string;
  resting_hr?: number;
  sleep_hours?: number;
  sleep_score?: number;
  body_battery_min?: number;
  body_battery_max?: number;
  stress_avg?: number;
  steps?: number;
  calories_active?: number;
  sleep_deep_h?: number;
  sleep_rem_h?: number;
  sleep_light_h?: number;
  sleep_awake_h?: number;
}

export async function syncGarminForDate(userId: string, dateStr: string): Promise<void> {
  const res = await fetch(`${env.GARMIN_SIDECAR_URL}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: dateStr,
      garmin_email: env.GARMIN_EMAIL,
      garmin_password: env.GARMIN_PASSWORD,
    }),
  });

  if (!res.ok) throw new Error(`Garmin sidecar error: ${res.status}`);

  const data = await res.json() as SidecarResponse;

  // Upsert daily metrics
  await db.insert(pulseDailyMetrics).values({
    userId,
    date: dateStr,
    hrvRmssd:       data.hrv_rmssd    ?? null,
    hrvStatus:      data.hrv_status   ?? null,
    restingHr:      data.resting_hr   ?? null,
    sleepHours:     data.sleep_hours  ?? null,
    sleepScore:     data.sleep_score  ?? null,
    bodyBatteryMin: data.body_battery_min ?? null,
    bodyBatteryMax: data.body_battery_max ?? null,
    stressAvg:      data.stress_avg   ?? null,
    steps:          data.steps        ?? null,
    caloriesActive: data.calories_active ?? null,
    source: 'garmin',
    syncedAt: new Date(),
  }).onConflictDoUpdate({
    target: [pulseDailyMetrics.userId, pulseDailyMetrics.date],
    set: {
      hrvRmssd:       data.hrv_rmssd    ?? null,
      hrvStatus:      data.hrv_status   ?? null,
      restingHr:      data.resting_hr   ?? null,
      sleepHours:     data.sleep_hours  ?? null,
      sleepScore:     data.sleep_score  ?? null,
      bodyBatteryMin: data.body_battery_min ?? null,
      bodyBatteryMax: data.body_battery_max ?? null,
      stressAvg:      data.stress_avg   ?? null,
      steps:          data.steps        ?? null,
      caloriesActive: data.calories_active ?? null,
      syncedAt: new Date(),
    },
  });

  // Upsert sleep session if we have sleep data
  if (data.sleep_hours != null) {
    await db.insert(pulseSleepSessions).values({
      userId,
      date: dateStr,
      durationH:   data.sleep_hours,
      deepSleepH:  data.sleep_deep_h  ?? null,
      remSleepH:   data.sleep_rem_h   ?? null,
      lightSleepH: data.sleep_light_h ?? null,
      awakeH:      data.sleep_awake_h ?? null,
      sleepScore:  data.sleep_score   ?? null,
      source: 'garmin',
    }).onConflictDoUpdate({
      target: [pulseSleepSessions.userId, pulseSleepSessions.date],
      set: {
        durationH:   data.sleep_hours,
        deepSleepH:  data.sleep_deep_h  ?? null,
        remSleepH:   data.sleep_rem_h   ?? null,
        lightSleepH: data.sleep_light_h ?? null,
        awakeH:      data.sleep_awake_h ?? null,
        sleepScore:  data.sleep_score   ?? null,
      },
    });
  }
}
