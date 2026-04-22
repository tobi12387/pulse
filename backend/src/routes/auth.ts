import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { users } from '../db/schema.js';
import { verifyPassword, signToken } from '../lib/auth.js';
import { eq } from 'drizzle-orm';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
    if (!user) return reply.status(401).send({ error: 'Ungültige Anmeldedaten' });

    const valid = await verifyPassword(user.passwordHash, parsed.data.password);
    if (!valid) return reply.status(401).send({ error: 'Ungültige Anmeldedaten' });

    const token = signToken(user.id);
    return reply.send({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  });

  app.post('/logout', async (_req, reply) => {
    return reply.status(204).send();
  });

  app.get('/me', {
    onRequest: [app.authenticate],
  }, async (req, reply) => {
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
    }).from(users).where(eq(users.id, req.user.sub));

    if (!user) return reply.status(404).send({ error: 'User nicht gefunden' });
    return reply.send(user);
  });
}
