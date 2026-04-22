import type { FastifyInstance } from 'fastify';

// Stub — wird in Task 9 vollständig implementiert
export default async function garminRoutes(app: FastifyInstance) {
  app.get('/status', { onRequest: [app.authenticate] }, async () => ({
    connected: false,
    lastSync: null,
    syncStatus: 'never' as const,
    errorMessage: null,
  }));
}
