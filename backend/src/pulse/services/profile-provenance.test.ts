import { describe, expect, it } from 'vitest';
import {
  buildProfileProvenanceView,
  mergeProfileCandidates,
  summarizeProfileCandidate,
} from './profile-provenance.js';

const now = new Date('2026-05-01T12:00:00.000Z');

describe('profile provenance', () => {
  it('keeps manual profile values authoritative during Garmin sync', () => {
    const result = mergeProfileCandidates({
      existing: {
        ftpWatts: 255,
        ftpWattsSource: 'manual',
        maxHrBpm: 182,
        maxHrBpmSource: 'activity_derived',
        lthrBpm: null,
        lthrBpmSource: null,
        vo2max: null,
        vo2maxSource: null,
      },
      candidates: {
        ftpWatts: { value: 275, source: 'activity_derived' },
        maxHrBpm: { value: 188, source: 'garmin_settings' },
        lthrBpm: { value: 171, source: 'garmin_settings' },
        vo2max: { value: 54, source: 'garmin_settings' },
      },
      now,
    });

    expect(result.updates).toMatchObject({
      maxHrBpm: 188,
      maxHrBpmSource: 'garmin_settings',
      lthrBpm: 171,
      lthrBpmSource: 'garmin_settings',
      vo2max: 54,
      vo2maxSource: 'garmin_settings',
    });
    expect(result.updates).not.toHaveProperty('ftpWatts');
    expect(result.synced.ftpWatts).toMatchObject({
      value: 255,
      source: 'manual',
      status: 'kept_manual',
    });
  });

  it('adopts automatic candidates for explicitly unlocked manual fields only', () => {
    const params = {
      existing: {
        ftpWatts: 255,
        ftpWattsSource: 'manual',
        maxHrBpm: 182,
        maxHrBpmSource: 'manual',
      },
      candidates: {
        ftpWatts: { value: 275, source: 'activity_derived' as const },
        maxHrBpm: { value: 188, source: 'garmin_settings' as const },
      },
      overrideManualFields: ['ftpWatts' as const],
      now,
    };

    const result = mergeProfileCandidates(params);

    expect(result.updates).toMatchObject({
      ftpWatts: 275,
      ftpWattsSource: 'activity_derived',
    });
    expect(result.updates).not.toHaveProperty('maxHrBpm');
    expect(result.synced.ftpWatts).toMatchObject({
      value: 275,
      source: 'activity_derived',
      status: 'updated',
    });
    expect(result.synced.maxHrBpm).toMatchObject({
      value: 182,
      source: 'manual',
      status: 'kept_manual',
    });
  });

  it('summarizes Garmin settings and activity-derived candidates separately', () => {
    expect(summarizeProfileCandidate('ftpWatts', 281, 'activity_derived')).toEqual({
      field: 'ftpWatts',
      value: 281,
      source: 'activity_derived',
      label: 'FTP aus bester 20-Minuten-Leistung',
    });
    expect(summarizeProfileCandidate('vo2max', 53, 'garmin_settings')).toEqual({
      field: 'vo2max',
      value: 53,
      source: 'garmin_settings',
      label: 'VO2max aus Garmin-Einstellungen',
    });
  });

  it('builds a UI view with fallback warnings for missing zone anchors', () => {
    const view = buildProfileProvenanceView({
      ftpWatts: null,
      ftpWattsSource: null,
      ftpWattsUpdatedAt: null,
      maxHrBpm: 185,
      maxHrBpmSource: 'activity_derived',
      maxHrBpmUpdatedAt: now,
      lthrBpm: null,
      lthrBpmSource: null,
      lthrBpmUpdatedAt: null,
      vo2max: 52,
      vo2maxSource: 'garmin_settings',
      vo2maxUpdatedAt: now,
    });

    expect(view.fields.ftpWatts).toMatchObject({
      value: null,
      source: 'missing',
      label: 'FTP',
      warning: 'Watt-Zonen nutzen Fallback 250 W.',
    });
    expect(view.fields.maxHrBpm).toMatchObject({
      value: 185,
      source: 'activity_derived',
      label: 'Max. Puls',
    });
    expect(view.fields.lthrBpm.warning).toBe('LTHR fehlt; HR-Zonen werden aus MaxHF geschätzt.');
  });
});
