import type {
  PulseGarminSignalUseCase,
  PulseGarminSignalUsefulnessItem,
  PulseGarminSignalUsefulnessResponse,
  PulseGarminSignalUsefulnessStatus,
} from '@coaching-os/shared/pulse';

export interface GarminSignalDailyMetric {
  date: string;
  hrvRmssd: number | null;
  sleepHours: number | null;
  bodyBatteryMax: number | null;
  bodyBatteryCharged: number | null;
  bodyBatteryDrained: number | null;
  bodyBatteryAtWake: number | null;
  highStressSec: number | null;
  mediumStressSec: number | null;
  lowStressSec: number | null;
  avgWakingRespiration: number | null;
  latestSpo2: number | null;
  syncedAt: string | null;
}

export interface GarminSignalSleepSession {
  date: string;
  sleepNeedMin: number | null;
  sleepActualMin: number | null;
  avgRespiration: number | null;
  bodyBatteryChange: number | null;
}

export interface GarminSignalActivity {
  date: string;
  hasWeather: boolean;
  hasHrZones: boolean;
  hasLaps: boolean;
  hasDetail: boolean;
}

export interface GarminSignalUsefulnessInput {
  range: { from: string; to: string; days: number };
  dailyMetrics: GarminSignalDailyMetric[];
  sleepSessions: GarminSignalSleepSession[];
  activities: GarminSignalActivity[];
  decisionEvidenceSignals: string[];
}

type SignalDefinition = {
  signalKey: string;
  label: string;
  currentConsumers: string[];
  recommendedNextConsumer: PulseGarminSignalUseCase | null;
  whyItMatters: string;
  coverageDays: (input: GarminSignalUsefulnessInput) => string[];
  evidence: (input: GarminSignalUsefulnessInput, days: string[]) => string[];
  usedWhen?: (input: GarminSignalUsefulnessInput) => boolean;
};

function uniqueDays(days: string[]): string[] {
  return [...new Set(days)].sort().reverse();
}

function statusFor(definition: SignalDefinition, input: GarminSignalUsefulnessInput, days: string[]): PulseGarminSignalUsefulnessStatus {
  if (days.length === 0) return 'missing_or_sparse';
  if (definition.usedWhen?.(input)) return 'used';
  if (definition.recommendedNextConsumer) return 'underused';
  return 'used';
}

function hasDecisionEvidence(input: GarminSignalUsefulnessInput, signalKey: string): boolean {
  return input.decisionEvidenceSignals.includes(signalKey);
}

function secondsToHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`;
}

const SIGNALS: SignalDefinition[] = [
  {
    signalKey: 'sleep_hrv',
    label: 'Schlaf + HRV',
    currentConsumers: ['Home', 'Coach', 'Risk Watch', 'Insights', 'Plan'],
    recommendedNextConsumer: null,
    whyItMatters: 'Basis fuer Readiness, Recovery und Tagesentscheidung.',
    coverageDays: input => uniqueDays(input.dailyMetrics
      .filter(row => row.hrvRmssd != null || row.sleepHours != null)
      .map(row => row.date)),
    evidence: (_input, days) => [`${days.length} Tage mit Schlaf/HRV-Signal`],
    usedWhen: input => hasDecisionEvidence(input, 'sleep_hrv'),
  },
  {
    signalKey: 'training_load_execution',
    label: 'Training Load + Ausfuehrung',
    currentConsumers: ['Plan', 'Race Command', 'Season Strategy', 'Daily Outcome'],
    recommendedNextConsumer: null,
    whyItMatters: 'Koppelt geplante Belastung, Ausfuehrung und Anpassung.',
    coverageDays: input => uniqueDays(input.activities.map(row => row.date)),
    evidence: (_input, days) => [`${days.length} Aktivitaetstage im Zeitraum`],
    usedWhen: input => hasDecisionEvidence(input, 'training_load_execution'),
  },
  {
    signalKey: 'body_battery_depth',
    label: 'Body Battery Tiefe',
    currentConsumers: ['Data', 'Recovery Depth'],
    recommendedNextConsumer: 'daily_decision',
    whyItMatters: 'Charge, Drain und Wert beim Aufwachen zeigen, ob Erholung wirklich aufgebaut oder nur verbraucht wurde.',
    coverageDays: input => uniqueDays(input.dailyMetrics
      .filter(row => row.bodyBatteryCharged != null || row.bodyBatteryDrained != null || row.bodyBatteryAtWake != null)
      .map(row => row.date)),
    evidence: input => {
      const latest = input.dailyMetrics.find(row => row.bodyBatteryCharged != null || row.bodyBatteryDrained != null || row.bodyBatteryAtWake != null);
      if (!latest) return ['Keine Body-Battery-Tiefenwerte im Zeitraum'];
      return [
        latest.bodyBatteryAtWake != null ? `Aufwachen ${latest.bodyBatteryAtWake}%` : null,
        latest.bodyBatteryCharged != null ? `Charge ${latest.bodyBatteryCharged}` : null,
        latest.bodyBatteryDrained != null ? `Drain ${latest.bodyBatteryDrained}` : null,
      ].filter((value): value is string => value != null);
    },
    usedWhen: input => hasDecisionEvidence(input, 'body_battery_depth'),
  },
  {
    signalKey: 'stress_duration',
    label: 'Stressdauer',
    currentConsumers: ['Risk Watch', 'Data'],
    recommendedNextConsumer: 'mental_load',
    whyItMatters: 'Stressdauer trennt kurze Spitzen von dauerhaftem Alltagsdruck und kann Mental-Load-Kontext schaerfen.',
    coverageDays: input => uniqueDays(input.dailyMetrics
      .filter(row => row.highStressSec != null || row.mediumStressSec != null || row.lowStressSec != null)
      .map(row => row.date)),
    evidence: input => {
      const latest = input.dailyMetrics.find(row => row.highStressSec != null || row.mediumStressSec != null);
      if (!latest) return ['Keine Stressdauer im Zeitraum'];
      return [
        latest.highStressSec != null ? `High ${secondsToHours(latest.highStressSec)}` : null,
        latest.mediumStressSec != null ? `Medium ${secondsToHours(latest.mediumStressSec)}` : null,
      ].filter((value): value is string => value != null);
    },
    usedWhen: input => hasDecisionEvidence(input, 'stress_duration'),
  },
  {
    signalKey: 'respiration',
    label: 'Respiration',
    currentConsumers: ['Data', 'Recovery Depth'],
    recommendedNextConsumer: 'daily_decision',
    whyItMatters: 'Atemfrequenz kann Recovery- und Krankheitskontext ergaenzen, ohne sofort neue Diagnosen abzuleiten.',
    coverageDays: input => uniqueDays([
      ...input.dailyMetrics.filter(row => row.avgWakingRespiration != null).map(row => row.date),
      ...input.sleepSessions.filter(row => row.avgRespiration != null).map(row => row.date),
    ]),
    evidence: input => {
      const latestDaily = input.dailyMetrics.find(row => row.avgWakingRespiration != null);
      const latestSleep = input.sleepSessions.find(row => row.avgRespiration != null);
      return [
        latestDaily?.avgWakingRespiration != null ? `Wach ${latestDaily.avgWakingRespiration.toFixed(1)}/min` : null,
        latestSleep?.avgRespiration != null ? `Schlaf ${latestSleep.avgRespiration.toFixed(1)}/min` : null,
      ].filter((value): value is string => value != null);
    },
    usedWhen: input => hasDecisionEvidence(input, 'respiration'),
  },
  {
    signalKey: 'spo2',
    label: 'SpO2',
    currentConsumers: ['Data', 'Recovery Depth'],
    recommendedNextConsumer: 'daily_decision',
    whyItMatters: 'SpO2 kann Atem-/Hoehen-/Belastungskontext vorsichtig markieren, wenn Werte geliefert werden.',
    coverageDays: input => uniqueDays(input.dailyMetrics
      .filter(row => row.latestSpo2 != null)
      .map(row => row.date)),
    evidence: input => {
      const latest = input.dailyMetrics.find(row => row.latestSpo2 != null);
      return latest?.latestSpo2 != null ? [`Zuletzt ${latest.latestSpo2.toFixed(0)}%`] : ['Keine SpO2-Werte im Zeitraum'];
    },
    usedWhen: input => hasDecisionEvidence(input, 'spo2'),
  },
  {
    signalKey: 'activity_hr_zones_laps',
    label: 'HR-Zonen + Laps',
    currentConsumers: ['Activity Detail'],
    recommendedNextConsumer: 'plan_generation',
    whyItMatters: 'HR-Zonen und Laps zeigen Ausfuehrungsqualitaet: ob harte Reize wirklich hart und lockere Einheiten locker waren.',
    coverageDays: input => uniqueDays(input.activities
      .filter(row => row.hasHrZones || row.hasLaps || row.hasDetail)
      .map(row => row.date)),
    evidence: (_input, days) => [`${days.length} Tage mit Detailcache`],
    usedWhen: input => hasDecisionEvidence(input, 'activity_hr_zones_laps'),
  },
  {
    signalKey: 'weather_detail_pairing',
    label: 'Wetter + Aktivitaet',
    currentConsumers: ['Activity Detail', 'Data Coverage'],
    recommendedNextConsumer: 'recovery_note',
    whyItMatters: 'Wetter erklaert Hitze, Kaelte, Wind und Belastungsdrift bei Einheiten besser als Pace/HR allein.',
    coverageDays: input => uniqueDays(input.activities
      .filter(row => row.hasWeather)
      .map(row => row.date)),
    evidence: (_input, days) => [`${days.length} Aktivitaetstage mit Wetter`],
    usedWhen: input => hasDecisionEvidence(input, 'weather_detail_pairing'),
  },
];

export function buildGarminSignalUsefulness(input: GarminSignalUsefulnessInput): PulseGarminSignalUsefulnessResponse {
  const items: PulseGarminSignalUsefulnessItem[] = SIGNALS.map(definition => {
    const days = definition.coverageDays(input);
    return {
      signalKey: definition.signalKey,
      label: definition.label,
      status: statusFor(definition, input, days),
      coverageDays: days.length,
      sampleDays: days.slice(0, 3),
      currentConsumers: definition.currentConsumers,
      recommendedNextConsumer: definition.recommendedNextConsumer,
      whyItMatters: definition.whyItMatters,
      evidence: definition.evidence(input, days),
    };
  });

  const topUnderused = items
    .filter(item => item.status === 'underused')
    .sort((a, b) => b.coverageDays - a.coverageDays || a.label.localeCompare(b.label))
    .slice(0, 3);
  const recommendedUseCases = [...new Set(topUnderused
    .map(item => item.recommendedNextConsumer)
    .filter((value): value is PulseGarminSignalUseCase => value != null))];

  return {
    range: input.range,
    summary: {
      used: items.filter(item => item.status === 'used').length,
      underused: items.filter(item => item.status === 'underused').length,
      missingOrSparse: items.filter(item => item.status === 'missing_or_sparse').length,
    },
    items,
    topUnderused,
    recommendedUseCases,
  };
}
