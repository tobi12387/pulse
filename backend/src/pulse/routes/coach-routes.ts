import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import type { PulseCoachMessage, PulseCoachPreferences } from '@coaching-os/shared/pulse';
import {
  pulseCoachPreferences,
  pulseCoachSessions,
} from '../../db/pulse-schema.js';
import { db } from '../../lib/db.js';
import {
  buildRichSystemPrompt,
  getCoachReplyRich,
} from '../services/coach-engine.js';
import { buildCachedPulseContextFor, mapPulseContextToCoachContext } from '../lib/pulse-context.js';
import { invalidateUser } from '../lib/pulse-cache.js';
import { loadDailyDecisionQuality } from '../services/daily-loop.js';
import { normalizeCoachMessages, serializeCoachPreferences } from '../services/coach.js';

const coachMessageSchema = z.object({
  message: z.string().min(1).max(2000),
});

const coachPreferencesPatchSchema = z.object({
  timeWindows: z.string().trim().max(500).optional(),
  dislikedWorkoutPatterns: z.array(z.string().trim().min(1).max(120)).max(10).optional(),
  preferredLongDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  injurySensitiveConstraints: z.array(z.string().trim().min(1).max(160)).max(10).optional(),
  communicationStyle: z.enum(['direct', 'gentle', 'data_first']).optional(),
}).strict().refine(value => Object.keys(value).length > 0, { message: 'Mindestens ein Feld erforderlich' });

export async function registerPulseCoachRoutes(app: FastifyInstance) {
  app.get('/coach/preferences', { onRequest: [app.authenticate] }, async (req): Promise<{ preferences: PulseCoachPreferences }> => {
    const [row] = await db.select().from(pulseCoachPreferences)
      .where(eq(pulseCoachPreferences.userId, req.user.sub))
      .limit(1);
    return { preferences: serializeCoachPreferences(row) };
  });

  app.patch('/coach/preferences', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = coachPreferencesPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const now = new Date();
    const updates: Partial<typeof pulseCoachPreferences.$inferInsert> = { updatedAt: now };

    if (parsed.data.timeWindows !== undefined) updates.timeWindows = parsed.data.timeWindows;
    if (parsed.data.dislikedWorkoutPatterns !== undefined) {
      updates.dislikedWorkoutPatterns = [...new Set(parsed.data.dislikedWorkoutPatterns)];
    }
    if (parsed.data.preferredLongDays !== undefined) {
      updates.preferredLongDays = [...new Set(parsed.data.preferredLongDays)].sort((a, b) => a - b);
    }
    if (parsed.data.injurySensitiveConstraints !== undefined) {
      updates.injurySensitiveConstraints = [...new Set(parsed.data.injurySensitiveConstraints)];
    }
    if (parsed.data.communicationStyle !== undefined) updates.communicationStyle = parsed.data.communicationStyle;

    const [row] = await db.insert(pulseCoachPreferences)
      .values({ userId, ...updates } as typeof pulseCoachPreferences.$inferInsert)
      .onConflictDoUpdate({
        target: pulseCoachPreferences.userId,
        set: updates,
      })
      .returning();

    await invalidateUser(userId);
    return { preferences: serializeCoachPreferences(row) };
  });

  app.post('/coach', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = coachMessageSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Nachricht' });

    const userId = req.user.sub;
    const today  = new Date().toISOString().split('T')[0]!;

    const [[existingSession], pulseContext, dailyDecisionQuality] = await Promise.all([
      db.select({ id: pulseCoachSessions.id, messages: pulseCoachSessions.messages })
        .from(pulseCoachSessions)
        .where(eq(pulseCoachSessions.userId, userId))
        .orderBy(desc(pulseCoachSessions.lastMessageAt))
        .limit(1),
      buildCachedPulseContextFor(userId, today),
      loadDailyDecisionQuality(userId, 14).catch(() => null),
    ]);

    const coachCtx = mapPulseContextToCoachContext(pulseContext);
    coachCtx.dailyDecisionQuality = dailyDecisionQuality;
    const systemPrompt = buildRichSystemPrompt(coachCtx);
    const history = normalizeCoachMessages(existingSession?.messages);

    const replyText = await getCoachReplyRich(parsed.data.message, systemPrompt, history);

    const userMsg: PulseCoachMessage = { role: 'user',      content: parsed.data.message, timestamp: new Date().toISOString() };
    const botMsg:  PulseCoachMessage = { role: 'assistant', content: replyText,            timestamp: new Date().toISOString() };

    if (existingSession) {
      const updated = [...history.slice(-20), userMsg, botMsg];
      await db.update(pulseCoachSessions)
        .set({ messages: updated, lastMessageAt: new Date() })
        .where(eq(pulseCoachSessions.id, existingSession.id));
    } else {
      await db.insert(pulseCoachSessions).values({ userId, messages: [userMsg, botMsg] });
    }

    return { reply: replyText };
  });

  app.get('/coach/history', { onRequest: [app.authenticate] }, async (req) => {
    const [session] = await db.select({ messages: pulseCoachSessions.messages })
      .from(pulseCoachSessions)
      .where(eq(pulseCoachSessions.userId, req.user.sub))
      .orderBy(desc(pulseCoachSessions.lastMessageAt))
      .limit(1);

    return { messages: normalizeCoachMessages(session?.messages) };
  });

  app.delete('/coach/history', { onRequest: [app.authenticate] }, async (req, reply) => {
    await db.delete(pulseCoachSessions).where(eq(pulseCoachSessions.userId, req.user.sub));
    return reply.status(204).send();
  });
}
