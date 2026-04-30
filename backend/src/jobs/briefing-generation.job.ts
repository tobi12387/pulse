import type { FastifyInstance } from 'fastify';
import type { Job, Queue, Worker } from 'bullmq';
import { createQueue, createWorker } from '../lib/queue.js';
import { llmComplete, SMART_MODEL } from '../lib/llm.js';
import { db } from '../lib/db.js';
import { dailyBriefings } from '../db/schema.js';
import { buildPulseContextFor, type PulseContext } from '../pulse/lib/pulse-context.js';

export const BRIEFING_QUEUE_NAME = 'briefing';

export interface BriefingJobData {
  userId: string;
  triggerType: 'check-in' | 'garmin-alarm';
  date: string; // YYYY-MM-DD
}

export function buildBriefingSystemPrompt(): string {
  return `Du bist ein persönlicher Coach für Tobi, einen Ausdauersportler (polarized training).
Deine Aufgabe: ein tägliches Coaching-Briefing auf Deutsch, 3-5 Sätze, konkret und umsetzbar.
Fokus: Erholung, Trainingsbereitschaft, konkrete Empfehlung für heute.
Wenn ein Risk-Signal critical ist, musst du es klar adressieren und darfst es nicht beschönigen.`;
}

export function buildBriefingUserContentRich(
  ctx: PulseContext,
  triggerType: 'check-in' | 'garmin-alarm',
): string {
  const m = ctx.todayMetrics;
  const c = ctx.todayCheckin;
  const nextWorkout = ctx.upcomingWorkouts[0] ?? null;

  const riskPart = ctx.activeRiskSignals.length > 0
    ? `RISIKO-SIGNALE (Risk-Engine):\n${ctx.activeRiskSignals.map(r => `- [${r.severity.toUpperCase()}] ${r.title} (${r.ruleId})\n  Empfehlung: ${r.recommendation}`).join('\n')}`
    : 'RISIKO-SIGNALE (Risk-Engine): keine aktiven Signale.';

  const metricsPart = m
    ? `Pulse-Daten (${ctx.date}): Schlaf ${m.sleepHours ?? '–'}h (Score: ${m.sleepScore ?? '–'}), HRV ${m.hrvRmssd ?? '–'}ms (${m.hrvStatus ?? '–'}), Ruhepuls ${m.restingHr ?? '–'} bpm, Body Battery ${m.bodyBatteryMax ?? '–'}, Stress ${m.stressAvg ?? '–'}, Schritte ${m.steps ?? '–'}.`
    : `Keine Pulse-Metriken für ${ctx.date} verfügbar.`;

  const checkinPart = c
    ? `Tobis Check-in: Stimmung ${c.mood}/10, Energie ${c.energy}/10, Stress ${c.stress}/10, Motivation ${c.motivation}/10${c.notes ? `, Notiz: ${c.notes}` : ''}.`
    : triggerType === 'garmin-alarm'
    ? 'Kein Check-in heute (Alarm durch Pulse-Metriken ausgelöst).'
    : 'Kein Check-in vorhanden.';

  const loadPart = `Trainingslast: CTL ${ctx.fitnessLoad.ctl.toFixed(0)}, ATL ${ctx.fitnessLoad.atl.toFixed(0)}, TSB ${ctx.fitnessLoad.tsb.toFixed(0)}. Readiness: ${ctx.readiness.score}/100 (${ctx.readiness.label}).`;

  const recoveryPart = ctx.recovery
    ? `Recovery: Score ${ctx.recovery.recoveryScore}/100, Schlafdefizit 7d ${ctx.recovery.sleepDebt7d.hours.toFixed(1)}h (${ctx.recovery.sleepDebt7d.status}), HRV ${ctx.recovery.hrvDeviation7d.pct.toFixed(1)}% (${ctx.recovery.hrvDeviation7d.status}), Empfehlung: ${ctx.recovery.recommendation}.`
    : 'Recovery: zu wenige Verlaufsdaten für eine belastbare 7d/30d-Einschätzung.';

  const healthPart = ctx.activeHealthStates.length > 0
    ? `Aktive Health-States: ${ctx.activeHealthStates.map(h => `${h.type}/${h.severity}${h.bodyPart ? ` ${h.bodyPart}` : ''}${h.notes ? ` (${h.notes})` : ''}`).join('; ')}.`
    : 'Keine aktiven Health-States.';

  const workoutPart = nextWorkout
    ? `Nächstes Training: ${nextWorkout.plannedDate} ${nextWorkout.activityType} Z${nextWorkout.zone}, ${nextWorkout.durationMin}min${nextWorkout.description ? ` (${nextWorkout.description})` : ''}.`
    : 'Kein geplantes nächstes Training.';

  const lastRatedActivity = ctx.recentActivities.find(a => a.rpe != null) ?? null;
  let rpePart = lastRatedActivity
    ? `Letzte subjektiv bewertete Einheit: ${lastRatedActivity.startTime.toISOString().split('T')[0]} ${lastRatedActivity.activityType}${lastRatedActivity.plannedZone ? ` Z${lastRatedActivity.plannedZone}` : ''}, RPE ${lastRatedActivity.rpe}/10${lastRatedActivity.rpeNote ? ` (${lastRatedActivity.rpeNote})` : ''}.`
    : 'Keine RPE-Bewertung aus den letzten Aktivitäten.';
  if (lastRatedActivity?.rpe != null && lastRatedActivity.plannedZone != null) {
    if (lastRatedActivity.plannedZone <= 2 && lastRatedActivity.rpe >= 8) {
      rpePart += ' Hinweis: Diese lockere Einheit fühlte sich überraschend hart an; mögliches Signal für aerobe Müdigkeit.';
    } else if (lastRatedActivity.plannedZone >= 4 && lastRatedActivity.rpe <= 4) {
      rpePart += ' Hinweis: Diese harte Einheit fühlte sich sehr leicht an; Intensität oder Dauer war eventuell nicht ausgereizt.';
    }
  }

  const racePart = ctx.nextRace
    ? `Nächstes Rennen/Ziel: ${ctx.nextRace.title} am ${ctx.nextRace.date} (${ctx.nextRace.daysUntil} Tage).`
    : 'Kein aktives Rennen hinterlegt.';

  return `${riskPart}\n${metricsPart}\n${checkinPart}\n${loadPart}\n${recoveryPart}\n${healthPart}\n${workoutPart}\n${rpePart}\n${racePart}\n\nErstelle das Briefing in 3-5 Sätzen. Wenn ein aktiver Health-State existiert, RPE auf aerobe Müdigkeit hindeutet oder ein Risk-Signal warn/critical ist, muss das konkret in der Empfehlung berücksichtigt werden.`;
}

export async function processBriefingJob(
  job: Job<BriefingJobData>,
  app: FastifyInstance,
): Promise<void> {
  const { userId, triggerType, date } = job.data;

  const ctx = await buildPulseContextFor(userId, date);
  const systemPrompt = buildBriefingSystemPrompt();
  const userContent  = buildBriefingUserContentRich(ctx, triggerType);
  const briefingText = await llmComplete(systemPrompt, userContent, SMART_MODEL);

  await db.insert(dailyBriefings).values({
    userId,
    date,
    triggerType,
    garminSnapshot:  ctx.todayMetrics ? { ...ctx.todayMetrics } : null,
    checkinSnapshot: ctx.todayCheckin ? { ...ctx.todayCheckin } : null,
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
