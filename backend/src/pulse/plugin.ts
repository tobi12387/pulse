import type { FastifyInstance } from 'fastify';
import { registerPulseActivityRoutes } from './routes/activity-routes.js';
import { registerPulseCheckinRoutes } from './routes/checkin-routes.js';
import { registerPulseCoachRoutes } from './routes/coach-routes.js';
import { registerPulseDailyLoopRoutes } from './routes/daily-loop-routes.js';
import { registerPulseGarminRoutes } from './routes/garmin-routes.js';
import { registerPulseHealthRoutes } from './routes/health-routes.js';
import { registerPulseInsightRoutes } from './routes/insight-routes.js';
import { registerPulsePushRoutes } from './routes/push-routes.js';
import { registerPulseTrainingRoutes } from './routes/training-routes.js';

export default async function pulsePlugin(app: FastifyInstance) {
  // Allow DELETE/GET requests that send Content-Type: application/json but no body
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (body as string).length === 0) { done(null, undefined); return; }
    try { done(null, JSON.parse(body as string)); } catch (e) { done(e as Error, undefined); }
  });

  await registerPulseHealthRoutes(app);
  await registerPulseDailyLoopRoutes(app);
  await registerPulseCoachRoutes(app);
  await registerPulseCheckinRoutes(app);
  await registerPulseTrainingRoutes(app);
  await registerPulseGarminRoutes(app);
  await registerPulsePushRoutes(app);
  await registerPulseActivityRoutes(app);
  await registerPulseInsightRoutes(app);
}
