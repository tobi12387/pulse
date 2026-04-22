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

  // Auth decorator
  app.decorate('authenticate', async function(
    req: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      await req.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // CORS
  await app.register(import('@fastify/cors'), { origin: true });

  // Routes
  await app.register(import('./routes/auth.js'), { prefix: '/api/auth' });
  await app.register(import('./routes/garmin.js'), { prefix: '/api/garmin' });

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', version: '2.0.0' }));

  return app;
}
