import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { invalidateUser } from '../lib/pulse-cache.js';
import {
  assignEquipmentToActivity,
  createEquipment,
  createStrengthSession,
  deleteStrengthSession,
  EQUIPMENT_CATEGORIES,
  getStrengthSession,
  listEquipment,
  listStrengthSessions,
  retireEquipment,
  setEquipmentDefault,
  updateEquipment,
  updateStrengthSession,
} from '../services/strength-equipment.js';

const pulseActivityTypeSchema = z.enum(['run', 'bike', 'swim', 'strength', 'hike', 'other']);

const strengthSetSchema = z.object({
  exercise: z.string().trim().min(1).max(80),
  setNumber: z.number().int().min(1).max(20).optional(),
  reps: z.number().int().min(1).max(200),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
});

const strengthSessionCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  plannedWorkoutId: z.string().uuid().nullable().optional(),
  durationMin: z.number().int().min(1).max(360).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  sets: z.array(strengthSetSchema).min(1).max(80),
});

const strengthSessionPatchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  plannedWorkoutId: z.string().uuid().nullable().optional(),
  durationMin: z.number().int().min(1).max(360).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  sets: z.array(strengthSetSchema).max(80).optional(),
}).strict().refine(value => Object.keys(value).length > 0, { message: 'Mindestens ein Feld erforderlich' });

const equipmentCategorySchema = z.enum(EQUIPMENT_CATEGORIES as [typeof EQUIPMENT_CATEGORIES[number], ...typeof EQUIPMENT_CATEGORIES[number][]]);

const equipmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: equipmentCategorySchema,
  parentEquipmentId: z.string().uuid().nullable().optional(),
  activityTypes: z.array(pulseActivityTypeSchema).min(1).max(6),
  installedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  initialKm: z.number().min(0).max(200_000).nullable().optional(),
  retirementKm: z.number().min(0).max(200_000).nullable().optional(),
  retirementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const equipmentPatchSchema = equipmentCreateSchema.partial().strict()
  .refine(value => Object.keys(value).length > 0, { message: 'Mindestens ein Feld erforderlich' });

const equipmentAssignSchema = z.object({
  equipmentIds: z.array(z.string().uuid()).max(20),
});

const equipmentDefaultSchema = z.object({
  equipmentId: z.string().uuid(),
});

export async function registerPulseTrainingRoutes(app: FastifyInstance) {
  app.put('/activities/:id/equipment', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = equipmentAssignSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Equipment-Zuordnung' });

    const { id } = req.params as { id: string };
    const userId = req.user.sub;
    const result = await assignEquipmentToActivity(userId, id, parsed.data.equipmentIds);
    if (!result) return reply.status(404).send({ error: 'Aktivität nicht gefunden' });

    await invalidateUser(userId);
    return result;
  });

  app.get('/strength/sessions', { onRequest: [app.authenticate] }, async (req, reply) => {
    const querySchema = z.object({
      days: z.coerce.number().int().min(1).max(365).optional(),
      exercise: z.string().trim().min(1).max(80).optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Abfrage' });

    return listStrengthSessions(req.user.sub, parsed.data);
  });

  app.post('/strength/sessions', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = strengthSessionCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Krafteinheit' });

    let session;
    try {
      session = await createStrengthSession(req.user.sub, {
        ...parsed.data,
        date: parsed.data.date ?? new Date().toISOString().split('T')[0]!,
      });
    } catch {
      return reply.status(404).send({ error: 'Geplantes Workout nicht gefunden' });
    }
    await invalidateUser(req.user.sub);
    return reply.status(201).send(session);
  });

  app.get('/strength/sessions/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await getStrengthSession(req.user.sub, id);
    if (!session) return reply.status(404).send({ error: 'Krafteinheit nicht gefunden' });
    return session;
  });

  app.patch('/strength/sessions/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = strengthSessionPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Krafteinheit' });

    const { id } = req.params as { id: string };
    const session = await updateStrengthSession(req.user.sub, id, parsed.data);
    if (!session) return reply.status(404).send({ error: 'Krafteinheit nicht gefunden' });
    await invalidateUser(req.user.sub);
    return session;
  });

  app.delete('/strength/sessions/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = await deleteStrengthSession(req.user.sub, id);
    if (!deleted) return reply.status(404).send({ error: 'Krafteinheit nicht gefunden' });
    await invalidateUser(req.user.sub);
    return reply.status(204).send();
  });

  app.get('/equipment', { onRequest: [app.authenticate] }, async (req, reply) => {
    const querySchema = z.object({
      includeRetired: z.coerce.boolean().optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Abfrage' });
    return listEquipment(req.user.sub, { includeRetired: parsed.data.includeRetired });
  });

  app.post('/equipment', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = equipmentCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültiges Equipment' });

    const equipment = await createEquipment(req.user.sub, parsed.data);
    if (!equipment) return reply.status(404).send({ error: 'Parent-Equipment nicht gefunden' });
    await invalidateUser(req.user.sub);
    return reply.status(201).send(equipment);
  });

  app.patch('/equipment/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = equipmentPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültiges Equipment' });

    const { id } = req.params as { id: string };
    const equipment = await updateEquipment(req.user.sub, id, parsed.data);
    if (!equipment) return reply.status(404).send({ error: 'Equipment nicht gefunden' });
    await invalidateUser(req.user.sub);
    return equipment;
  });

  app.post('/equipment/:id/retire', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = z.object({
      retirementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültiges Retirement-Datum' });

    const { id } = req.params as { id: string };
    const equipment = await retireEquipment(req.user.sub, id, parsed.data.retirementDate);
    if (!equipment) return reply.status(404).send({ error: 'Aktives Equipment nicht gefunden' });
    await invalidateUser(req.user.sub);
    return equipment;
  });

  app.put('/equipment/defaults/:activityType', { onRequest: [app.authenticate] }, async (req, reply) => {
    const activityType = pulseActivityTypeSchema.safeParse((req.params as { activityType: string }).activityType);
    const body = equipmentDefaultSchema.safeParse(req.body);
    if (!activityType.success || !body.success) return reply.status(400).send({ error: 'Ungültiges Default-Equipment' });

    const result = await setEquipmentDefault(req.user.sub, activityType.data, body.data.equipmentId);
    if (!result) return reply.status(404).send({ error: 'Equipment nicht gefunden' });
    await invalidateUser(req.user.sub);
    return result;
  });
}
