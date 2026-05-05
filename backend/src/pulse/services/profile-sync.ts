import type { FastifyBaseLogger } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { pulseActivities, pulseUserProfile } from '../../db/pulse-schema.js';
import {
  buildProfileProvenanceView,
  combineProfileCandidates,
  deriveActivityProfileCandidates,
  extractGarminSettingsProfileCandidates,
  mergeProfileCandidates,
  type ExistingProfileForProvenance,
  type SyncedProfileField,
} from './profile-provenance.js';
import type { PulseProfileMetricKey } from '@coaching-os/shared/pulse';

type GarminLikeClient = {
  getUserSettings?: () => Promise<unknown>;
};

export interface GarminProfileSyncResult {
  synced: Record<PulseProfileMetricKey, SyncedProfileField>;
  diagnostics: {
    garminSettings: 'ok' | 'unavailable';
    activityRows: number;
  };
  profile: (typeof pulseUserProfile.$inferSelect) | null;
}

export async function syncProfileFromGarmin(
  userId: string,
  gc: GarminLikeClient,
  options: { logger?: FastifyBaseLogger; now?: Date; overrideManualFields?: readonly PulseProfileMetricKey[] | undefined } = {},
): Promise<GarminProfileSyncResult> {
  const now = options.now ?? new Date();
  let garminSettings: unknown = null;
  let garminSettingsStatus: GarminProfileSyncResult['diagnostics']['garminSettings'] = 'ok';

  try {
    garminSettings = await gc.getUserSettings?.();
  } catch (err) {
    garminSettingsStatus = 'unavailable';
    options.logger?.warn(`[garmin-sync] profile settings unavailable: ${err}`);
  }

  const [[existing], activityRows] = await Promise.all([
    db.select().from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId)).limit(1),
    db.select({
      maxHr: pulseActivities.maxHr,
      rawData: pulseActivities.rawData,
    }).from(pulseActivities)
      .where(eq(pulseActivities.userId, userId))
      .orderBy(desc(pulseActivities.startTime))
      .limit(200),
  ]);

  const candidates = combineProfileCandidates({
    garminSettings: extractGarminSettingsProfileCandidates(garminSettings),
    activityDerived: deriveActivityProfileCandidates(activityRows),
  });
  const { updates, synced } = mergeProfileCandidates({
    existing: existing ?? null,
    candidates,
    overrideManualFields: options.overrideManualFields,
    now,
  });

  if (Object.keys(updates).length > 0) {
    await db.insert(pulseUserProfile)
      .values({ userId, ...updates } as typeof pulseUserProfile.$inferInsert)
      .onConflictDoUpdate({
        target: pulseUserProfile.userId,
        set: updates as Partial<typeof pulseUserProfile.$inferInsert>,
      });
  }

  const [profile] = await db.select().from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId)).limit(1);
  return {
    synced,
    diagnostics: {
      garminSettings: garminSettingsStatus,
      activityRows: activityRows.length,
    },
    profile: profile ?? null,
  };
}

export function profileWithProvenance(
  profile: (ExistingProfileForProvenance & Record<string, unknown>) | null | undefined,
  userId: string,
) {
  const fallback = {
    userId,
    ftpWatts: null,
    ftpWattsSource: null,
    ftpWattsUpdatedAt: null,
    maxHrBpm: null,
    maxHrBpmSource: null,
    maxHrBpmUpdatedAt: null,
    lthrBpm: null,
    lthrBpmSource: null,
    lthrBpmUpdatedAt: null,
    restingHrBpm: null,
    weightKg: null,
    vo2max: null,
    vo2maxSource: null,
    vo2maxUpdatedAt: null,
    trainingPhase: 'base',
    weeklyHoursTarget: null,
    updatedAt: null,
  };
  const row = profile ?? fallback;
  return {
    ...row,
    provenance: buildProfileProvenanceView(row),
  };
}
