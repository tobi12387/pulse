import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import type { PulsePushTopics } from '@coaching-os/shared/pulse';
import { db } from '../../lib/db.js';
import { env } from '../../lib/env.js';
import {
  DEFAULT_PUSH_TOPICS,
  pulsePushSubscriptions,
  pulseUserProfile,
} from '../../db/pulse-schema.js';
import { isPushConfigured, normalizePushTopics, sendPushToUser } from '../../lib/push.js';
import { invalidateUser } from '../lib/pulse-cache.js';

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  deviceLabel: z.string().trim().max(64).optional(),
});

const pushTopicsPatchSchema = z.object({
  briefing: z.boolean().optional(),
  checkin_reminder: z.boolean().optional(),
  risk_critical: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0, { message: 'Mindestens ein Topic erforderlich' });

const quietHoursSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
}).refine(({ start, end }) => {
  const values = [start, end].flatMap(v => v.split(':').map(Number));
  const [sh, sm, eh, em] = values;
  return sh! <= 23 && eh! <= 23 && sm! <= 59 && em! <= 59;
}, { message: 'Uhrzeiten müssen im Format HH:MM liegen' });

function hhmm(value: string | null | undefined, fallback: string): string {
  return (value ?? fallback).slice(0, 5);
}

export async function registerPulsePushRoutes(app: FastifyInstance) {
  app.get('/push/settings', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const [profile] = await db.select({
      topics: pulseUserProfile.pushTopics,
      quietStart: pulseUserProfile.pushQuietStart,
      quietEnd: pulseUserProfile.pushQuietEnd,
    }).from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));

    const subscriptions = await db.select({
      id: pulsePushSubscriptions.id,
      endpoint: pulsePushSubscriptions.endpoint,
      deviceLabel: pulsePushSubscriptions.deviceLabel,
      enabled: pulsePushSubscriptions.enabled,
      lastSuccessAt: pulsePushSubscriptions.lastSuccessAt,
      lastErrorAt: pulsePushSubscriptions.lastErrorAt,
      consecutiveFailures: pulsePushSubscriptions.consecutiveFailures,
      createdAt: pulsePushSubscriptions.createdAt,
      updatedAt: pulsePushSubscriptions.updatedAt,
    }).from(pulsePushSubscriptions)
      .where(eq(pulsePushSubscriptions.userId, userId))
      .orderBy(desc(pulsePushSubscriptions.createdAt));

    return {
      configured: isPushConfigured(),
      publicKey: env.VAPID_PUBLIC_KEY ?? null,
      topics: normalizePushTopics(profile?.topics),
      quietHours: {
        start: hhmm(profile?.quietStart, '22:00'),
        end: hhmm(profile?.quietEnd, '06:30'),
      },
      subscriptions,
    };
  });

  app.post('/push/subscribe', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = pushSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Push-Subscription' });
    const userId = req.user.sub;
    const now = new Date();

    const [subscription] = await db.insert(pulsePushSubscriptions).values({
      userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      deviceLabel: parsed.data.deviceLabel ?? null,
      enabled: true,
      consecutiveFailures: 0,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: pulsePushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        deviceLabel: parsed.data.deviceLabel ?? null,
        enabled: true,
        consecutiveFailures: 0,
        updatedAt: now,
      },
    }).returning();

    await invalidateUser(userId);

    return reply.status(201).send({ subscription });
  });

  app.delete('/push/subscribe', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = z.object({ endpoint: z.string().url() }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Push-Subscription' });
    const userId = req.user.sub;
    await db.delete(pulsePushSubscriptions)
      .where(and(eq(pulsePushSubscriptions.userId, userId), eq(pulsePushSubscriptions.endpoint, parsed.data.endpoint)));
    await invalidateUser(userId);
    return reply.status(204).send();
  });

  app.get('/push/topics', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const [profile] = await db.select({ topics: pulseUserProfile.pushTopics })
      .from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));
    return normalizePushTopics(profile?.topics);
  });

  app.patch('/push/topics', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = pushTopicsPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Push-Themen' });
    const userId = req.user.sub;
    const [profile] = await db.select({ topics: pulseUserProfile.pushTopics })
      .from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));
    const currentTopics = normalizePushTopics(profile?.topics);
    const nextTopics: PulsePushTopics = {
      briefing: parsed.data.briefing ?? currentTopics.briefing,
      checkin_reminder: parsed.data.checkin_reminder ?? currentTopics.checkin_reminder,
      risk_critical: parsed.data.risk_critical ?? currentTopics.risk_critical,
    };

    const [updated] = await db.insert(pulseUserProfile).values({
      userId,
      pushTopics: nextTopics,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: pulseUserProfile.userId,
      set: { pushTopics: nextTopics, updatedAt: new Date() },
    }).returning({ topics: pulseUserProfile.pushTopics });

    return normalizePushTopics(updated?.topics ?? DEFAULT_PUSH_TOPICS);
  });

  app.patch('/push/quiet-hours', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = quietHoursSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige stille Zeiten' });
    const userId = req.user.sub;

    const [updated] = await db.insert(pulseUserProfile).values({
      userId,
      pushQuietStart: parsed.data.start,
      pushQuietEnd: parsed.data.end,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: pulseUserProfile.userId,
      set: { pushQuietStart: parsed.data.start, pushQuietEnd: parsed.data.end, updatedAt: new Date() },
    }).returning({ start: pulseUserProfile.pushQuietStart, end: pulseUserProfile.pushQuietEnd });

    return { start: hhmm(updated?.start, parsed.data.start), end: hhmm(updated?.end, parsed.data.end) };
  });

  app.post('/push/test', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!isPushConfigured()) {
      return reply.status(503).send({ error: 'Web Push ist serverseitig noch nicht konfiguriert.' });
    }
    const userId = req.user.sub;
    const result = await sendPushToUser(userId, {
      topic: 'briefing',
      title: 'Pulse Test',
      body: 'Push ist aktiv.',
      url: '/settings',
      tag: 'pulse-test',
    });
    return { ok: true, result };
  });
}
