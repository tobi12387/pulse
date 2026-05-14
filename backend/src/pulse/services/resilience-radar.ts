import { and, eq, gte } from 'drizzle-orm';
import type {
  PulseResilienceRadarResponse,
  PulseResilienceRadarSignal,
  PulseResilienceRadarState,
  PulseSupportActivationPreference,
} from '@coaching-os/shared/pulse';
import { db } from '../../lib/db.js';
import { pulseCoachPreferences, pulseDailyMetrics, pulseMentalCheckins } from '../../db/pulse-schema.js';
import { computeFitnessLoadSeries } from './load-engine.js';

const DAY_MS = 86_400_000;

export interface ResilienceRadarCheckin {
  date: string;
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
  themes?: string[] | null;
}

export interface ResilienceRadarDailyMetric {
  date: string;
  sleepHours: number | null;
  sleepScore: number | null;
  bodyBatteryAtWake: number | null;
  bodyBatteryMax: number | null;
  stressAvg: number | null;
}

export interface ResilienceRadarLoadPoint {
  date: string;
  tsb: number;
}

export interface ResilienceRadarSupportPreference {
  warningSigns: string[];
  stabilizingActions: string[];
  contactNote: string;
  activationPreference: PulseSupportActivationPreference;
}

export interface ResilienceRadarInput {
  today: string;
  days: number;
  checkins: ResilienceRadarCheckin[];
  daily: ResilienceRadarDailyMetric[];
  load: ResilienceRadarLoadPoint[];
  support: ResilienceRadarSupportPreference;
}

function parseDay(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Date.UTC(year, month - 1, day);
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().split('T')[0]!;
}

function minusDays(date: string, days: number): string {
  return formatDay(parseDay(date) - days * DAY_MS);
}

function daysBetween(today: string, date: string): number {
  const diff = parseDay(today) - parseDay(date);
  return Number.isFinite(diff) ? Math.floor(diff / DAY_MS) : Number.POSITIVE_INFINITY;
}

function clampDays(days: number): number {
  const parsed = Number.isFinite(days) ? days : 14;
  return Math.min(30, Math.max(7, Math.round(parsed)));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function supportConfigured(support: ResilienceRadarSupportPreference): boolean {
  return support.warningSigns.some(nonEmpty)
    || support.stabilizingActions.some(nonEmpty)
    || support.contactNote.trim().length > 0;
}

function signal(signal: PulseResilienceRadarSignal): PulseResilienceRadarSignal {
  return signal;
}

function coachSupportPrompt(input: ResilienceRadarInput, signals: PulseResilienceRadarSignal[]): string {
  const evidence = signals
    .filter(item => item.id !== 'support_plan')
    .slice(0, 3)
    .map(item => `${item.label}: ${item.summary}`)
    .join(' | ');
  const warningSigns = input.support.warningSigns.filter(nonEmpty).join(', ') || 'keine Warnzeichen konfiguriert';
  const stabilizers = input.support.stabilizingActions.filter(nonEmpty).join(', ') || 'keine Schritte konfiguriert';
  const note = input.support.contactNote.trim() || 'kein Kontakt-Hinweis konfiguriert';

  return [
    'Bitte hilf mir, meinen Supportplan sichtbar und ruhig zu aktivieren.',
    `Aktuelle Evidenz: ${evidence || 'Resilienz-Radar meldet erhoehten Schutzbedarf.'}`,
    `Warnzeichen: ${warningSigns}.`,
    `Stabilisierende Schritte: ${stabilizers}.`,
    `Support-Hinweis: ${note}.`,
    'Wichtig: keine Diagnose, keine versteckte Einstufung und keine automatische Kontaktaufnahme.',
  ].join(' ');
}

function primaryAction(
  state: PulseResilienceRadarState,
  input: ResilienceRadarInput,
  supportSuggested: boolean,
  signals: PulseResilienceRadarSignal[],
): PulseResilienceRadarResponse['primaryAction'] {
  if (supportSuggested && input.support.activationPreference === 'coach_prompt') {
    return {
      label: 'Supportplan vorbereiten',
      targetPath: `/coach?prompt=${encodeURIComponent(coachSupportPrompt(input, signals))}`,
      resultPreview: 'Coach öffnet mit vorbereitetem Supportplan-Prompt; Pulse kontaktiert niemanden automatisch.',
    };
  }

  if (supportSuggested) {
    return {
      label: 'Supportplan ansehen',
      targetPath: '/settings?section=coach',
      resultPreview: 'Öffnet die gespeicherten Support-Präferenzen; keine automatische Kontaktaufnahme.',
    };
  }

  if (state === 'learning') {
    return {
      label: 'Check-in speichern',
      targetPath: '/data?tab=today#data-mental',
      resultPreview: 'Der nächste Check-in macht den Trend belastbarer für Home, Plan und Coach.',
    };
  }

  if (state === 'rebuild') {
    return {
      label: 'Check-in neu starten',
      targetPath: '/data?tab=today#data-mental',
      resultPreview: 'Startet die kleinste Routine wieder: Kopf, Energie, Druck, Bedarf.',
    };
  }

  if (state === 'protect') {
    return {
      label: 'Grenze setzen',
      targetPath: '/coach?prompt=Welche%20kleine%20Grenze%20schuetzt%20heute%20meine%20Energie%3F',
      resultPreview: 'Coach bereitet eine kleine Grenze vor; Plan und Garmin bleiben unverändert.',
    };
  }

  if (state === 'watch') {
    return {
      label: 'Tag kleiner halten',
      targetPath: '/data?tab=today#data-mental',
      resultPreview: 'Öffnet den Mental-Kontext, damit die Tagesgrenze sichtbar bleibt.',
    };
  }

  return {
    label: 'Routine beibehalten',
    targetPath: '/data?tab=today#data-mental',
    resultPreview: 'Hält den Check-in als kurze tägliche Stabilitätsroutine offen.',
  };
}

function titleForState(state: PulseResilienceRadarState): string {
  if (state === 'learning') return 'Pulse lernt deinen Resilienzverlauf.';
  if (state === 'rebuild') return 'Routine wieder klein starten.';
  if (state === 'protect') return 'Heute bewusst schützen.';
  if (state === 'watch') return 'Druck und Energie im Blick behalten.';
  return 'Resilienz wirkt stabil.';
}

function summaryForState(state: PulseResilienceRadarState, signals: PulseResilienceRadarSignal[]): string {
  if (state === 'learning') {
    return 'Noch zu wenig wiederholbare Check-in-Evidenz. Ein kurzer Check-in ist der stärkste nächste Schritt.';
  }
  if (state === 'rebuild') {
    return 'Der Check-in-Faden ist zuletzt abgerissen. Pulse priorisiert einen kleinen Neustart statt mehr Analyse.';
  }
  if (state === 'protect') {
    return 'Mehrere sichtbare Signale sprechen dafür, Druck aus dem Tag zu nehmen und Unterstützung bewusst verfügbar zu machen.';
  }
  if (state === 'watch') {
    return 'Einzelne Signale sind auffällig. Der Tag muss nicht dramatisch werden, sollte aber kleiner und klarer bleiben.';
  }
  if (signals.length === 0) {
    return 'Die letzten Check-ins und Recovery-Signale zeigen keinen akuten Anpassungsbedarf.';
  }
  return 'Die aktuelle Routine sieht tragfähig aus; Details bleiben als Evidenz sichtbar.';
}

export function buildResilienceRadar(input: ResilienceRadarInput): PulseResilienceRadarResponse {
  const days = clampDays(input.days);
  const sortedCheckins = [...input.checkins]
    .filter(checkin => daysBetween(input.today, checkin.date) >= 0 && daysBetween(input.today, checkin.date) < days)
    .sort((a, b) => b.date.localeCompare(a.date));
  const recentCheckins = sortedCheckins.filter(checkin => daysBetween(input.today, checkin.date) <= 6);
  const recentWindow = recentCheckins.length >= 3 ? recentCheckins : sortedCheckins.slice(0, 7);
  const recentMetricRows = input.daily.filter(row => daysBetween(input.today, row.date) <= 6);
  const recentLoadRows = input.load.filter(row => daysBetween(input.today, row.date) <= 6);
  const signals: PulseResilienceRadarSignal[] = [];

  const hasRecentCheckin = sortedCheckins.some(checkin => daysBetween(input.today, checkin.date) <= 2);
  const routineGap = sortedCheckins.length >= 3 && !hasRecentCheckin;
  const moodAvg = recentWindow.length >= 3 ? avg(recentWindow.map(checkin => checkin.mood)) : null;
  const energyAvg = recentWindow.length >= 3 ? avg(recentWindow.map(checkin => checkin.energy)) : null;
  const stressAvg = recentWindow.length >= 3 ? avg(recentWindow.map(checkin => checkin.stress)) : null;
  const lowMood = moodAvg != null && moodAvg <= 4.2;
  const lowEnergy = energyAvg != null && energyAvg <= 4.2;
  const highStress = stressAvg != null && stressAvg >= 7;
  const tsbAvg = avg(recentLoadRows.map(row => row.tsb));
  const garminStressAvg = avg(recentMetricRows.map(row => row.stressAvg).filter((value): value is number => value != null));
  const lowBatteryDays = recentMetricRows.filter(row => (row.bodyBatteryAtWake ?? row.bodyBatteryMax ?? 100) <= 35).length;
  const loadPressure = (tsbAvg != null && tsbAvg <= -10)
    || (garminStressAvg != null && garminStressAvg >= 65)
    || lowBatteryDays >= 2;

  if (moodAvg != null && lowMood) {
    signals.push(signal({
      id: 'low_mood_trend',
      label: 'Stimmung',
      summary: `Ø ${round1(moodAvg)}/10 in den letzten Check-ins.`,
      evidence: recentWindow.slice(0, 3).map(checkin => `${checkin.date}: Stimmung ${checkin.mood}/10`),
    }));
  }
  if (energyAvg != null && lowEnergy) {
    signals.push(signal({
      id: 'low_energy_trend',
      label: 'Energie',
      summary: `Ø ${round1(energyAvg)}/10 in den letzten Check-ins.`,
      evidence: recentWindow.slice(0, 3).map(checkin => `${checkin.date}: Energie ${checkin.energy}/10`),
    }));
  }
  if (stressAvg != null && highStress) {
    signals.push(signal({
      id: 'stress_pressure',
      label: 'Druck',
      summary: `Stress Ø ${round1(stressAvg)}/10.`,
      evidence: recentWindow.slice(0, 3).map(checkin => `${checkin.date}: Stress ${checkin.stress}/10`),
    }));
  }
  if (loadPressure) {
    const evidence = [
      tsbAvg != null ? `TSB Ø ${round1(tsbAvg)}` : null,
      garminStressAvg != null ? `Garmin Stress Ø ${round1(garminStressAvg)}` : null,
      lowBatteryDays > 0 ? `${lowBatteryDays} Tag(e) niedrige Body Battery` : null,
    ].filter((value): value is string => value != null);
    signals.push(signal({
      id: 'load_pressure',
      label: 'Recovery/Load',
      summary: 'Körperliche Last und Erholung sprechen für weniger Druck.',
      evidence,
    }));
  }
  if (routineGap) {
    signals.push(signal({
      id: 'routine_gap',
      label: 'Routine',
      summary: 'In den letzten 3 Tagen fehlt ein Check-in, obwohl vorher Check-ins vorhanden waren.',
      evidence: sortedCheckins.slice(0, 3).map(checkin => `Letzter Check-in: ${checkin.date}`),
    }));
  }

  let state: PulseResilienceRadarState = 'steady';
  if (sortedCheckins.length < 3) {
    state = 'learning';
  } else if (routineGap) {
    state = 'rebuild';
  } else if ((lowMood && highStress) || (lowEnergy && highStress) || (loadPressure && (lowMood || lowEnergy || highStress))) {
    state = 'protect';
  } else if (lowMood || lowEnergy || highStress || loadPressure) {
    state = 'watch';
  }

  const configured = supportConfigured(input.support);
  const supportSuggested = configured
    && input.support.activationPreference !== 'manual_only'
    && (state === 'watch' || state === 'protect' || state === 'rebuild');
  if (supportSuggested) {
    const signs = input.support.warningSigns.filter(nonEmpty);
    const actions = input.support.stabilizingActions.filter(nonEmpty);
    signals.push(signal({
      id: 'support_plan',
      label: 'Supportplan',
      summary: input.support.activationPreference === 'coach_prompt'
        ? 'Ein vorbereiteter Coach-Prompt ist erlaubt.'
        : 'Der gespeicherte Supportplan darf sichtbar vorgeschlagen werden.',
      evidence: [
        signs.length > 0 ? `Warnzeichen: ${signs.join(', ')}` : null,
        actions.length > 0 ? `Stabilisieren: ${actions.join(', ')}` : null,
        input.support.contactNote.trim() ? `Hinweis: ${input.support.contactNote.trim()}` : null,
      ].filter((value): value is string => value != null),
    }));
  }

  const support = {
    configured,
    suggested: supportSuggested,
    preference: input.support.activationPreference,
    note: input.support.contactNote.trim() || null,
  };
  return {
    days,
    state,
    title: titleForState(state),
    summary: summaryForState(state, signals),
    primaryAction: primaryAction(state, input, supportSuggested, signals),
    signals,
    support,
    evidenceQuality: {
      checkins: sortedCheckins.length,
      garminDays: input.daily.length,
      loadDays: input.load.length,
      confidence: sortedCheckins.length >= 3 ? 'usable' : sortedCheckins.length >= 2 ? 'learning' : 'insufficient',
    },
  };
}

export async function getResilienceRadar(userId: string, days = 14): Promise<PulseResilienceRadarResponse> {
  const clampedDays = clampDays(Number.isFinite(days) ? days : 14);
  const today = new Date().toISOString().split('T')[0]!;
  const since = minusDays(today, clampedDays - 1);
  const [checkins, daily, load, supportRows] = await Promise.all([
    db.select({
      date: pulseMentalCheckins.date,
      mood: pulseMentalCheckins.mood,
      energy: pulseMentalCheckins.energy,
      stress: pulseMentalCheckins.stress,
      motivation: pulseMentalCheckins.motivation,
      themes: pulseMentalCheckins.themes,
    }).from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), gte(pulseMentalCheckins.date, since))),
    db.select({
      date: pulseDailyMetrics.date,
      sleepHours: pulseDailyMetrics.sleepHours,
      sleepScore: pulseDailyMetrics.sleepScore,
      bodyBatteryAtWake: pulseDailyMetrics.bodyBatteryAtWake,
      bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
      stressAvg: pulseDailyMetrics.stressAvg,
    }).from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since))),
    computeFitnessLoadSeries(userId, today, clampedDays),
    db.select({
      supportWarningSigns: pulseCoachPreferences.supportWarningSigns,
      supportStabilizingActions: pulseCoachPreferences.supportStabilizingActions,
      supportContactNote: pulseCoachPreferences.supportContactNote,
      supportActivationPreference: pulseCoachPreferences.supportActivationPreference,
    }).from(pulseCoachPreferences)
      .where(eq(pulseCoachPreferences.userId, userId))
      .limit(1),
  ]);
  const support = supportRows[0];

  return buildResilienceRadar({
    today,
    days: clampedDays,
    checkins,
    daily,
    load: load.map(point => ({ date: point.date, tsb: point.tsb })),
    support: {
      warningSigns: support?.supportWarningSigns ?? [],
      stabilizingActions: support?.supportStabilizingActions ?? [],
      contactNote: support?.supportContactNote ?? '',
      activationPreference: support?.supportActivationPreference ?? 'suggest_only',
    },
  });
}
