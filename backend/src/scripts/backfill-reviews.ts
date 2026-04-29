/**
 * Generate weekly reviews for all complete weeks since 2025-01-06.
 * Run: node --env-file=/root/pulse/.env /root/pulse/backend/dist/scripts/backfill-reviews.js
 */
import { db } from '../lib/db.js';
import { pulseWeeklyReviews } from '../db/pulse-schema.js';
import { eq, and } from 'drizzle-orm';
import { generateWeeklyReview } from '../pulse/services/review-engine.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';

function getMondaysBetween(from: Date, to: Date): string[] {
  const mondays: string[] = [];
  const cur = new Date(from);
  // advance to first Monday
  while (cur.getDay() !== 1) cur.setDate(cur.getDate() + 1);
  while (cur < to) {
    mondays.push(cur.toISOString().split('T')[0]!);
    cur.setDate(cur.getDate() + 7);
  }
  return mondays;
}

// Only generate for weeks that are fully in the past (up to last Monday)
const today    = new Date();
const lastSun  = new Date(today);
lastSun.setDate(today.getDate() - today.getDay()); // last Sunday
const cutoff   = lastSun;

const mondays = getMondaysBetween(new Date('2025-01-01'), cutoff);
console.log(`Weeks to process: ${mondays.length}`);

// Find already generated reviews
const existing = await db.select({ weekStart: pulseWeeklyReviews.weekStart })
  .from(pulseWeeklyReviews)
  .where(eq(pulseWeeklyReviews.userId, USER_ID));
const existingSet = new Set(existing.map(r => r.weekStart));

const todo = mondays.filter(m => !existingSet.has(m));
console.log(`Already generated: ${existingSet.size}, remaining: ${todo.length}`);

let done = 0;
let errors = 0;

for (const weekStart of todo) {
  try {
    const review = await generateWeeklyReview(USER_ID, weekStart);
    done++;
    console.log(`[${done}/${todo.length}] ${weekStart}: ${review.narrative.slice(0, 60)}…`);
  } catch (err) {
    errors++;
    console.error(`[SKIP] ${weekStart}: ${err}`);
  }
  // Small delay to avoid LLM rate limits
  await new Promise(r => setTimeout(r, 500));
}

console.log(`\nDone. Generated: ${done}, errors: ${errors}`);
process.exit(0);
