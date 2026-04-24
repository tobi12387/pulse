import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { chatMessages, garminDailyHealth, dailyBriefings } from '../db/schema.js';
import { eq, desc, asc } from 'drizzle-orm';
import { llmChat, FAST_MODEL } from '../lib/llm.js';
import type { LLMMessage } from '../lib/llm.js';

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
});

const MAX_HISTORY = 12; // 6 turns × 2 messages

async function buildChatSystemPrompt(userId: string): Promise<string> {
  const [garmin] = await db.select()
    .from(garminDailyHealth)
    .where(eq(garminDailyHealth.userId, userId))
    .orderBy(desc(garminDailyHealth.date))
    .limit(1);

  const [briefing] = await db.select({ briefingText: dailyBriefings.briefingText })
    .from(dailyBriefings)
    .where(eq(dailyBriefings.userId, userId))
    .orderBy(desc(dailyBriefings.createdAt))
    .limit(1);

  const garminPart = garmin
    ? `Garmin heute (${garmin.date}): Schlaf ${garmin.sleepDurationH ?? '–'}h, HRV ${garmin.hrvStatus ?? '–'}, Body Battery ${garmin.bodyBatteryMax ?? '–'}, Schritte ${garmin.steps ?? '–'}`
    : 'Keine aktuellen Garmin-Daten.';

  const briefingPart = briefing?.briefingText
    ? `Letztes Briefing: ${briefing.briefingText}`
    : 'Noch kein Briefing heute.';

  return `Du bist ein persönlicher Coach für Tobi, einen Ausdauersportler (polarized training). Antworte auf Deutsch, präzise und auf den Punkt.\n\nKontext:\n${garminPart}\n${briefingPart}`;
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
