import type {
  PulseGarminBackfillDomain,
  PulseGarminCoverageCircuitState,
  PulseGarminCoverageDomain,
  PulseGarminCoverageDomainState,
  PulseGarminCoverageRepairAction,
  PulseGarminCoverageResponse,
} from '@coaching-os/shared/pulse';

export type GarminCoverageDomain = PulseGarminCoverageDomain;
export type GarminCoverageRepairAction = PulseGarminCoverageRepairAction;
export type GarminCoverageDomainState = PulseGarminCoverageDomainState;
export type GarminCoverageCircuitState = PulseGarminCoverageCircuitState;

export interface GarminDataQualityInput {
  today: string;
  now: string;
  range: { from: string; to: string; days: number };
  dailyMetrics: Array<{
    date: string;
    syncedAt: string | null;
    hrvRmssd: number | null;
    sleepHours: number | null;
    bodyBatteryMax: number | null;
    stressAvg: number | null;
    steps: number | null;
  }>;
  sleepSessions: Array<{
    date: string;
    durationH: number | null;
    deepSleepH: number | null;
    remSleepH: number | null;
    lightSleepH: number | null;
    awakeH: number | null;
  }>;
  activities: Array<{
    startTime: string;
    weather: unknown | null;
  }>;
  weightLogs: Array<{
    date: string;
    bodyFatPct: number | null;
    muscleMassKg: number | null;
    bmi: number | null;
  }>;
  plannedWorkouts: Array<{
    plannedDate: string;
    garminWorkoutId: string | null;
    garminScheduledId: string | null;
  }>;
  circuit?: GarminCoverageCircuitState;
}

export type GarminDataQualityResponse = PulseGarminCoverageResponse;

const GARMIN_DATA_DOMAINS: GarminCoverageDomain[] = [
  'activities',
  'daily_metrics',
  'sleep',
  'hrv',
  'body_composition',
];

const DOMAIN_LABELS: Record<GarminCoverageDomain, string> = {
  activities: 'Aktivitäten',
  daily_metrics: 'Tagesmetriken',
  sleep: 'Schlaf',
  hrv: 'HRV',
  body_composition: 'Körperdaten',
  planned_workouts: 'Workout-Vorlagen',
  calendar: 'Garmin-Kalender',
};

function isoDate(value: string): string {
  return value.includes('T') ? value.split('T')[0]! : value;
}

function dateRange(from: string, to: string): string[] {
  const result: string[] = [];
  const end = new Date(`${to}T00:00:00.000Z`);
  for (let cur = new Date(`${from}T00:00:00.000Z`); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
    result.push(cur.toISOString().split('T')[0]!);
  }
  return result;
}

function latest<T>(rows: T[], value: (row: T) => string | null | undefined): T | null {
  return rows.reduce<T | null>((current, row) => {
    const nextValue = value(row);
    if (!nextValue) return current;
    const currentValue = current ? value(current) : null;
    return !currentValue || nextValue > currentValue ? row : current;
  }, null);
}

function withinHours(value: string | null, now: string, hours: number): boolean {
  if (!value) return false;
  const diff = new Date(now).getTime() - new Date(value).getTime();
  return diff >= 0 && diff <= hours * 60 * 60 * 1000;
}

function daysSince(date: string | null, today: string): number | null {
  if (!date) return null;
  const diff = new Date(`${today}T00:00:00.000Z`).getTime() - new Date(`${date}T00:00:00.000Z`).getTime();
  return Math.floor(diff / 86_400_000);
}

function boundedCandidateDays(days: string[]): string[] {
  return [...new Set(days)].sort().slice(-31);
}

function action(
  label: string,
  domains: PulseGarminBackfillDomain[],
  candidateDays: string[],
): GarminCoverageRepairAction | null {
  const bounded = boundedCandidateDays(candidateDays);
  if (bounded.length === 0) return null;
  return {
    type: 'backfill',
    label,
    route: '/data?tab=abdeckung',
    domains,
    candidateDays: bounded,
  };
}

function baseDomain(domain: GarminCoverageDomain, overrides: Partial<GarminCoverageDomainState>): GarminCoverageDomainState {
  return {
    domain,
    label: DOMAIN_LABELS[domain],
    status: 'missing',
    reason: 'Keine Daten vorhanden.',
    lastFreshAt: null,
    lastFreshDate: null,
    missingDays: 0,
    partialDays: 0,
    repairableDays: 0,
    repairAction: null,
    evidence: [],
    ...overrides,
  };
}

function blockIfNeeded(
  row: GarminCoverageDomainState,
  circuit: GarminCoverageCircuitState,
): GarminCoverageDomainState {
  if (circuit.status !== 'open' || !GARMIN_DATA_DOMAINS.includes(row.domain)) return row;
  return {
    ...row,
    status: 'blocked',
    reason: circuit.reason ?? 'Garmin-Sync ist momentan blockiert.',
    repairAction: null,
    evidence: [...row.evidence, 'Circuit Breaker offen', `${circuit.failures ?? 0} Fehlversuche`],
  };
}

function dailyFieldMissing(row: GarminDataQualityInput['dailyMetrics'][number]): boolean {
  return [row.hrvRmssd, row.sleepHours, row.bodyBatteryMax, row.stressAvg, row.steps].some(value => value == null);
}

function hasSleepStages(row: GarminDataQualityInput['sleepSessions'][number]): boolean {
  return [row.deepSleepH, row.remSleepH, row.lightSleepH, row.awakeH].some(value => value != null);
}

function hasBodyComposition(row: GarminDataQualityInput['weightLogs'][number]): boolean {
  return [row.bodyFatPct, row.muscleMassKg, row.bmi].some(value => value != null);
}

function buildDailyMetrics(input: GarminDataQualityInput, allDays: string[]): GarminCoverageDomainState {
  const byDate = new Map(input.dailyMetrics.map(row => [row.date, row]));
  const missingDays = allDays.filter(day => !byDate.has(day));
  const partialDays = input.dailyMetrics.filter(dailyFieldMissing).map(row => row.date);
  const latestMetric = latest(input.dailyMetrics, row => row.date);
  const latestSync = latest(input.dailyMetrics, row => row.syncedAt);
  const latestDate = latestMetric?.date ?? null;
  const isFresh = latestDate === input.today && latestMetric != null && !dailyFieldMissing(latestMetric);
  const staleByDays = daysSince(latestDate, input.today);
  const repairDays = [...missingDays, ...partialDays].filter(day => day <= input.today);

  if (input.dailyMetrics.length === 0) {
    return baseDomain('daily_metrics', {
      status: 'missing',
      reason: 'Keine Tagesmetriken im gewählten Zeitraum.',
      missingDays: allDays.length,
      repairableDays: repairDays.length,
      repairAction: action('Tagesmetriken nachladen', ['dailyMetrics'], repairDays),
      evidence: ['0 Tage mit Tagesmetriken'],
    });
  }

  return baseDomain('daily_metrics', {
    status: isFresh ? 'fresh' : partialDays.length > 0 || missingDays.length > 0 ? 'partial' : staleByDays != null && staleByDays > 1 ? 'stale' : 'fresh',
    reason: isFresh
      ? 'Tagesmetriken sind aktuell und vollständig.'
      : partialDays.length > 0
        ? 'Tagesmetriken sind vorhanden, aber einzelne Felder fehlen.'
        : missingDays.length > 0
          ? 'Tagesmetriken haben Lücken im Zeitraum.'
          : 'Tagesmetriken sind nicht mehr aktuell.',
    lastFreshAt: latestSync?.syncedAt ?? null,
    lastFreshDate: latestDate,
    missingDays: missingDays.length,
    partialDays: partialDays.length,
    repairableDays: repairDays.length,
    repairAction: action('Tagesmetriken nachladen', ['dailyMetrics'], repairDays),
    evidence: [
      `${input.dailyMetrics.length} Tage mit Tagesmetriken`,
      latestDate ? `Letzter Tag ${latestDate}` : 'Kein letzter Tag',
    ],
  });
}

function buildHrv(input: GarminDataQualityInput): GarminCoverageDomainState {
  const rowsWithHrv = input.dailyMetrics.filter(row => row.hrvRmssd != null);
  const missingDays = input.dailyMetrics.filter(row => row.hrvRmssd == null).map(row => row.date);
  const latestHrv = latest(rowsWithHrv, row => row.date);
  const latestDate = latestHrv?.date ?? null;
  const age = daysSince(latestDate, input.today);

  if (rowsWithHrv.length === 0) {
    return baseDomain('hrv', {
      status: 'missing',
      reason: 'Keine HRV-Werte im gewählten Zeitraum.',
      missingDays: missingDays.length,
      repairableDays: missingDays.length,
      repairAction: action('HRV nachladen', ['dailyMetrics'], missingDays),
      evidence: ['0 Tage mit HRV'],
    });
  }

  return baseDomain('hrv', {
    status: missingDays.length > 0 ? 'partial' : age != null && age > 3 ? 'stale' : 'fresh',
    reason: missingDays.length > 0
      ? 'HRV ist nutzbar, aber einzelne Tage fehlen.'
      : age != null && age > 3
        ? 'HRV ist vorhanden, aber nicht mehr frisch.'
        : 'HRV ist aktuell nutzbar.',
    lastFreshDate: latestDate,
    lastFreshAt: latestHrv?.syncedAt ?? null,
    missingDays: missingDays.length,
    partialDays: missingDays.length,
    repairableDays: missingDays.length,
    repairAction: action('HRV nachladen', ['dailyMetrics'], missingDays),
    evidence: [`${rowsWithHrv.length} Tage mit HRV`],
  });
}

function buildSleep(input: GarminDataQualityInput, allDays: string[]): GarminCoverageDomainState {
  const sessionByDate = new Map(input.sleepSessions.map(row => [row.date, row]));
  const dailyByDate = new Map(input.dailyMetrics.map(row => [row.date, row]));
  const sleepDays = allDays.filter(day => {
    const session = sessionByDate.get(day);
    const daily = dailyByDate.get(day);
    return session != null || daily?.sleepHours != null;
  });
  const partialDays = sleepDays.filter(day => {
    const session = sessionByDate.get(day);
    return !session || !hasSleepStages(session);
  });
  const candidateDays = allDays.filter(day => {
    const daily = dailyByDate.get(day);
    const session = sessionByDate.get(day);
    return daily != null && (daily.sleepHours == null || !session || !hasSleepStages(session));
  });
  const latestSleepDate = sleepDays.sort().at(-1) ?? null;
  const latestSession = latest(input.sleepSessions, row => row.date);
  const age = daysSince(latestSleepDate, input.today);

  if (sleepDays.length === 0) {
    return baseDomain('sleep', {
      status: 'missing',
      reason: 'Keine Schlafdaten im gewählten Zeitraum.',
      missingDays: allDays.length,
      repairableDays: candidateDays.length,
      repairAction: action('Schlaf nachladen', ['sleep'], candidateDays.length > 0 ? candidateDays : [input.today]),
      evidence: ['0 Tage mit Schlaf'],
    });
  }

  return baseDomain('sleep', {
    status: partialDays.length > 0 ? 'partial' : age != null && age > 2 ? 'stale' : 'fresh',
    reason: partialDays.length > 0
      ? 'Schlaf ist vorhanden, aber Detailstufen fehlen.'
      : age != null && age > 2
        ? 'Schlafdaten sind vorhanden, aber nicht mehr frisch.'
        : 'Schlafdaten sind aktuell.',
    lastFreshDate: latestSleepDate,
    lastFreshAt: latestSession?.date === latestSleepDate ? `${latestSleepDate}T00:00:00.000Z` : null,
    missingDays: Math.max(0, allDays.length - sleepDays.length),
    partialDays: partialDays.length,
    repairableDays: candidateDays.length,
    repairAction: action('Schlaf nachladen', ['sleep'], candidateDays),
    evidence: [`${sleepDays.length} Tage mit Schlaf`, `${input.sleepSessions.filter(hasSleepStages).length} Tage mit Schlafphasen`],
  });
}

function buildActivities(input: GarminDataQualityInput): GarminCoverageDomainState {
  const latestActivity = latest(input.activities, row => row.startTime);
  const latestAt = latestActivity?.startTime ?? null;
  const latestDate = latestAt ? isoDate(latestAt) : null;
  const missingWeather = input.activities.filter(row => row.weather == null).length;

  if (input.activities.length === 0) {
    return baseDomain('activities', {
      status: 'missing',
      reason: 'Keine Aktivitäten im gewählten Zeitraum.',
      missingDays: input.range.days,
      evidence: ['0 Aktivitäten'],
    });
  }

  return baseDomain('activities', {
    status: missingWeather > 0 ? 'partial' : withinHours(latestAt, input.now, 24) ? 'fresh' : 'stale',
    reason: missingWeather > 0
      ? 'Aktivitäten sind vorhanden, aber Wetterdaten fehlen teilweise.'
      : withinHours(latestAt, input.now, 24)
        ? 'Aktivitäten sind frisch synchronisiert.'
        : 'Aktivitäten sind vorhanden, aber die letzte Aktivität ist älter.',
    lastFreshAt: latestAt,
    lastFreshDate: latestDate,
    partialDays: missingWeather,
    repairableDays: missingWeather,
    repairAction: action('Aktivitätswetter nachladen', ['weather'], input.activities.filter(row => row.weather == null).map(row => isoDate(row.startTime))),
    evidence: [`${input.activities.length} Aktivitäten`, `${missingWeather} ohne Wetter`],
  });
}

function buildBodyComposition(input: GarminDataQualityInput): GarminCoverageDomainState {
  const latestWeight = latest(input.weightLogs, row => row.date);
  const latestComposition = latest(input.weightLogs.filter(hasBodyComposition), row => row.date);
  const candidateDays = input.weightLogs.filter(row => !hasBodyComposition(row)).map(row => row.date);
  const compositionAge = daysSince(latestComposition?.date ?? null, input.today);

  if (input.weightLogs.length === 0) {
    return baseDomain('body_composition', {
      status: 'missing',
      reason: 'Keine Gewichts- oder Körperdaten im gewählten Zeitraum.',
      missingDays: input.range.days,
      repairableDays: 1,
      repairAction: action('Körperdaten nachladen', ['weight'], [input.today]),
      evidence: ['0 Gewichtseinträge'],
    });
  }

  return baseDomain('body_composition', {
    status: latestComposition && (compositionAge == null || compositionAge <= 14) ? 'fresh' : 'stale',
    reason: latestComposition && (compositionAge == null || compositionAge <= 14)
      ? 'Körperzusammensetzung ist aktuell.'
      : 'Gewicht ist vorhanden, aber Körperzusammensetzung fehlt oder ist alt.',
    lastFreshDate: latestComposition?.date ?? latestWeight?.date ?? null,
    lastFreshAt: latestComposition ? `${latestComposition.date}T00:00:00.000Z` : null,
    partialDays: candidateDays.length,
    repairableDays: candidateDays.length || 1,
    repairAction: action('Körperdaten nachladen', ['weight'], candidateDays.length > 0 ? candidateDays : [input.today]),
    evidence: [`${input.weightLogs.length} Gewichtseinträge`, `${input.weightLogs.filter(hasBodyComposition).length} mit Körperzusammensetzung`],
  });
}

function buildPlannedWorkouts(input: GarminDataQualityInput): GarminCoverageDomainState {
  const future = input.plannedWorkouts.filter(row => row.plannedDate >= input.today);
  const missingTemplates = future.filter(row => !row.garminWorkoutId);

  if (future.length === 0) {
    return baseDomain('planned_workouts', {
      status: 'missing',
      reason: 'Keine zukünftigen Pulse-Workouts geplant.',
      repairAction: { type: 'plan', label: 'Plan prüfen', route: '/plan' },
      evidence: ['0 geplante Workouts'],
    });
  }

  return baseDomain('planned_workouts', {
    status: missingTemplates.length > 0 ? 'partial' : 'fresh',
    reason: missingTemplates.length > 0
      ? 'Einige geplante Workouts haben noch keine Garmin-Vorlage.'
      : 'Alle zukünftigen Workouts haben Garmin-Vorlagen.',
    lastFreshDate: future.filter(row => row.garminWorkoutId).map(row => row.plannedDate).sort().at(-1) ?? null,
    missingDays: missingTemplates.length,
    repairableDays: missingTemplates.length,
    repairAction: missingTemplates.length > 0
      ? { type: 'calendar_sync', label: 'Garmin-Kalender synchronisieren', route: '/settings', candidateDays: missingTemplates.map(row => row.plannedDate) }
      : null,
    evidence: [`${future.length} zukünftige Workouts`, `${missingTemplates.length} ohne Garmin-Vorlage`],
  });
}

function buildCalendar(input: GarminDataQualityInput): GarminCoverageDomainState {
  const future = input.plannedWorkouts.filter(row => row.plannedDate >= input.today);
  const missingSchedule = future.filter(row => !row.garminScheduledId);

  if (future.length === 0) {
    return baseDomain('calendar', {
      status: 'missing',
      reason: 'Kein zukünftiger Plan für den Garmin-Kalender.',
      repairAction: { type: 'plan', label: 'Plan prüfen', route: '/plan' },
      evidence: ['0 geplante Kalendereinträge'],
    });
  }

  return baseDomain('calendar', {
    status: missingSchedule.length > 0 ? 'partial' : 'fresh',
    reason: missingSchedule.length > 0
      ? 'Einige zukünftige Workouts sind noch nicht im Garmin-Kalender geplant.'
      : 'Alle zukünftigen Workouts sind im Garmin-Kalender geplant.',
    lastFreshDate: future.filter(row => row.garminScheduledId).map(row => row.plannedDate).sort().at(-1) ?? null,
    missingDays: missingSchedule.length,
    repairableDays: missingSchedule.length,
    repairAction: missingSchedule.length > 0
      ? { type: 'calendar_sync', label: 'Garmin-Kalender synchronisieren', route: '/settings', candidateDays: missingSchedule.map(row => row.plannedDate) }
      : null,
    evidence: [`${future.length} zukünftige Workouts`, `${missingSchedule.length} ohne Garmin-Termin`],
  });
}

export function buildGarminDataQuality(input: GarminDataQualityInput): GarminDataQualityResponse {
  const circuit = input.circuit ?? { status: 'unknown', failures: null, reason: null };
  const allDays = dateRange(input.range.from, input.range.to);
  const domains = [
    buildActivities(input),
    buildDailyMetrics(input, allDays),
    buildSleep(input, allDays),
    buildHrv(input),
    buildBodyComposition(input),
    buildPlannedWorkouts(input),
    buildCalendar(input),
  ].map(row => blockIfNeeded(row, circuit));

  return {
    range: input.range,
    generatedAt: input.now,
    circuit,
    domains,
  };
}
