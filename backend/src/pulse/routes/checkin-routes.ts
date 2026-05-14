import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { PulseCoachMessage, PulseGuidedCheckinResponse } from '@coaching-os/shared/pulse';
import {
  pulseCoachSessions,
  pulseMentalCheckins,
} from '../../db/pulse-schema.js';
import { db } from '../../lib/db.js';
import { transcribeAudio } from '../../lib/whisper.js';
import { buildCachedPulseContextFor, mapPulseContextToCoachContext } from '../lib/pulse-context.js';
import { invalidateUser } from '../lib/pulse-cache.js';
import {
  buildRichSystemPrompt,
  classifyAndExtractCheckin,
  getCoachReplyRich,
  type CheckinClassification,
} from '../services/coach-engine.js';
import { normalizeCoachMessages } from '../services/coach.js';
import { getMentalLoadOverlay } from '../services/mental-load-overlay.js';
import { listMentalThemes } from '../services/mental-themes.js';
import { getResilienceRadar } from '../services/resilience-radar.js';
import { refreshAdaptationEventsForUser } from '../services/adaptation-events.js';

const checkinSchema = z.object({
  mood:       z.number().int().min(1).max(10),
  energy:     z.number().int().min(1).max(10),
  stress:     z.number().int().min(1).max(10),
  motivation: z.number().int().min(1).max(10),
  notes:      z.string().max(500).optional(),
});

const voiceCheckinSchema = z.object({
  audio:    z.string().min(1),
  mimeType: z.string().default('audio/webm'),
});

const textCheckinSchema = z.object({
  text: z.string().trim().min(3).max(1500),
});

export async function registerPulseCheckinRoutes(app: FastifyInstance) {
  app.post('/checkin', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = checkinSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const today = new Date().toISOString().split('T')[0]!;
    const userId = req.user.sub;

    const [existing] = await db.select({ id: pulseMentalCheckins.id })
      .from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)));
    if (existing) return reply.status(409).send({ error: 'Heute bereits eingecheckt' });

    const [checkin] = await db.insert(pulseMentalCheckins).values({
      userId, date: today, ...parsed.data, notes: parsed.data.notes ?? null,
    }).returning();

    await invalidateUser(userId);
    await refreshAdaptationEventsForUser(db, userId, today).catch((err: unknown) => {
      app.log.warn(`[checkin] Failed to refresh adaptation events for ${userId}: ${err}`);
    });
    return reply.status(201).send(checkin);
  });

  app.post('/checkin/text', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = textCheckinSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const text = parsed.data.text.trim();
    let classification: CheckinClassification;
    try {
      classification = await classifyAndExtractCheckin(text);
    } catch (err) {
      app.log.error(`[text-checkin] LLM classification error: ${err}`);
      return reply.status(502).send({ error: 'Coach-Analyse fehlgeschlagen, bitte erneut versuchen.' });
    }

    return {
      text,
      reply:             classification.coachReply,
      isCheckin:         classification.isCheckin,
      followUpQuestions: classification.extraction?.followUpQuestions ?? [],
      extraction:        classification.extraction
        ? {
            mood:       classification.extraction.mood,
            energy:     classification.extraction.energy,
            stress:     classification.extraction.stress,
            motivation: classification.extraction.motivation,
            themes:     classification.extraction.themes,
          }
        : null,
    };
  });

  app.post('/checkin/voice', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = voiceCheckinSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Anfrage' });

    const userId = req.user.sub;
    const today  = new Date().toISOString().split('T')[0]!;

    let transcript: string;
    try {
      transcript = await transcribeAudio(parsed.data.audio, parsed.data.mimeType);
    } catch (err) {
      app.log.error(`[voice-checkin] Whisper error: ${err}`);
      return reply.status(502).send({ error: 'Transkription fehlgeschlagen, bitte als Text eingeben.' });
    }

    let classification: CheckinClassification;
    try {
      classification = await classifyAndExtractCheckin(transcript);
    } catch (err) {
      app.log.error(`[voice-checkin] LLM classification error: ${err}`);
      return reply.status(502).send({ error: 'Coach-Analyse fehlgeschlagen, bitte erneut versuchen.' });
    }

    let checkinId: string | null = null;
    if (classification.isCheckin && classification.extraction) {
      const ex = classification.extraction;
      const [existing] = await db.select({ id: pulseMentalCheckins.id, notes: pulseMentalCheckins.notes })
        .from(pulseMentalCheckins)
        .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)));

      if (existing) {
        const updatedNotes = [existing.notes, transcript].filter(Boolean).join('\n---\n');
        await db.update(pulseMentalCheckins)
          .set({
            mood:           ex.mood,
            energy:         ex.energy,
            stress:         ex.stress,
            motivation:     ex.motivation,
            themes:         ex.themes,
            notes:          updatedNotes,
            source:         'voice',
            coachQuestions: ex.followUpQuestions.map(q => ({ question: q, answer: null })),
          })
          .where(eq(pulseMentalCheckins.id, existing.id));
        checkinId = existing.id;
      } else {
        const [inserted] = await db.insert(pulseMentalCheckins).values({
          userId,
          date:           today,
          mood:           ex.mood,
          energy:         ex.energy,
          stress:         ex.stress,
          motivation:     ex.motivation,
          themes:         ex.themes,
          notes:          transcript,
          source:         'voice',
          coachQuestions: ex.followUpQuestions.map(q => ({ question: q, answer: null })),
        }).returning({ id: pulseMentalCheckins.id });
        checkinId = inserted?.id ?? null;
      }
      await invalidateUser(userId);
      await refreshAdaptationEventsForUser(db, userId, today).catch((err: unknown) => {
        app.log.warn(`[voice-checkin] Failed to refresh adaptation events for ${userId}: ${err}`);
      });
    }

    const [session] = await db.select({ id: pulseCoachSessions.id, messages: pulseCoachSessions.messages })
      .from(pulseCoachSessions)
      .where(eq(pulseCoachSessions.userId, userId))
      .orderBy(desc(pulseCoachSessions.lastMessageAt))
      .limit(1);

    const history = normalizeCoachMessages(session?.messages);
    const pulseContext = await buildCachedPulseContextFor(userId, today);
    const systemPrompt = buildRichSystemPrompt(mapPulseContextToCoachContext(pulseContext));
    const replyText = await getCoachReplyRich(transcript, systemPrompt, history);

    const userMsg: PulseCoachMessage = { role: 'user',      content: transcript, timestamp: new Date().toISOString() };
    const botMsg:  PulseCoachMessage = { role: 'assistant', content: replyText,  timestamp: new Date().toISOString() };

    if (session) {
      await db.update(pulseCoachSessions)
        .set({ messages: [...history.slice(-20), userMsg, botMsg], lastMessageAt: new Date() })
        .where(eq(pulseCoachSessions.id, session.id));
    } else {
      await db.insert(pulseCoachSessions).values({ userId, messages: [userMsg, botMsg] });
    }

    return {
      transcript,
      reply:             replyText,
      isCheckin:         classification.isCheckin,
      followUpQuestions: classification.extraction?.followUpQuestions ?? [],
      checkinId,
      extraction:        classification.extraction
        ? {
            mood:       classification.extraction.mood,
            energy:     classification.extraction.energy,
            stress:     classification.extraction.stress,
            motivation: classification.extraction.motivation,
            themes:     classification.extraction.themes,
          }
        : null,
    };
  });

  app.get('/checkin/today', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const today  = new Date().toISOString().split('T')[0]!;
    const [checkin] = await db.select({ id: pulseMentalCheckins.id, date: pulseMentalCheckins.date })
      .from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)));
    return { checkin: checkin ?? null };
  });

  app.get('/checkin/guidance', { onRequest: [app.authenticate] }, async (req): Promise<PulseGuidedCheckinResponse> => {
    const userId = req.user.sub;
    const today  = new Date().toISOString().split('T')[0]!;
    const context = await buildCachedPulseContextFor(userId, today);
    return context.guidedCheckin;
  });

  app.get('/checkin/history', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const q = req.query as { days?: string };
    const days = Math.min(180, Math.max(7, parseInt(q.days ?? '30', 10)));
    const since = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]!;
    const checkins = await db.select({
      id: pulseMentalCheckins.id,
      date: pulseMentalCheckins.date,
      mood: pulseMentalCheckins.mood,
      energy: pulseMentalCheckins.energy,
      stress: pulseMentalCheckins.stress,
      motivation: pulseMentalCheckins.motivation,
    })
      .from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), gte(pulseMentalCheckins.date, since)))
      .orderBy(pulseMentalCheckins.date);
    return { checkins };
  });

  app.get('/mental/themes', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const q = req.query as { days?: string };
    const parsed = Number.parseInt(q.days ?? '90', 10);
    const days = Number.isFinite(parsed) ? Math.min(365, Math.max(30, parsed)) : 90;
    return listMentalThemes(userId, days);
  });

  app.get('/mental/load-overlay', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const q = req.query as { days?: string };
    const parsed = Number.parseInt(q.days ?? '56', 10);
    const days = Number.isFinite(parsed) ? parsed : 56;
    return getMentalLoadOverlay(userId, days);
  });

  app.get('/mental/resilience-radar', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const q = req.query as { days?: string };
    const parsed = Number.parseInt(q.days ?? '14', 10);
    const days = Number.isFinite(parsed) ? parsed : 14;
    return getResilienceRadar(userId, days);
  });
}
