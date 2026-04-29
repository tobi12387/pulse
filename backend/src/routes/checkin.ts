import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { checkIns } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { createQueue } from '../lib/queue.js';
import { BRIEFING_QUEUE_NAME } from '../jobs/briefing-generation.job.js';
import type { BriefingJobData } from '../jobs/briefing-generation.job.js';
import { invalidateUser } from '../pulse/lib/pulse-cache.js';

const briefingQueue = createQueue(BRIEFING_QUEUE_NAME);

const checkinSchema = z.object({
  energy_level: z.number().int().min(1).max(10),
  stress_level: z.number().int().min(1).max(10),
  notes: z.string().max(500).optional(),
});

export default async function checkinRoutes(app: FastifyInstance) {
  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = checkinSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const today  = new Date().toISOString().split('T')[0]!;
    const userId = req.user.sub;

    const [existing] = await db.select({ id: checkIns.id })
      .from(checkIns)
      .where(and(eq(checkIns.userId, userId), eq(checkIns.date, today)));
    if (existing) return reply.status(409).send({ error: 'Heute bereits ein Check-in vorhanden' });

    const [checkin] = await db.insert(checkIns).values({
      userId,
      date: today,
      energyLevel: parsed.data.energy_level,
      stressLevel: parsed.data.stress_level,
      notes: parsed.data.notes ?? null,
    }).returning();
    if (!checkin) return reply.status(500).send({ error: 'Check-in konnte nicht gespeichert werden' });
    await invalidateUser(userId);

    const jobData: BriefingJobData = { userId, triggerType: 'check-in', date: today };
    void briefingQueue.add('generate-briefing', jobData, {
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    }).catch(err => app.log.error('[checkin] briefing queue error:', err));

    return reply.status(201).send({
      id:           checkin.id,
      date:         checkin.date,
      energy_level: checkin.energyLevel,
      stress_level: checkin.stressLevel,
      notes:        checkin.notes,
    });
  });

  app.get('/today', { onRequest: [app.authenticate] }, async (req, reply) => {
    const today = new Date().toISOString().split('T')[0]!;
    const [checkin] = await db.select()
      .from(checkIns)
      .where(and(eq(checkIns.userId, req.user.sub), eq(checkIns.date, today)));

    return reply.send({
      checkin: checkin
        ? { id: checkin.id, date: checkin.date, energy_level: checkin.energyLevel, stress_level: checkin.stressLevel, notes: checkin.notes }
        : null,
    });
  });
}
