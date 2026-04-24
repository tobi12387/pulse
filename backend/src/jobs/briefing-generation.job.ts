import type { FastifyInstance } from 'fastify';
import type { Job, Queue, Worker } from 'bullmq';
import { createQueue, createWorker } from '../lib/queue.js';
import { llmComplete, SMART_MODEL } from '../lib/llm.js';
import { db } from '../lib/db.js';
import { dailyBriefings, checkIns, garminDailyHealth } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export const BRIEFING_QUEUE_NAME = 'briefing';

export interface BriefingJobData {
  userId: string;
  triggerType: 'check-in' | 'garmin-alarm';
  date: string; // YYYY-MM-DD
}

type GarminRow = typeof garminDailyHealth.$inferSelect;
type CheckInRow = typeof checkIns.$inferSelect;

function buildBriefingSystemPrompt(): string {
  return `Du bist ein persönlicher Coach für Tobi, einen Ausdauersportler (polarized training).
Deine Aufgabe: ein tägliches Coaching-Briefing auf Deutsch, 3-5 Sätze, konkret und umsetzbar.
Fokus: Erholung, Trainingsbereitschaft, konkrete Empfehlung für heute.`;
}

function buildBriefingUserContent(
  garmin: GarminRow | null,
  checkin: CheckInRow | null,
  triggerType: 'check-in' | 'garmin-alarm',
): string {
  const garminPart = garmin
    ? `Garmin-Daten: Schlaf ${garmin.sleepDurationH ?? '–'}h (Score: ${garmin.sleepScore ?? '–'}), HRV-Status: ${garmin.hrvStatus ?? '–'}, Ruhepuls: ${garmin.restingHr ?? '–'} bpm, Body Battery: ${garmin.bodyBatteryMax ?? '–'}, Schritte: ${garmin.steps ?? '–'}`
    : 'Keine Garmin-Daten für heute verfügbar.';

  const checkinPart = checkin
    ? `Tobis Check-in: Energielevel ${checkin.energyLevel}/10, Stresslevel ${checkin.stressLevel}/10${checkin.notes ? `, Notiz: ${checkin.notes}` : ''}.`
    : triggerType === 'garmin-alarm'
    ? 'Kein Check-in heute (Alarm durch Garmin-Daten ausgelöst).'
    : 'Kein Check-in vorhanden.';

  return `${garminPart}\n${checkinPart}\n\nErstelle das Briefing.`;
}

export async function processBriefingJob(
  job: Job<BriefingJobData>,
  app: FastifyInstance,
): Promise<void> {
  const { userId, triggerType, date } = job.data;

  const [garmin] = await db.select()
    .from(garminDailyHealth)
    .where(and(eq(garminDailyHealth.userId, userId), eq(garminDailyHealth.date, date)));

  const [checkin] = triggerType === 'check-in'
    ? await db.select().from(checkIns).where(
        and(eq(checkIns.userId, userId), eq(checkIns.date, date))
      )
    : [undefined];

  const systemPrompt = buildBriefingSystemPrompt();
  const userContent  = buildBriefingUserContent(garmin ?? null, checkin ?? null, triggerType);
  const briefingText = await llmComplete(systemPrompt, userContent, SMART_MODEL);

  await db.insert(dailyBriefings).values({
    userId,
    date,
    triggerType,
    garminSnapshot:  garmin  ? { ...garmin }  : null,
    checkinSnapshot: checkin ? { ...checkin } : null,
    briefingText,
  });

  app.log.info(`[briefing] Generated for ${userId} on ${date} (trigger: ${triggerType})`);
}

export function startBriefingGenerationWorker(
  app: FastifyInstance,
): { queue: Queue; worker: Worker } {
  const queue  = createQueue(BRIEFING_QUEUE_NAME);
  const worker = createWorker(BRIEFING_QUEUE_NAME, (job: Job<BriefingJobData>) => processBriefingJob(job, app));
  app.log.info('[briefing] Worker started');
  return { queue, worker };
}
