import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { chatMessages } from '../db/schema.js';
import { eq, asc } from 'drizzle-orm';
import { buildRichSystemPrompt, getCoachReplyRich } from '../pulse/services/coach-engine.js';
import { buildCachedPulseContextFor, mapPulseContextToCoachContext } from '../pulse/lib/pulse-context.js';

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
});

const MAX_HISTORY = 12; // 6 turns × 2 messages

async function buildChatSystemPrompt(userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0]!;
  const ctx = await buildCachedPulseContextFor(userId, today);
  return buildRichSystemPrompt(mapPulseContextToCoachContext(ctx));
}

export default async function chatRoutes(app: FastifyInstance) {
  app.post('/message', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;

    // Fetch the last MAX_HISTORY messages in chronological order
    const allRows = await db.select({ role: chatMessages.role, content: chatMessages.content })
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(asc(chatMessages.createdAt));

    const rows = allRows.slice(-MAX_HISTORY);

    const history = rows
      .filter((r): r is typeof r & { role: 'user' | 'assistant' } =>
        r.role === 'user' || r.role === 'assistant'
      )
      .map(r => ({ role: r.role, content: r.content }));

    const systemPrompt = await buildChatSystemPrompt(userId);
    const response = await getCoachReplyRich(parsed.data.message, systemPrompt, history);

    await db.insert(chatMessages).values({ userId, role: 'user', content: parsed.data.message });
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
