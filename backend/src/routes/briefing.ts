import type { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { dailyBriefings } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

export default async function briefingRoutes(app: FastifyInstance) {
  app.get('/latest', { onRequest: [app.authenticate] }, async (req, reply) => {
    const [briefing] = await db.select({
      id:           dailyBriefings.id,
      date:         dailyBriefings.date,
      triggerType:  dailyBriefings.triggerType,
      briefingText: dailyBriefings.briefingText,
      createdAt:    dailyBriefings.createdAt,
    })
      .from(dailyBriefings)
      .where(eq(dailyBriefings.userId, req.user.sub))
      .orderBy(desc(dailyBriefings.createdAt))
      .limit(1);

    return reply.send({
      briefing: briefing
        ? {
            id:           briefing.id,
            date:         briefing.date,
            trigger_type: briefing.triggerType,
            briefing_text: briefing.briefingText,
            created_at:   briefing.createdAt.toISOString(),
          }
        : null,
    });
  });
}
