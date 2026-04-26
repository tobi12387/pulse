import Fastify from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from './lib/env.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development',
  });

  // JWT
  await app.register(import('@fastify/jwt'), {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '30d' },
  });

  // Auth decorator — passthrough for single-user local instance
  app.decorate('authenticate', async function(
    req: FastifyRequest,
    _reply: FastifyReply
  ) {
    req.user = { sub: '00000000-0000-0000-0000-000000000001' };
  });

  // CORS
  await app.register(import('@fastify/cors'), { origin: true });

  // Routes
  await app.register(import('./routes/auth.js'), { prefix: '/api/auth' });
  await app.register(import('./routes/garmin.js'), { prefix: '/api/garmin' });
  await app.register(import('./routes/health-data.js'), { prefix: '/api/health' });
  await app.register(import('./routes/checkin.js'),  { prefix: '/api/checkin' });
  await app.register(import('./routes/briefing.js'), { prefix: '/api/briefing' });
  await app.register(import('./routes/chat.js'), { prefix: '/api/chat' });
  await app.register(import('./pulse/plugin.js'), { prefix: '/api/pulse' });

  // Health check
  app.get('/api/ping', async () => ({ status: 'ok', version: '2.0.0' }));

  // BullMQ Garmin sync job (not in test mode)
  if (env.NODE_ENV !== 'test') {
    const { startGarminSyncJob } = await import('./jobs/garmin-sync.job.js');
    const { queue, worker } = startGarminSyncJob(app);

    app.addHook('onClose', async () => {
      await worker.close();
      await queue.close();
    });

    const { startBriefingGenerationWorker } = await import('./jobs/briefing-generation.job.js');
    const { queue: bQueue, worker: bWorker } = startBriefingGenerationWorker(app);

    app.addHook('onClose', async () => {
      await bWorker.close();
      await bQueue.close();
    });

    const { startPulseWorkers } = await import('./pulse/queues/workers.js');
    const shutdownPulse = startPulseWorkers();
    app.addHook('onClose', async () => { await shutdownPulse(); });
  }

  return app;
}
