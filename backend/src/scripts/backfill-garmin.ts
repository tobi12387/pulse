/**
 * One-time backfill: syncs all Garmin data for a date range.
 * Run after build: node --env-file=/root/pulse/.env /root/pulse/backend/dist/scripts/backfill-garmin.js
 */
import { db } from '../lib/db.js';
import { pulseDailyMetrics } from '../db/pulse-schema.js';
import { syncGarminDay } from '../routes/garmin.js';
import { inArray } from 'drizzle-orm';

const USER_ID = '00000000-0000-0000-0000-000000000001';
const START   = new Date('2025-01-01');
const END     = new Date(); // today
const DELAY_MS = 1500; // pause between days to avoid Garmin rate limits

const fakeApp = {
  log: {
    info:  (msg: string) => console.log(`[INFO]  ${msg}`),
    warn:  (msg: string) => console.warn(`[WARN]  ${msg}`),
    error: (msg: string) => console.error(`[ERROR] ${msg}`),
  },
} as any;

function allDates(from: Date, to: Date): string[] {
  const dates: string[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    dates.push(cur.toISOString().split('T')[0]!);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

async function getAlreadySynced(dates: string[]): Promise<Set<string>> {
  const rows = await db
    .select({ date: pulseDailyMetrics.date })
    .from(pulseDailyMetrics)
    .where(inArray(pulseDailyMetrics.date, dates));
  return new Set(rows.map(r => r.date));
}

async function main() {
  const allDays = allDates(START, END);
  console.log(`Total days in range: ${allDays.length}`);

  const synced = await getAlreadySynced(allDays);
  const todo   = allDays.filter(d => !synced.has(d));
  console.log(`Already synced: ${synced.size}, remaining: ${todo.length}`);

  let done = 0;
  let errors = 0;

  for (const dateStr of todo) {
    try {
      await syncGarminDay(USER_ID, new Date(dateStr), fakeApp);
      done++;
      if (done % 10 === 0) console.log(`Progress: ${done}/${todo.length}`);
    } catch (err) {
      errors++;
      console.error(`[SKIP] ${dateStr}: ${err}`);
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\nDone. Synced: ${done}, errors: ${errors}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
