import { db } from '../../lib/db.js';
import { pulseInsightsCache, pulseDailyMetrics, pulseMentalCheckins, pulseActivities, pulseWeightLog, pulseUserProfile } from '../../db/pulse-schema.js';
import { eq, and, gt, gte, desc } from 'drizzle-orm';
import { llmComplete, FAST_MODEL, SMART_MODEL } from '../../lib/llm.js';
import { redis } from '../../lib/redis.js';
import { computeFitnessLoad } from './load-engine.js';
import { buildCachedPulseContextFor } from '../lib/pulse-context.js';
import { listMentalThemes } from './mental-themes.js';
import { getMentalLoadOverlay } from './mental-load-overlay.js';

// ─── Deep Insight types ───────────────────────────────────────────────────────

export type InsightDomain = 'sleep' | 'hrv' | 'load' | 'weight' | 'mental' | 'overall';
export type InsightEvidenceStatus = 'available' | 'limited' | 'missing';

export interface InsightEvidenceItem {
  label: string;
  value: string;
  window: string;
  status: InsightEvidenceStatus;
}

export interface InsightMissingDataItem {
  label: string;
  reason: string;
  action?: string;
}

export interface DeepInsightResult {
  domain: InsightDomain;
  analysis: string;
  stats: Record<string, number | string | null>;
  date: string;
  cached: boolean;
  evidence: InsightEvidenceItem[];
  missingData: InsightMissingDataItem[];
  status?: 'ok' | 'data_missing';
  action?: string | null;
  retryable?: boolean;
}

type InsightContext = {
  prompt: string;
  stats: Record<string, number | string | null>;
  evidence: InsightEvidenceItem[];
  missingData: InsightMissingDataItem[];
};

// ─── Stat helpers ─────────────────────────────────────────────────────────────

function numAvg(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
}

function numTrend(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 4) return null;
  const half = Math.floor(v.length / 2);
  const a = numAvg(v.slice(0, half))!;
  const b = numAvg(v.slice(half))!;
  return Math.round((b - a) * 10) / 10;
}

function evidenceItem(label: string, value: string, window: string, status: InsightEvidenceStatus = 'available'): InsightEvidenceItem {
  return { label, value, window, status };
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function dataStatus(count: number, solidThreshold: number): InsightEvidenceStatus {
  if (count <= 0) return 'missing';
  return count >= solidThreshold ? 'available' : 'limited';
}

// ─── Domain context builders ──────────────────────────────────────────────────

async function sleepContext(userId: string, since: string, days: number): Promise<InsightContext> {
  const rows = await db.select({
    date: pulseDailyMetrics.date, sleepHours: pulseDailyMetrics.sleepHours,
    sleepScore: pulseDailyMetrics.sleepScore, bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
    stressAvg: pulseDailyMetrics.stressAvg,
  }).from(pulseDailyMetrics)
    .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since)))
    .orderBy(pulseDailyMetrics.date);

  const w = rows.filter(r => r.sleepHours != null);
  const stats = {
    avgSleepH: numAvg(w.map(r => r.sleepHours)),
    avgScore: numAvg(w.map(r => r.sleepScore)),
    trendH: numTrend(w.map(r => r.sleepHours)),
    daysUnder7h: w.filter(r => (r.sleepHours ?? 0) < 7).length,
    daysWithData: w.length,
  };
  const evidence = [
    evidenceItem('Schlafdauer', countLabel(w.length, 'Nacht', 'Nächte'), `${days} Tage`, dataStatus(w.length, Math.min(7, days))),
    ...(stats.avgScore != null ? [evidenceItem('Schlafscore', `Ø ${stats.avgScore}`, `${days} Tage`, dataStatus(w.filter(r => r.sleepScore != null).length, Math.min(7, days)))] : []),
  ];
  const missingData = w.length === 0
    ? [{ label: 'Schlafdaten', reason: 'Keine Schlafdauer im gewählten Zeitraum.' }]
    : [];
  const lines = w.slice(-14).map(r =>
    `${r.date}: ${r.sleepHours?.toFixed(1)}h Score=${r.sleepScore ?? '–'} Batt=${r.bodyBatteryMax ?? '–'}% Stress=${r.stressAvg ?? '–'}`
  ).join('\n');
  const prompt = `Analysiere Tobis Schlafqualität der letzten ${rows.length} Tage (${w.length} Einträge mit Daten).
Letzte 14 Tage:\n${lines || 'Keine Daten'}
Kennzahlen: Ø ${stats.avgSleepH}h, Ø Score ${stats.avgScore}, Trend ${stats.trendH != null ? (stats.trendH > 0 ? '+' : '') + stats.trendH + 'h' : 'unklar'}, ${stats.daysUnder7h} Nächte unter 7h.
Bewertung (3-5 Sätze): Was läuft gut, was ist problematisch, Auswirkung auf Training, konkrete Empfehlung.`;
  return { prompt, stats, evidence, missingData };
}

async function hrvContext(userId: string, since: string, days: number): Promise<InsightContext> {
  const rows = await db.select({
    date: pulseDailyMetrics.date, hrvRmssd: pulseDailyMetrics.hrvRmssd,
    restingHr: pulseDailyMetrics.restingHr, hrvStatus: pulseDailyMetrics.hrvStatus,
  }).from(pulseDailyMetrics)
    .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since)))
    .orderBy(pulseDailyMetrics.date);

  const w = rows.filter(r => r.hrvRmssd != null);
  const statusCount = w.reduce<Record<string, number>>((a, r) => {
    const s = r.hrvStatus ?? 'unknown';
    a[s] = (a[s] ?? 0) + 1; return a;
  }, {});
  const stats = {
    avgHrvMs: numAvg(w.map(r => r.hrvRmssd)),
    trendHrv: numTrend(w.map(r => r.hrvRmssd)),
    avgRestingHr: numAvg(rows.filter(r => r.restingHr != null).map(r => r.restingHr)),
    poorDays: statusCount['poor'] ?? 0,
    normalDays: (statusCount['normal'] ?? 0) + (statusCount['above_normal'] ?? 0),
    daysWithData: w.length,
  };
  const restingHrDays = rows.filter(r => r.restingHr != null).length;
  const evidence = [
    evidenceItem('HRV RMSSD', countLabel(w.length, 'Tag', 'Tage'), `${days} Tage`, dataStatus(w.length, Math.min(7, days))),
    ...(restingHrDays > 0 ? [evidenceItem('Ruhepuls', countLabel(restingHrDays, 'Tag', 'Tage'), `${days} Tage`, dataStatus(restingHrDays, Math.min(7, days)))] : []),
  ];
  const missingData = w.length === 0
    ? [{ label: 'HRV-Daten', reason: 'Keine HRV-Werte im gewählten Zeitraum.' }]
    : [];
  const lines = w.slice(-14).map(r =>
    `${r.date}: HRV=${r.hrvRmssd?.toFixed(0)} ms Status=${r.hrvStatus ?? '–'} RHR=${r.restingHr ?? '–'} bpm`
  ).join('\n');
  const prompt = `Analysiere Tobis HRV-Verlauf der letzten ${rows.length} Tage.
Letzte 14 Tage:\n${lines || 'Keine Daten'}
Kennzahlen: Ø HRV ${stats.avgHrvMs} ms, Trend ${stats.trendHrv != null ? (stats.trendHrv > 0 ? '+' : '') + stats.trendHrv + ' ms' : 'unklar'}, Ø RHR ${stats.avgRestingHr} bpm, ${stats.poorDays} Poor-Tage.
Bewertung (3-5 Sätze): Erholungsstatus, Übertrainings-Signale, Trend-Bedeutung, Empfehlung.`;
  return { prompt, stats, evidence, missingData };
}

async function loadContext(userId: string, since: string, days: number): Promise<InsightContext> {
  const [activities, load, profileRows] = await Promise.all([
    db.select({
      startTime: pulseActivities.startTime, activityType: pulseActivities.activityType,
      durationSec: pulseActivities.durationSec, tss: pulseActivities.tss,
      normalizedPowerW: pulseActivities.normalizedPowerW,
    }).from(pulseActivities)
      .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, new Date(since))))
      .orderBy(desc(pulseActivities.startTime)).limit(30),
    computeFitnessLoad(userId, new Date().toISOString().split('T')[0]!),
    db.select({ ftpWatts: pulseUserProfile.ftpWatts }).from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId)).limit(1),
  ]);
  const ftp = profileRows[0]?.ftpWatts ?? null;
  const stats = { ctl: Math.round(load.ctl), atl: Math.round(load.atl), tsb: Math.round(load.tsb), ftpWatts: ftp, activitiesCount: activities.length };
  const evidence = [
    evidenceItem('Fitness Load', `CTL ${stats.ctl} / ATL ${stats.atl} / TSB ${stats.tsb}`, 'heute', 'available'),
    evidenceItem('Aktivitäten', countLabel(activities.length, 'Aktivität', 'Aktivitäten'), `${days} Tage`, dataStatus(activities.length, 3)),
    ...(ftp ? [evidenceItem('Profil-FTP', `${ftp} W`, 'Profil', 'available')] : []),
  ];
  const missingData = activities.length === 0
    ? [{ label: 'Aktivitäten', reason: 'Keine Garmin-Aktivitäten im gewählten Zeitraum.' }]
    : [];
  const lines = activities.slice(0, 10).map(a =>
    `${new Date(a.startTime).toISOString().split('T')[0]} ${a.activityType} ${a.durationSec ? Math.round(a.durationSec / 60) + 'min' : ''} TSS=${a.tss?.toFixed(0) ?? '–'}${a.normalizedPowerW ? ` NP=${a.normalizedPowerW}W` : ''}`
  ).join('\n');
  const prompt = `Analysiere Tobis Trainingsbelastung der letzten 30 Tage.
Fitness: CTL=${load.ctl.toFixed(0)} ATL=${load.atl.toFixed(0)} TSB=${load.tsb.toFixed(0)}${ftp ? ` FTP=${ftp}W` : ''}
Letzte 10 Trainings:\n${lines || 'Keine Aktivitäten'}
Bewertung (3-5 Sätze): Belastungsangemessenheit, Über-/Untertraining, TSB-Form, Empfehlung nächste Woche.`;
  return { prompt, stats, evidence, missingData };
}

async function weightContext(userId: string): Promise<InsightContext | null> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().split('T')[0]!;
  const rows = await db.select({
    date: pulseWeightLog.date, weightKg: pulseWeightLog.weightKg,
    bodyFatPct: pulseWeightLog.bodyFatPct, muscleMassKg: pulseWeightLog.muscleMassKg,
  }).from(pulseWeightLog)
    .where(and(eq(pulseWeightLog.userId, userId), gte(pulseWeightLog.date, since)))
    .orderBy(pulseWeightLog.date);
  if (!rows.length) return null;
  const first = rows[0]!.weightKg, last = rows[rows.length - 1]!.weightKg;
  const stats = {
    currentKg: last, change90d: Math.round((last - first) * 10) / 10,
    avgBodyFatPct: numAvg(rows.filter(r => r.bodyFatPct != null).map(r => r.bodyFatPct)),
    avgMuscleMassKg: numAvg(rows.filter(r => r.muscleMassKg != null).map(r => r.muscleMassKg)),
    daysTracked: rows.length,
  };
  const evidence = [
    evidenceItem('Gewichtsverlauf', countLabel(rows.length, 'Eintrag', 'Einträge'), '90 Tage', dataStatus(rows.length, 3)),
    ...(stats.avgBodyFatPct != null ? [evidenceItem('Körperfett', `Ø ${stats.avgBodyFatPct}%`, '90 Tage', 'available' as const)] : []),
    ...(stats.avgMuscleMassKg != null ? [evidenceItem('Muskelmasse', `Ø ${stats.avgMuscleMassKg} kg`, '90 Tage', 'available' as const)] : []),
  ];
  const lines = rows.slice(-10).map(r =>
    `${r.date}: ${r.weightKg?.toFixed(1)}kg${r.bodyFatPct ? ` KF=${r.bodyFatPct.toFixed(1)}%` : ''}${r.muscleMassKg ? ` Muskel=${r.muscleMassKg.toFixed(1)}kg` : ''}`
  ).join('\n');
  const prompt = `Analysiere Tobis Gewicht und Körperzusammensetzung der letzten 90 Tage.
Letzte 10 Einträge:\n${lines}
Kennzahlen: Aktuell ${last.toFixed(1)}kg, 90d-Veränderung: ${stats.change90d > 0 ? '+' : ''}${stats.change90d}kg${stats.avgBodyFatPct ? `, Ø KF ${stats.avgBodyFatPct}%` : ''}${stats.avgMuscleMassKg ? `, Ø Muskeln ${stats.avgMuscleMassKg}kg` : ''}.
Bewertung (3-5 Sätze): Trend, Körperzusammensetzung im Kontext Ausdauersport, Empfehlung.`;
  return { prompt, stats, evidence, missingData: [] };
}

async function mentalContext(userId: string, since: string, days: number, today: string): Promise<InsightContext | null> {
  const [ctx, themeData, overlay] = await Promise.all([
    buildCachedPulseContextFor(userId, today),
    listMentalThemes(userId, days),
    getMentalLoadOverlay(userId, Math.max(28, Math.min(90, days))),
  ]);
  const rows = await db.select({
    date: pulseMentalCheckins.date,
    mood: pulseMentalCheckins.mood,
    energy: pulseMentalCheckins.energy,
    stress: pulseMentalCheckins.stress,
    motivation: pulseMentalCheckins.motivation,
  }).from(pulseMentalCheckins)
    .where(and(eq(pulseMentalCheckins.userId, userId), gte(pulseMentalCheckins.date, since)))
    .orderBy(pulseMentalCheckins.date);
  const topThemes = themeData.themes.slice(0, 10);
  if (!rows.length && topThemes.length === 0) return null;
  const stats = {
    avgMood: numAvg(rows.map(r => r.mood)), avgEnergy: numAvg(rows.map(r => r.energy)),
    avgStress: numAvg(rows.map(r => r.stress)), avgMotivation: numAvg(rows.map(r => r.motivation)),
    trendMood: numTrend(rows.map(r => r.mood)),
    highStressDays: rows.filter(r => (r.stress ?? 0) >= 7).length,
    checkinCount: rows.length,
    ctl: Math.round(ctx.fitnessLoad.ctl),
    atl: Math.round(ctx.fitnessLoad.atl),
    tsb: Math.round(ctx.fitnessLoad.tsb),
    readiness: ctx.readiness.score,
    topTheme: topThemes[0]?.theme ?? null,
    resurfacingThemes: topThemes.filter(theme => theme.isResurfacing).length,
    resolvedThemes: topThemes.filter(theme => theme.isResolved).length,
    moodTsbCorrelation: overlay.stats.moodTsbCorrelation,
    lowTsbCheckins: overlay.stats.lowTsbCheckins,
  };
  const evidence = [
    evidenceItem('Mental-Check-ins', countLabel(rows.length, 'Eintrag', 'Einträge'), `${days} Tage`, dataStatus(rows.length, 3)),
    ...(topThemes.length > 0
      ? [evidenceItem('Theme-Historie', countLabel(topThemes.length, 'Theme', 'Themes'), `${days} Tage`, 'available' as const)]
      : []),
    evidenceItem(
      'Mental/TSB-Overlay',
      stats.moodTsbCorrelation != null ? `r=${stats.moodTsbCorrelation}` : countLabel(overlay.stats.checkins, 'Check-in', 'Check-ins'),
      `${overlay.days} Tage`,
      stats.moodTsbCorrelation != null ? 'available' : dataStatus(overlay.stats.checkins, 3),
    ),
  ];
  const lines = rows.slice(-14).map(r =>
    `${r.date}: Stimmung=${r.mood} Energie=${r.energy} Stress=${r.stress} Motivation=${r.motivation}`
  ).join('\n');
  const themeLines = topThemes.map(theme => {
    const flags = [
      theme.isResurfacing ? 'resurfacing' : null,
      theme.isResolved ? 'resolved' : null,
    ].filter(Boolean).join(', ');
    const stressHits = theme.occurrences.filter(occ => occ.stress >= 7).length;
    const lowMoodHits = theme.occurrences.filter(occ => occ.mood <= 5).length;
    return `${theme.theme}: ${theme.count}x, zuletzt ${theme.lastSeen}, Stress>=7 ${stressHits}x, Stimmung<=5 ${lowMoodHits}x${flags ? ` (${flags})` : ''}`;
  }).join('\n');
  const overlayWindow = overlay.days === days ? `${days} Tage` : `${overlay.days} Tage (Mindestfenster fuer stabile Korrelation)`;
  const prompt = `Analysiere Tobis mentale Verfassung anhand des gemeinsamen PulseContext.
Aktueller Kontext: Readiness=${ctx.readiness.score}/100 (${ctx.readiness.label}), CTL=${ctx.fitnessLoad.ctl.toFixed(1)}, ATL=${ctx.fitnessLoad.atl.toFixed(1)}, TSB=${ctx.fitnessLoad.tsb.toFixed(1)}.
Letzte bis zu 14 Check-ins im Analysefenster (${days} Tage):\n${lines || 'Keine aktuellen Check-ins'}
Top-Themes der letzten ${days} Tage:\n${themeLines || 'Keine wiederkehrenden Themes'}
Kennzahlen: Ø Stimmung ${stats.avgMood ?? 'n/a'}/10, Energie ${stats.avgEnergy ?? 'n/a'}/10, Stress ${stats.avgStress ?? 'n/a'}/10, Motivation ${stats.avgMotivation ?? 'n/a'}/10. ${stats.highStressDays} Hochstress-Tage (>=7).
Mood/TSB-Korrelation im Overlay (${overlayWindow}): r=${stats.moodTsbCorrelation ?? 'n/a'}, Check-ins bei TSB<-10: ${stats.lowTsbCheckins}.
Bewertung (3-5 Sätze): Muster, Risikofaktoren, Zusammenhang mit Training und TSB, konkrete Empfehlung. Grenze dich von Risk Watch ab: hier narrativ-deskriptiv, keine Alarmregel.`;
  return { prompt, stats, evidence, missingData: [] };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateDeepInsight(
  userId: string,
  domain: InsightDomain,
  days = 30,
  forceRefresh = false,
): Promise<DeepInsightResult> {
  const today = new Date().toISOString().split('T')[0]!;
  const cacheKey = `pulse:deep-insight:${userId}:${domain}:${days}:${today}`;

  if (!forceRefresh) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as Partial<Omit<DeepInsightResult, 'cached'>>;
      return {
        ...parsed,
        domain: parsed.domain ?? domain,
        analysis: parsed.analysis ?? '',
        stats: parsed.stats ?? {},
        date: parsed.date ?? today,
        evidence: parsed.evidence ?? [],
        missingData: parsed.missingData ?? [],
        cached: true,
      };
    }
  }

  const since = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]!;
  const sys = `Du bist Pulse, persönlicher Ausdauer-Coach für Tobi (polarisiertes Training, Radsport/Triathlon).
Antworte auf Deutsch. Kein Markdown, keine Aufzählungszeichen — fließender Text, direkt und konkret wie ein erfahrener Sportwissenschaftler.`;

  let prompt: string;
  let stats: Record<string, number | string | null>;
  let evidence: InsightEvidenceItem[] = [];
  let missingData: InsightMissingDataItem[] = [];

  switch (domain) {
    case 'sleep': {
      const c = await sleepContext(userId, since, days);
      if (c.missingData.length > 0) return {
        domain,
        analysis: 'Noch nicht genug Schlafdaten für diesen Zeitraum.',
        stats: c.stats,
        date: today,
        cached: false,
        status: 'data_missing',
        action: 'Synchronisiere Garmin-Schlafdaten oder wähle einen längeren Zeitraum.',
        retryable: false,
        evidence: c.evidence,
        missingData: c.missingData,
      };
      prompt = c.prompt; stats = c.stats; evidence = c.evidence; missingData = c.missingData; break;
    }
    case 'hrv': {
      const c = await hrvContext(userId, since, days);
      if (c.missingData.length > 0) return {
        domain,
        analysis: 'Noch nicht genug HRV-Daten für diesen Zeitraum.',
        stats: c.stats,
        date: today,
        cached: false,
        status: 'data_missing',
        action: 'Synchronisiere Garmin-Gesundheitsdaten oder wähle einen längeren Zeitraum.',
        retryable: false,
        evidence: c.evidence,
        missingData: c.missingData,
      };
      prompt = c.prompt; stats = c.stats; evidence = c.evidence; missingData = c.missingData; break;
    }
    case 'load':   { const c = await loadContext(userId, since, days);   prompt = c.prompt; stats = c.stats; evidence = c.evidence; missingData = c.missingData; break; }
    case 'mental': {
      const c = await mentalContext(userId, since, days, today);
      if (!c) return {
        domain,
        analysis: 'Noch nicht genug Check-in-Daten für diesen Zeitraum.',
        stats: {},
        date: today,
        cached: false,
        status: 'data_missing',
        action: 'Trage im Coach einen Check-in ein oder wähle 90T.',
        retryable: false,
        evidence: [],
        missingData: [
          {
            label: 'Mental-Check-ins',
            reason: 'Keine Check-ins im gewählten Zeitraum.',
            action: 'Trage im Coach einen Check-in ein oder wähle 90T.',
          },
        ],
      };
      prompt = c.prompt; stats = c.stats; evidence = c.evidence; missingData = c.missingData; break;
    }
    case 'weight': {
      const c = await weightContext(userId);
      if (!c) return {
        domain,
        analysis: 'Noch nicht genug Gewichtsdaten für eine belastbare Tendenz.',
        stats: {},
        date: today,
        cached: false,
        status: 'data_missing',
        action: 'Erfasse Gewichtsdaten oder wähle einen späteren Zeitraum.',
        retryable: false,
        evidence: [],
        missingData: [
          {
            label: 'Gewichtsdaten',
            reason: 'Keine Gewichtseinträge für eine belastbare Tendenz.',
            action: 'Erfasse Gewichtsdaten oder wähle einen späteren Zeitraum.',
          },
        ],
      };
      prompt = c.prompt; stats = c.stats; evidence = c.evidence; missingData = c.missingData; break;
    }
    case 'overall': {
      const [s, h, l, m] = await Promise.all([
        sleepContext(userId, since, days), hrvContext(userId, since, days),
        loadContext(userId, since, days), mentalContext(userId, since, days, today),
      ]);
      stats = {};
      evidence = [
        ...s.evidence.slice(0, 2),
        ...h.evidence.slice(0, 2),
        ...l.evidence.slice(0, 2),
        ...(m?.evidence.slice(0, 2) ?? []),
      ];
      missingData = [
        ...s.missingData,
        ...h.missingData,
        ...l.missingData,
        ...(m?.missingData ?? []),
      ];
      prompt = `Gesamtanalyse von Tobis Gesundheits- und Trainingsstatus der letzten ${days} Tage.
Schlaf: Ø ${s.stats.avgSleepH}h, Score ${s.stats.avgScore}, Trend ${s.stats.trendH != null ? (Number(s.stats.trendH) > 0 ? '+' : '') + s.stats.trendH + 'h' : 'unklar'}
HRV: Ø ${h.stats.avgHrvMs} ms, Trend ${h.stats.trendHrv != null ? (Number(h.stats.trendHrv) > 0 ? '+' : '') + h.stats.trendHrv + ' ms' : 'unklar'}, RHR ${h.stats.avgRestingHr} bpm
Belastung: CTL=${l.stats.ctl} ATL=${l.stats.atl} TSB=${l.stats.tsb}${l.stats.ftpWatts ? ` FTP=${l.stats.ftpWatts}W` : ''}
${m ? `Mental: Ø Stimmung ${m.stats.avgMood}/10, Energie ${m.stats.avgEnergy}/10, Stress ${m.stats.avgStress}/10` : ''}
Gesamtbild in 4-6 Sätzen: aktueller Stand, wichtigste Stärken/Risiken, Empfehlung für nächste 1-2 Wochen.`;
      break;
    }
  }

  const analysis = await llmComplete(sys, prompt, SMART_MODEL);
  const result: Omit<DeepInsightResult, 'cached'> = { domain, analysis, stats, date: today, evidence, missingData, status: 'ok' };
  const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
  await redis.set(cacheKey, JSON.stringify(result), 'EX', Math.round((midnight.getTime() - Date.now()) / 1000));
  return { ...result, cached: false };
}

export function getRuleInsight(metricKey: string, value: number): string | null {
  switch (metricKey) {
    case 'hrv_rmssd':
      return value < 30
        ? `HRV ${value.toFixed(0)} ms ist niedrig. Dein Nervensystem braucht Erholung — kein intensives Training heute.`
        : value < 50
        ? `HRV ${value.toFixed(0)} ms ist moderat. Moderates Training ist ok, kein Highintensity.`
        : `HRV ${value.toFixed(0)} ms ist gut. Dein Nervensystem ist erholt und bereit.`;

    case 'sleep_hours':
      return value < 6
        ? `${value.toFixed(1)} Stunden Schlaf ist zu wenig. Priorisiere heute Erholung statt intensivem Training.`
        : value < 7.5
        ? `${value.toFixed(1)} Stunden Schlaf ist ok, aber etwas wenig für optimale Erholung. Versuche 7.5-9h zu schlafen.`
        : `${value.toFixed(1)} Stunden Schlaf — das ist ausgezeichnet! Optimale Erholung für das Training.`;

    case 'body_battery_max':
      return value < 30
        ? `Körperbatterie ${value}% — sehr erschöpft. Heute maximal leichtes Spazieren.`
        : value < 60
        ? `Körperbatterie ${value}% — moderat. Moderates Training möglich.`
        : `Körperbatterie ${value}% — gut geladen. Gute Voraussetzungen für Training.`;

    case 'steps':
      return value < 5000
        ? `${value.toLocaleString('de')} Schritte — wenig Alltagsbewegung heute. Bewegungspausen einbauen!`
        : value >= 10000
        ? `${value.toLocaleString('de')} Schritte — ausgezeichnet! Du bist sehr aktiv.`
        : `${value.toLocaleString('de')} Schritte — gute Alltagsaktivität.`;

    case 'resting_hr':
      return value > 65
        ? `Ruhepuls ${value} bpm — etwas erhöht. Mögliche Ursachen: Schlafmangel, Stress, beginnende Erkrankung.`
        : value <= 50
        ? `Ruhepuls ${value} bpm — ausgezeichnet. Zeigt gute kardiovaskuläre Fitness.`
        : `Ruhepuls ${value} bpm — im normalen Bereich für Ausdauersportler.`;

    default:
      return null;
  }
}

export async function getInsight(userId: string, metricKey: string, value: number): Promise<string> {
  // Check 1h cache
  const [cached] = await db.select({ insight: pulseInsightsCache.insight })
    .from(pulseInsightsCache)
    .where(and(
      eq(pulseInsightsCache.userId, userId),
      eq(pulseInsightsCache.metricKey, metricKey),
      gt(pulseInsightsCache.expiresAt, new Date()),
    ))
    .limit(1);

  if (cached) return cached.insight;

  // Rule-based
  const ruleInsight = getRuleInsight(metricKey, value);
  const insight = ruleInsight ?? await llmComplete(
    'Du bist Sportwissenschaftler. Erkläre kurz (max 80 Wörter) was dieser Messwert für einen Ausdauersportler bedeutet. Antworte auf Deutsch.',
    `Metrik: ${metricKey}, Wert: ${value}`,
    FAST_MODEL,
  );
  const source = ruleInsight ? 'rule' : 'llm';

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await db.insert(pulseInsightsCache).values({
    userId, metricKey, insight, expiresAt,
    source: source as 'rule' | 'llm',
  });

  return insight;
}
