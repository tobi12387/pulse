import type {
  PulseProfileMetricKey,
  PulseProfileMetricProvenance,
  PulseProfileProvenanceView,
  PulseProfileValueSource,
} from '@coaching-os/shared/pulse';

type StoredSource = Exclude<PulseProfileValueSource, 'missing'>;
type ProfileFieldColumn = 'ftpWatts' | 'maxHrBpm' | 'lthrBpm' | 'vo2max';
type ProfileSourceColumn = 'ftpWattsSource' | 'maxHrBpmSource' | 'lthrBpmSource' | 'vo2maxSource';
type ProfileUpdatedColumn = 'ftpWattsUpdatedAt' | 'maxHrBpmUpdatedAt' | 'lthrBpmUpdatedAt' | 'vo2maxUpdatedAt';

export type ProfileCandidate = {
  value: number | null;
  source: StoredSource;
};

export type ProfileCandidates = Partial<Record<PulseProfileMetricKey, ProfileCandidate>>;

export interface ExistingProfileForProvenance {
  ftpWatts?: number | null;
  ftpWattsSource?: string | null;
  ftpWattsUpdatedAt?: Date | string | null;
  maxHrBpm?: number | null;
  maxHrBpmSource?: string | null;
  maxHrBpmUpdatedAt?: Date | string | null;
  lthrBpm?: number | null;
  lthrBpmSource?: string | null;
  lthrBpmUpdatedAt?: Date | string | null;
  vo2max?: number | null;
  vo2maxSource?: string | null;
  vo2maxUpdatedAt?: Date | string | null;
}

export interface ProfileActivityCandidateRow {
  maxHr: number | null;
  rawData?: unknown;
}

export interface SyncedProfileField {
  field: PulseProfileMetricKey;
  value: number | null;
  source: PulseProfileValueSource;
  status: 'updated' | 'kept_manual' | 'unavailable';
  label: string;
}

const FIELD_META: Record<PulseProfileMetricKey, {
  label: string;
  valueKey: ProfileFieldColumn;
  sourceKey: ProfileSourceColumn;
  updatedKey: ProfileUpdatedColumn;
  fallbackWarning: string;
}> = {
  ftpWatts: {
    label: 'FTP',
    valueKey: 'ftpWatts',
    sourceKey: 'ftpWattsSource',
    updatedKey: 'ftpWattsUpdatedAt',
    fallbackWarning: 'Watt-Zonen nutzen Fallback 250 W.',
  },
  maxHrBpm: {
    label: 'Max. Puls',
    valueKey: 'maxHrBpm',
    sourceKey: 'maxHrBpmSource',
    updatedKey: 'maxHrBpmUpdatedAt',
    fallbackWarning: 'MaxHF fehlt; HR-Zonen nutzen Fallback 185 bpm.',
  },
  lthrBpm: {
    label: 'LTHR',
    valueKey: 'lthrBpm',
    sourceKey: 'lthrBpmSource',
    updatedKey: 'lthrBpmUpdatedAt',
    fallbackWarning: 'LTHR fehlt; HR-Zonen werden aus MaxHF geschätzt.',
  },
  vo2max: {
    label: 'VO2max',
    valueKey: 'vo2max',
    sourceKey: 'vo2maxSource',
    updatedKey: 'vo2maxUpdatedAt',
    fallbackWarning: 'VO2max fehlt; Zieltrend nutzt nur Aktivitaetsverlauf.',
  },
};

const SOURCE_LABELS: Record<PulseProfileValueSource, string> = {
  manual: 'Manuell',
  garmin_settings: 'Garmin',
  activity_derived: 'Aktivitaeten',
  estimated: 'Geschaetzt',
  missing: 'Fehlt',
};

const FIELD_ORDER: PulseProfileMetricKey[] = ['ftpWatts', 'maxHrBpm', 'lthrBpm', 'vo2max'];

function isStoredSource(value: unknown): value is StoredSource {
  return value === 'manual' || value === 'garmin_settings' || value === 'activity_derived' || value === 'estimated';
}

function normalizeSource(value: unknown, storedValue: number | null): PulseProfileValueSource {
  if (isStoredSource(value)) return value;
  return storedValue != null ? 'manual' : 'missing';
}

function dateToIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readPathNumber(source: unknown, keys: string[]): number | null {
  if (!source || typeof source !== 'object') return null;
  const obj = source as Record<string, unknown>;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

export function summarizeProfileCandidate(
  field: PulseProfileMetricKey,
  value: number | null,
  source: PulseProfileValueSource,
): Omit<SyncedProfileField, 'status'> {
  const labelByField: Record<PulseProfileMetricKey, Partial<Record<PulseProfileValueSource, string>>> = {
    ftpWatts: {
      manual: 'FTP manuell gesetzt',
      garmin_settings: 'FTP aus Garmin-Einstellungen',
      activity_derived: 'FTP aus bester 20-Minuten-Leistung',
      estimated: 'FTP geschaetzt',
      missing: 'FTP fehlt',
    },
    maxHrBpm: {
      manual: 'Max. Puls manuell gesetzt',
      garmin_settings: 'Max. Puls aus Garmin-Einstellungen',
      activity_derived: 'Max. Puls aus Aktivitaeten',
      estimated: 'Max. Puls geschaetzt',
      missing: 'Max. Puls fehlt',
    },
    lthrBpm: {
      manual: 'LTHR manuell gesetzt',
      garmin_settings: 'LTHR aus Garmin-Einstellungen',
      activity_derived: 'LTHR aus Aktivitaeten',
      estimated: 'LTHR aus MaxHF geschaetzt',
      missing: 'LTHR fehlt',
    },
    vo2max: {
      manual: 'VO2max manuell gesetzt',
      garmin_settings: 'VO2max aus Garmin-Einstellungen',
      activity_derived: 'VO2max aus Aktivitaeten',
      estimated: 'VO2max geschaetzt',
      missing: 'VO2max fehlt',
    },
  };

  return {
    field,
    value,
    source,
    label: labelByField[field][source] ?? `${FIELD_META[field].label}: ${SOURCE_LABELS[source]}`,
  };
}

export function buildProfileProvenanceView(profile: ExistingProfileForProvenance | null | undefined): PulseProfileProvenanceView {
  const fields = {} as Record<PulseProfileMetricKey, PulseProfileMetricProvenance>;
  const warnings: string[] = [];

  for (const field of FIELD_ORDER) {
    const meta = FIELD_META[field];
    const value = numberOrNull(profile?.[meta.valueKey]);
    const source = normalizeSource(profile?.[meta.sourceKey], value);
    const warning = value == null ? meta.fallbackWarning : null;
    if (warning) warnings.push(warning);
    fields[field] = {
      key: field,
      label: meta.label,
      value,
      source,
      sourceLabel: SOURCE_LABELS[source],
      updatedAt: source === 'missing' ? null : dateToIso(profile?.[meta.updatedKey]),
      warning,
    };
  }

  return { fields, warnings };
}

export function mergeProfileCandidates(params: {
  existing: ExistingProfileForProvenance | null | undefined;
  candidates: ProfileCandidates;
  overrideManualFields?: readonly PulseProfileMetricKey[] | undefined;
  now?: Date;
}): {
  updates: Record<string, unknown>;
  synced: Record<PulseProfileMetricKey, SyncedProfileField>;
} {
  const now = params.now ?? new Date();
  const overrideManualFields = new Set(params.overrideManualFields ?? []);
  const updates: Record<string, unknown> = {};
  const synced = {} as Record<PulseProfileMetricKey, SyncedProfileField>;

  for (const field of FIELD_ORDER) {
    const meta = FIELD_META[field];
    const candidate = params.candidates[field];
    const existingValue = numberOrNull(params.existing?.[meta.valueKey]);
    const existingSource = normalizeSource(params.existing?.[meta.sourceKey], existingValue);

    if (!candidate || candidate.value == null) {
      synced[field] = {
        ...summarizeProfileCandidate(field, existingValue, existingSource),
        status: 'unavailable',
      };
      continue;
    }

    if (existingValue != null && existingSource === 'manual' && !overrideManualFields.has(field)) {
      synced[field] = {
        ...summarizeProfileCandidate(field, existingValue, 'manual'),
        status: 'kept_manual',
      };
      continue;
    }

    updates[meta.valueKey] = candidate.value;
    updates[meta.sourceKey] = candidate.source;
    updates[meta.updatedKey] = now;
    synced[field] = {
      ...summarizeProfileCandidate(field, candidate.value, candidate.source),
      status: 'updated',
    };
  }

  if (Object.keys(updates).length > 0) updates.updatedAt = now;
  return { updates, synced };
}

export function extractGarminSettingsProfileCandidates(settings: unknown): ProfileCandidates {
  const userData = settings && typeof settings === 'object' && 'userData' in settings
    ? (settings as { userData?: unknown }).userData
    : settings;

  const vo2Run = readPathNumber(userData, ['vo2MaxRunning', 'vo2maxRunning', 'vo2MaxRunningValue']);
  const vo2Bike = readPathNumber(userData, ['vo2MaxCycling', 'vo2maxCycling', 'vo2MaxCyclingValue']);
  const vo2max = vo2Run != null && vo2Bike != null
    ? Math.round((vo2Run + vo2Bike) / 2)
    : (vo2Run ?? vo2Bike);

  const lthr = readPathNumber(userData, ['lactateThresholdHeartRate', 'lactateThresholdHr', 'lthrBpm']);
  const explicitMaxHr = readPathNumber(userData, ['maxHeartRate', 'maximumHeartRate', 'userMaximumHeartRate', 'maxHR']);
  const maxHr = explicitMaxHr ?? (lthr != null ? Math.round(lthr / 0.89) : null);
  const ftp = readPathNumber(userData, [
    'functionalThresholdPower',
    'cyclingFunctionalThresholdPower',
    'thresholdPower',
    'ftp',
    'ftpWatts',
  ]);

  return {
    ...(ftp != null ? { ftpWatts: { value: Math.round(ftp), source: 'garmin_settings' as const } } : {}),
    ...(maxHr != null ? { maxHrBpm: { value: Math.round(maxHr), source: 'garmin_settings' as const } } : {}),
    ...(lthr != null ? { lthrBpm: { value: Math.round(lthr), source: 'garmin_settings' as const } } : {}),
    ...(vo2max != null ? { vo2max: { value: Math.round(vo2max), source: 'garmin_settings' as const } } : {}),
  };
}

export function deriveActivityProfileCandidates(rows: ProfileActivityCandidateRow[]): ProfileCandidates {
  const maxHr = rows
    .map(row => row.maxHr)
    .filter((value): value is number => value != null && value > 0)
    .reduce((best, value) => Math.max(best, value), 0);

  const best20MinPower = rows
    .map(row => readPathNumber(row.rawData, [
      'max20MinPower',
      'max20MinutePower',
      'best20MinPower',
      'best20MinPowerWatts',
      'max20MinPowerWatts',
    ]))
    .filter((value): value is number => value != null && value > 0)
    .reduce((best, value) => Math.max(best, value), 0);

  return {
    ...(maxHr > 0 ? { maxHrBpm: { value: Math.round(maxHr), source: 'activity_derived' as const } } : {}),
    ...(best20MinPower > 0 ? { ftpWatts: { value: Math.round(best20MinPower * 0.95), source: 'activity_derived' as const } } : {}),
  };
}

export function combineProfileCandidates(params: {
  garminSettings: ProfileCandidates;
  activityDerived: ProfileCandidates;
}): ProfileCandidates {
  const combined: ProfileCandidates = {};
  const ftpWatts = params.garminSettings.ftpWatts ?? params.activityDerived.ftpWatts;
  const maxHrBpm = params.activityDerived.maxHrBpm ?? params.garminSettings.maxHrBpm;
  if (ftpWatts) combined.ftpWatts = ftpWatts;
  if (maxHrBpm) combined.maxHrBpm = maxHrBpm;
  if (params.garminSettings.lthrBpm) combined.lthrBpm = params.garminSettings.lthrBpm;
  if (params.garminSettings.vo2max) combined.vo2max = params.garminSettings.vo2max;
  return combined;
}
