export interface NormalizedGarminSleepData {
  durationH: number | null;
  sleepScore: number | null;
  deepSleepH: number | null;
  remSleepH: number | null;
  lightSleepH: number | null;
  awakeH: number | null;
  hrvRmssd: number | null;
  hrvStatus: string | null;
  startTime: Date | null;
  endTime: Date | null;
  sleepNeedMin: number | null;
  sleepActualMin: number | null;
  avgSleepStress: number | null;
  avgSleepHr: number | null;
  avgRespiration: number | null;
  restlessMoments: number | null;
  bodyBatteryChange: number | null;
  breathingDisruptionIndex: number | null;
  rawData: unknown;
}

export interface NormalizedGarminDailySummary {
  steps: number | null;
  caloriesActive: number | null;
  stressAvg: number | null;
  bodyBatteryMin: number | null;
  bodyBatteryMax: number | null;
  bodyBatteryCharged: number | null;
  bodyBatteryDrained: number | null;
  bodyBatteryHighest: number | null;
  bodyBatteryLowest: number | null;
  bodyBatteryAtWake: number | null;
  maxStress: number | null;
  lowStressSec: number | null;
  mediumStressSec: number | null;
  highStressSec: number | null;
  moderateIntensityMin: number | null;
  vigorousIntensityMin: number | null;
  avgWakingRespiration: number | null;
  latestSpo2: number | null;
  rawData: unknown;
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function int(value: unknown): number | null {
  const n = num(value);
  return n == null ? null : Math.round(n);
}

function pickNumber(source: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!source) return null;
  for (const key of keys) {
    const value = num(source[key]);
    if (value != null) return value;
  }
  return null;
}

function secondsToHours(value: unknown): number | null {
  const seconds = num(value);
  return seconds == null ? null : Math.round((seconds / 3600) * 100) / 100;
}

function secondsToMinutes(value: unknown): number | null {
  const seconds = num(value);
  return seconds == null ? null : Math.round(seconds / 60);
}

function parseGarminTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const normalized = /(?:Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function normalizeGarminSleepData(payload: unknown): NormalizedGarminSleepData {
  const root = record(payload);
  const dto = record(root?.['dailySleepDTO']) ?? root;
  const scores = record(dto?.['sleepScores']);
  const overall = record(scores?.['overall']);

  const sleepTimeSeconds = pickNumber(dto, ['sleepTimeSeconds', 'sleepDurationSeconds']);

  return {
    durationH: secondsToHours(sleepTimeSeconds),
    sleepScore: int(overall?.['value'] ?? dto?.['sleepScore']),
    deepSleepH: secondsToHours(dto?.['deepSleepSeconds']),
    remSleepH: secondsToHours(dto?.['remSleepSeconds']),
    lightSleepH: secondsToHours(dto?.['lightSleepSeconds']),
    awakeH: secondsToHours(dto?.['awakeSleepSeconds']),
    hrvRmssd: pickNumber(root, ['avgOvernightHrv', 'averageOvernightHrv']),
    hrvStatus: typeof root?.['hrvStatus'] === 'string' ? String(root['hrvStatus']).toLowerCase() : null,
    startTime: parseGarminTimestamp(dto?.['sleepStartTimestampGMT'] ?? dto?.['sleepStartTimestampLocal'] ?? dto?.['startTimeGMT']),
    endTime: parseGarminTimestamp(dto?.['sleepEndTimestampGMT'] ?? dto?.['sleepEndTimestampLocal'] ?? dto?.['endTimeGMT']),
    sleepNeedMin: int(dto?.['sleepNeedMinutes'] ?? dto?.['sleepNeedMin']),
    sleepActualMin: secondsToMinutes(sleepTimeSeconds),
    avgSleepStress: int(dto?.['averageStressLevel'] ?? dto?.['avgSleepStress']),
    avgSleepHr: int(dto?.['averageHeartRate'] ?? dto?.['avgSleepHr']),
    avgRespiration: pickNumber(dto, ['averageRespiration', 'averageRespirationValue', 'avgRespiration']),
    restlessMoments: int(dto?.['restlessMomentsCount'] ?? dto?.['restlessMomentCount'] ?? dto?.['restlessMoments']),
    bodyBatteryChange: int(dto?.['bodyBatteryChange'] ?? dto?.['sleepBodyBatteryChange']),
    breathingDisruptionIndex: pickNumber(dto, ['breathingDisruptionIndex', 'breathingDisturbanceIndex']),
    rawData: payload,
  };
}

export function normalizeGarminDailySummary(payload: unknown): NormalizedGarminDailySummary {
  const summary = record(payload);
  const latestBodyBattery = int(summary?.['bodyBatteryMostRecentValue']);
  const minBodyBattery = int(summary?.['minBodyBatteryLevel']);
  const maxBodyBattery = int(summary?.['maxBodyBatteryLevel']);

  return {
    steps: int(summary?.['totalSteps']),
    caloriesActive: int(summary?.['activeKilocalories']),
    stressAvg: int(summary?.['averageStressLevel']),
    bodyBatteryMin: minBodyBattery,
    bodyBatteryMax: latestBodyBattery,
    bodyBatteryCharged: int(summary?.['bodyBatteryChargedValue'] ?? summary?.['bodyBatteryCharged']),
    bodyBatteryDrained: int(summary?.['bodyBatteryDrainedValue'] ?? summary?.['bodyBatteryDrained']),
    bodyBatteryHighest: maxBodyBattery,
    bodyBatteryLowest: minBodyBattery,
    bodyBatteryAtWake: int(summary?.['bodyBatteryAtWake'] ?? summary?.['bodyBatteryAtWakeup']),
    maxStress: int(summary?.['maxStressLevel'] ?? summary?.['maximumStressLevel']),
    lowStressSec: int(summary?.['lowStressDuration'] ?? summary?.['lowStressSeconds']),
    mediumStressSec: int(summary?.['mediumStressDuration'] ?? summary?.['mediumStressSeconds']),
    highStressSec: int(summary?.['highStressDuration'] ?? summary?.['highStressSeconds']),
    moderateIntensityMin: int(summary?.['moderateIntensityMinutes']),
    vigorousIntensityMin: int(summary?.['vigorousIntensityMinutes']),
    avgWakingRespiration: pickNumber(summary, ['averageWakingRespirationValue', 'avgWakingRespiration']),
    latestSpo2: pickNumber(summary, ['latestSpo2', 'latestPulseOx']),
    rawData: payload,
  };
}
