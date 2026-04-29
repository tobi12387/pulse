import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { chatMessages, dailyBriefings } from '../db/schema.js';
import { eq, desc, asc } from 'drizzle-orm';
import { llmChat, FAST_MODEL } from '../lib/llm.js';
import type { LLMMessage } from '../lib/llm.js';
import { buildPulseContextFor } from '../pulse/lib/pulse-context.js';

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
});

const MAX_HISTORY = 12; // 6 turns × 2 messages

async function buildChatSystemPrompt(userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0]!;

  const [ctx, [briefing]] = await Promise.all([
    buildPulseContextFor(userId, today),
    db.select({ briefingText: dailyBriefings.briefingText })
      .from(dailyBriefings)
      .where(eq(dailyBriefings.userId, userId))
      .orderBy(desc(dailyBriefings.createdAt))
      .limit(1),
  ]);

  const m = ctx.todayMetrics;
  const pulsePart = m
    ? `Pulse heute (${m.date}): Schlaf ${m.sleepHours ?? '–'}h, HRV ${m.hrvStatus ?? '–'}, Body Battery ${m.bodyBatteryMax ?? '–'}, Schritte ${m.steps ?? '–'}, Readiness ${ctx.readiness.score}/100 (${ctx.readiness.label}), CTL ${ctx.fitnessLoad.ctl.toFixed(0)}, ATL ${ctx.fitnessLoad.atl.toFixed(0)}, TSB ${ctx.fitnessLoad.tsb.toFixed(0)}`
    : `Keine Pulse-Metriken für heute (${today}). Readiness ${ctx.readiness.score}/100 (${ctx.readiness.label}), CTL ${ctx.fitnessLoad.ctl.toFixed(0)}, ATL ${ctx.fitnessLoad.atl.toFixed(0)}, TSB ${ctx.fitnessLoad.tsb.toFixed(0)}.`;

  const healthPart = ctx.activeHealthStates.length > 0
    ? `Aktive Health-States: ${ctx.activeHealthStates.map(h => `${h.type}/${h.severity}${h.bodyPart ? ` ${h.bodyPart}` : ''}`).join('; ')}`
    : 'Keine aktiven Health-States.';

  const workout = ctx.upcomingWorkouts[0];
  const workoutPart = workout
    ? `Nächstes Training: ${workout.plannedDate} ${workout.activityType} Z${workout.zone}, ${workout.durationMin}min.`
    : 'Kein nächstes Training geplant.';

  const briefingPart = briefing?.briefingText
    ? `Letztes Briefing: ${briefing.briefingText}`
    : 'Noch kein Briefing heute.';

  return `Du bist ein persönlicher Coach für Tobi, einen Ausdauersportler (polarized training). Antworte auf Deutsch, präzise und auf den Punkt.\n\nKontext:\n${pulsePart}\n${healthPart}\n${workoutPart}\n${briefingPart}`;
}

export default async function chatRoutes(app: FastifyInstance) {
  app.post('/message', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;

    await db.insert(chatMessages).values({ userId, role: 'user', content: parsed.data.message });

    // Fetch the last MAX_HISTORY messages in chronological order
    const allRows = await db.select({ role: chatMessages.role, content: chatMessages.content })
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(asc(chatMessages.createdAt));

    const rows = allRows.slice(-MAX_HISTORY);

    const history: LLMMessage[] = rows
      .filter((r): r is typeof r & { role: 'user' | 'assistant' } =>
        r.role === 'user' || r.role === 'assistant'
      )
      .map(r => ({ role: r.role, content: r.content }));

    const systemPrompt = await buildChatSystemPrompt(userId);
    const response     = await llmChat(
      [{ role: 'system', content: systemPrompt }, ...history],
      FAST_MODEL,
    );

    await db.insert(chatMessages).values({ userId, role: 'assistant', content: response });

    return reply.send({ response });
  });

  app.get('/history', { onRequest: [app.authenticate] }, async (req, reply) => {
    const rows = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, req.user.sub))
      .orderBy(asc(chatMessages.createdAt))
      .limit(20);

    return reply.send({
      messages: rows.map(r => ({
        id: r.id, role: r.role, content: r.content,
        created_at: r.createdAt.toISOString(),
      })),
    });
  });

  app.delete('/history', { onRequest: [app.authenticate] }, async (req, reply) => {
    await db.delete(chatMessages).where(eq(chatMessages.userId, req.user.sub));
    return reply.status(204).send();
  });
}
