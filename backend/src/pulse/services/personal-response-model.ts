import type {
  PulseDailyDecisionQualityResponse,
  PulseDailyOutcomeLearningItem,
  PulseFuelingOutcomeBaseline,
  PulsePersonalResponseSignal,
  PulsePersonalResponseSummary,
} from '@coaching-os/shared/pulse';

export interface PersonalResponseMentalCheckin {
  date: string;
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
}

export interface PersonalResponseExecutionReview {
  date: string;
  plannedZone: number | null;
  rpe: number | null;
  durationMin: number | null;
  tss: number | null;
}

export interface BuildPersonalResponseSummaryInput {
  today: string;
  days: number;
  dailyOutcomes: PulseDailyOutcomeLearningItem[];
  decisionQuality: PulseDailyDecisionQualityResponse | null;
  fuelingBaseline: PulseFuelingOutcomeBaseline | null;
  mentalCheckins: PersonalResponseMentalCheckin[];
  executionReviews: PersonalResponseExecutionReview[];
}

function shiftIsoDate(date: string, days: number): string {
  const current = new Date(`${date}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() + days);
  return current.toISOString().split('T')[0]!;
}

function evidenceStrength(count: number): PulsePersonalResponseSummary['strength'] {
  if (count >= 6) return 'useful';
  if (count >= 3) return 'learning';
  return 'insufficient';
}

function buildExecutionSignal(input: BuildPersonalResponseSummaryInput): PulsePersonalResponseSignal {
  const usefulOutcomes = input.dailyOutcomes.filter(item => item.status === 'reinforced' || item.status === 'superseded_by_data');
  const staleOutcomes = input.dailyOutcomes.filter(item => item.status === 'stale_pattern');
  const highRpeReviews = input.executionReviews.filter(review => review.rpe != null && review.rpe >= 8);
  const decisionQualityEvidence = input.decisionQuality
    ? [`Entscheidungsqualität ${input.decisionQuality.statusLabel} (${input.decisionQuality.qualityScore}/100)`]
    : [];
  const strength = evidenceStrength(usefulOutcomes.length + staleOutcomes.length + highRpeReviews.length);

  return {
    kind: 'execution_response',
    label: strength === 'insufficient' ? 'Ausfuehrung noch lernen' : 'Ausfuehrung reagiert sichtbar',
    strength,
    summary: strength === 'insufficient'
      ? 'Pulse hat noch zu wenige abgeschlossene Entscheidungen mit Folgeevidenz.'
      : `${usefulOutcomes.length} Entscheidung(en) wurden bestaetigt, ${staleOutcomes.length} wiederholte Muster sollten vorsichtig angepasst werden.`,
    evidence: [
      `${usefulOutcomes.length} bestaetigte oder durch Garmin ersetzte Entscheidung(en)`,
      `${staleOutcomes.length} stale Entscheidungsmuster`,
      `${highRpeReviews.length} hohe RPE-Ausfuehrung(en)`,
      ...decisionQualityEvidence,
    ],
    nextAdjustment: strength === 'insufficient'
      ? 'Nach wichtigen Einheiten Feedback, Fueling und naechste Tagesdaten erfassen.'
      : 'Bestaetigte Entscheidungstypen beibehalten und stale Muster kleiner oder anders getaktet anbieten.',
  };
}

function buildMentalSignal(input: BuildPersonalResponseSummaryInput): PulsePersonalResponseSignal {
  const lowEnergy = input.mentalCheckins.filter(checkin => checkin.energy <= 4 || checkin.stress >= 7);
  const strength = evidenceStrength(input.mentalCheckins.length);

  return {
    kind: 'mental_response',
    label: strength === 'insufficient' ? 'Mentaler Kontext offen' : 'Mentale Last einbeziehen',
    strength,
    summary: strength === 'insufficient'
      ? 'Zu wenige Check-ins fuer ein stabiles persoenliches Muster.'
      : `${lowEnergy.length} von ${input.mentalCheckins.length} Check-ins zeigen niedrige Energie oder hohen Stress.`,
    evidence: [
      `${input.mentalCheckins.length} Check-in(s) im Zeitraum`,
      `${lowEnergy.length} Check-in(s) mit Energie <=4 oder Stress >=7`,
    ],
    nextAdjustment: lowEnergy.length >= 2
      ? 'An Tagen mit niedriger Energie oder hohem Stress zuerst Boundary, Warm-up und leichtere Alternative anbieten.'
      : 'Mentalen Kontext weiter erfassen, aber keine harte Planbremse daraus ableiten.',
  };
}

function buildFuelingSignal(input: BuildPersonalResponseSummaryInput): PulsePersonalResponseSignal {
  const baseline = input.fuelingBaseline;
  const strength = baseline == null || baseline.status === 'insufficient_data' ? 'insufficient' : 'learning';

  return {
    kind: 'fueling_response',
    label: baseline?.label ?? 'Fueling-Baseline offen',
    strength,
    summary: baseline?.summary ?? 'Noch keine belastbare Fueling-Baseline fuer lange Einheiten.',
    evidence: baseline?.evidence ?? ['Fueling-Logs mit Carbs, Dauer, Flaschen und GI-Komfort fehlen.'],
    nextAdjustment: strength === 'insufficient'
      ? 'Lange Einheiten mit vollstaendigem During-Log abschliessen.'
      : 'Naechste lange Einheit nur in kleinen Schritten veraendern und GI-Komfort wieder loggen; Trends erst nach wiederholten Logs ableiten.',
  };
}

export function buildPersonalResponseSummary(input: BuildPersonalResponseSummaryInput): PulsePersonalResponseSummary {
  const signals = [
    buildExecutionSignal(input),
    buildMentalSignal(input),
    buildFuelingSignal(input),
  ];
  const usefulCount = signals.filter(signal => signal.strength === 'useful').length;
  const learningCount = signals.filter(signal => signal.strength === 'learning').length;
  const strength = usefulCount >= 2 ? 'useful' : usefulCount + learningCount >= 2 ? 'learning' : 'insufficient';
  const missingEvidence = [
    input.dailyOutcomes.length < 3 ? 'Mindestens drei abgeschlossene Trainings-/Recovery-Tage mit Folgeevidenz fehlen.' : null,
    input.mentalCheckins.length < 3 ? 'Mindestens drei aktuelle mentale Check-ins fehlen.' : null,
    signals.find(signal => signal.kind === 'fueling_response')?.strength !== 'useful' ? 'Mindestens drei vergleichbare vollstaendige During-Fueling-Logs fehlen.' : null,
  ].filter((item): item is string => item != null);

  return {
    generatedAt: `${input.today}T00:00:00.000Z`,
    range: { from: shiftIsoDate(input.today, -Math.max(1, input.days)), to: input.today, days: input.days },
    strength,
    headline: strength === 'useful'
      ? 'Pulse erkennt persoenliche Reaktionsmuster.'
      : strength === 'learning'
      ? 'Pulse lernt deine Reaktionsmuster.'
      : 'Pulse sammelt noch belastbare Reaktionsdaten.',
    signals,
    missingEvidence,
  };
}
