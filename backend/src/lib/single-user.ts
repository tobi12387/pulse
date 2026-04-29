import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { pulseUserProfile } from '../db/pulse-schema.js';
import { db } from './db.js';
import { hashPassword } from './auth.js';

export const SINGLE_USER_ID = '00000000-0000-0000-0000-000000000001';
export const SINGLE_USER_EMAIL = 'pulse.local@coaching.os';

export async function ensureSingleUser(): Promise<void> {
  const [existing] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.id, SINGLE_USER_ID))
    .limit(1);

  if (!existing) {
    await db.insert(users).values({
      id: SINGLE_USER_ID,
      email: SINGLE_USER_EMAIL,
      passwordHash: await hashPassword(`local-single-user-${SINGLE_USER_ID}`),
      name: 'Tobi',
      settings: {},
    }).onConflictDoNothing();
  }

  await db.insert(pulseUserProfile).values({
    userId: SINGLE_USER_ID,
    trainingPhase: 'base',
    updatedAt: new Date(),
  }).onConflictDoNothing();
}
