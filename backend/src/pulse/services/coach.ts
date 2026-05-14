import type {
  PulseCoachCommunicationStyle,
  PulseCoachMessage,
  PulseCoachPreferences,
} from '@coaching-os/shared/pulse';
import type { pulseCoachPreferences } from '../../db/pulse-schema.js';

type CoachPreferencesRow = typeof pulseCoachPreferences.$inferSelect;

const DEFAULT_COACH_PREFERENCES: PulseCoachPreferences = {
  timeWindows: '',
  dislikedWorkoutPatterns: [],
  preferredLongDays: [],
  injurySensitiveConstraints: [],
  communicationStyle: 'data_first',
  supportWarningSigns: [],
  supportStabilizingActions: [],
  supportContactNote: '',
  supportActivationPreference: 'suggest_only',
  updatedAt: null,
};

export function serializeCoachPreferences(row: CoachPreferencesRow | null | undefined): PulseCoachPreferences {
  if (!row) return DEFAULT_COACH_PREFERENCES;
  return {
    timeWindows: row.timeWindows,
    dislikedWorkoutPatterns: row.dislikedWorkoutPatterns,
    preferredLongDays: row.preferredLongDays,
    injurySensitiveConstraints: row.injurySensitiveConstraints,
    communicationStyle: row.communicationStyle as PulseCoachCommunicationStyle,
    supportWarningSigns: row.supportWarningSigns,
    supportStabilizingActions: row.supportStabilizingActions,
    supportContactNote: row.supportContactNote,
    supportActivationPreference: row.supportActivationPreference,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export function normalizeCoachMessages(messages: unknown): PulseCoachMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.filter((m): m is PulseCoachMessage => (
    typeof m === 'object' &&
    m !== null &&
    ((m as PulseCoachMessage).role === 'user' || (m as PulseCoachMessage).role === 'assistant') &&
    typeof (m as PulseCoachMessage).content === 'string' &&
    typeof (m as PulseCoachMessage).timestamp === 'string'
  ));
}
