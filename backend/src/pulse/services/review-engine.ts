import { db } from '../../lib/db.js';
import {
  pulseActivities,
  pulseDailyMetrics,
  pulseMentalCheckins,
  pulseWeeklyReviews,
} from '../../db/pulse-schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { llmComplete, SMART_MODEL } from '../../lib/llm.js';

export async function buildWeekSummary(userId: string, weekStart: string, weekEnd: string): Promise<string> {
  const [activities, metrics, checkins] = await Promise.all([
    db.select({
      activityType: pulseActivities.activityType,
      durationSec: pulseActivities.durationSec,
      tss: pulseActivities.tss,
      distanceM: pulseActivities.distanceM,
    }).from(pulseActivities)
      .where(and(
        eq(pulseActivities.userId, userId),
        gte(pulseActivities.startTime, new Date(weekStart)),
        lte(pulseActivities.startTime, new Date(weekEnd + 'T23:59:59')),
      )),

    db.select({
      date: pulseDailyMetrics.date,
      sleepHours: pulseDailyMetrics.sleepHours,
      hrvStatus: pulseDailyMetrics.hrvStatus,
      bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
    }).from(pulseDailyMetrics)
      .where(and(
        eq(pulseDailyMetrics.userId, userId),
        gte(pulseDailyMetrics.date, weekStart),
        lte(pulseDailyMetrics.date, weekEnd),
      )),

    db.select({
      mood: pulseMentalCheckins.mood,
      energy: pulseMentalCheckins.energy,
      stress: pulseMentalCheckins.stress,
    }).from(pulseMentalCheckins)
      .where(and(
        eq(pulseMentalCheckins.userId, userId),
        gte(pulseMentalCheckins.date, weekStart),
        lte(pulseMentalCheckins.date, weekEnd),
      )),
  ]);

  const totalTss   = activities.reduce((s, a) => s + (a.tss ?? 0), 0);
  const totalDistM = activities.reduce((s, a) => s + (a.distanceM ?? 0), 0);
  const avgSleep   = metrics.length ? metrics.reduce((s, m) => s + (m.sleepHours ?? 7), 0) / metrics.length : null;
  const avgMood    = checkins.length ? checkins.reduce((s, c) => s + c.mood, 0) / checkins.length : null;

  return [
    `Woche ${weekStart} bis ${weekEnd}:`,
    `Trainingseinheiten: ${activities.length}`,
    `Gesamte TSS: ${Math.round(totalTss)}`,
    `Gesamtdistanz: ${(totalDistM / 1000).toFixed(1)} km`,
    avgSleep ? `Ø Schlaf: ${avgSleep.toFixed(1)}h` : '',
    avgMood ? `Ø Stimmung: ${avgMood.toFixed(1)}/10` : '',
  ].filter(Boolean).join('\n');
}

export async function generateWeeklyReview(userId: string, weekStart: string): Promise<{
  id: string;
  narrative: string;
  weekStart: string;
  weekEnd: string;
}> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0]!;

  const summary = await buildWeekSummary(userId, weekStart, weekEndStr);

  const narrative = await llmComplete(
    `Du bist Pulse, ein Ausdauercoach. Schreibe eine motivierende Wochenauswertung (max 200 Wörter) auf Deutsch. Kein Markdown, fließender Text.`,
    `Hier sind die Daten:\n${summary}\n\nSchreibe eine Auswertung mit Lob, konkreten Beobachtungen und einem Ausblick auf nächste Woche.`,
    SMART_MODEL,
  );

  const [review] = await db.insert(pulseWeeklyReviews).values({
    userId,
    weekStart,
    weekEnd: weekEndStr,
    narrative,
    metrics: { summary },
    recommendations: [],
  }).returning({ id: pulseWeeklyReviews.id });

  return { id: review!.id, narrative, weekStart, weekEnd: weekEndStr };
}
