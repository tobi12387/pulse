import { llmComplete, llmChat, SMART_MODEL, type LLMMessage } from '../../lib/llm.js';
import type { PulseCoachPreferences, PulseNextBestAction, PulseRiskSignal, PulseSuppressedActionState } from '@coaching-os/shared/pulse';

// ─── Rich context ─────────────────────────────────────────────────────────────

export interface CoachFullContext {
  today: string;
  readiness: { score: number; label: string };
  todayMetrics: {
    sleepHours: number | null; sleepScore: number | null;
    hrvRmssd: number | null; hrvStatus: string | null; restingHr: number | null;
    bodyBatteryMax: number | null; stressAvg: number | null; steps: number | null;
  } | null;
  todayCheckin: {
    mood: number; energy: number; stress: number; motivation: number; notes: string | null;
  } | null;
  load: { ctl: number; atl: number; tsb: number };
  profile: {
    ftpWatts: number | null; maxHrBpm: number | null;
    vo2max: number | null; trainingPhase: string | null;
  } | null;
  activeHealthStates?: Array<{
    type: string;
    severity: string;
    bodyPart: string | null;
    notes: string | null;
    startDate: string;
    endDate: string | null;
  }>;
  recentActivities: Array<{
    date: string; activityType: string; durationSec: number | null;
    tss: number | null; normalizedPowerW: number | null; avgHr: number | null;
    rpe?: number | null; rpeNote?: string | null; plannedZone?: number | null;
  }>;
  upcomingWorkouts: Array<{
    plannedDate: string; activityType: string; zone: number;
    durationMin: number; description: string | null;
  }>;
  metrics14: Array<{
    date: string; sleepHours: number | null; hrvRmssd: number | null;
    bodyBatteryMax: number | null; stressAvg: number | null;
  }>;
  checkins14: Array<{
    date: string; mood: number; energy: number; stress: number; motivation: number;
  }>;
  latestWeight: { weightKg: number; date: string; trend30d: number | null } | null;
  activeRiskSignals?: PulseRiskSignal[];
  nextBestActions?: PulseNextBestAction[];
  suppressedNextBestActions?: PulseSuppressedActionState[];
  coachPreferences?: PulseCoachPreferences | null;
  recentStrengthSessions?: Array<{
    date: string;
    sessionId: string;
    durationMin: number | null;
    topLifts: Array<{
      exercise: string;
      bestSet: { reps: number; weightKg: number | null; rpe: number | null; e1rmKg: number | null };
    }>;
  }>;
  equipmentDueForReplacement?: Array<{
    name: string;
    category: string;
    kmCurrent: number;
    kmRetirement: number;
    pctConsumed: number;
  }>;
  recovery?: {
    sleepDebt7dH: number;
    sleepDebtStatus: 'ok' | 'mild' | 'severe';
    hrvDeviationPct: number;
    hrvStatus: 'recovering' | 'stable' | 'declining';
    rhrDriftBpm: number;
    rhrStatus: 'normal' | 'elevated';
    recoveryScore: number;
    recommendation: string;
  } | null;
}

const COACH_PREFERENCE_DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const COACH_COMMUNICATION_LABELS: Record<PulseCoachPreferences['communicationStyle'], string> = {
  direct: 'direkt',
  gentle: 'behutsam',
  data_first: 'datenorientiert',
};

function hasVisibleCoachPreferences(preferences: PulseCoachPreferences | null | undefined): preferences is PulseCoachPreferences {
  if (!preferences) return false;
  return Boolean(
    preferences.timeWindows.trim()
      || preferences.dislikedWorkoutPatterns.length > 0
      || preferences.preferredLongDays.length > 0
      || preferences.injurySensitiveConstraints.length > 0
      || preferences.communicationStyle,
  );
}

function formatCoachPreferences(preferences: PulseCoachPreferences): string {
  const lines = ['== SICHTBARE COACH-PRÄFERENZEN =='];

  if (preferences.timeWindows.trim()) {
    lines.push(`Zeitfenster: ${preferences.timeWindows.trim()}`);
  }
  if (preferences.dislikedWorkoutPatterns.length > 0) {
    lines.push(`Unbeliebte Muster: ${preferences.dislikedWorkoutPatterns.join('; ')}`);
  }
  if (preferences.preferredLongDays.length > 0) {
    const days = preferences.preferredLongDays
      .map(day => COACH_PREFERENCE_DAY_LABELS[day] ?? String(day))
      .join(', ');
    lines.push(`Lange Tage bevorzugt: ${days}`);
  }
  if (preferences.injurySensitiveConstraints.length > 0) {
    lines.push(`Vorsicht/Constraints: ${preferences.injurySensitiveConstraints.join('; ')}`);
  }
  lines.push(`Kommunikation: ${COACH_COMMUNICATION_LABELS[preferences.communicationStyle] ?? preferences.communicationStyle}`);
  lines.push('Nur diese expliziten Präferenzen verwenden; keine versteckten Eigenschaften ableiten.');

  return lines.join('\n');
}

export function buildRichSystemPrompt(ctx: CoachFullContext): string {
  const m = ctx.todayMetrics;
  const c = ctx.todayCheckin;
  const p = ctx.profile;

  let s = `Du bist Pulse, persönlicher Ausdauer-Coach für Tobi (polarisiertes Training, Radsport/Triathlon).
Antworte auf Deutsch, präzise (max 150 Wörter), kein Markdown, kein Fett, direkt und praktisch wie ein erfahrener Sportwissenschaftler.
Wenn ein aktives Risk-Signal critical ist, musst du es klar adressieren und darfst es nicht beschönigen.

== HEUTE (${ctx.today}) ==
Readiness: ${ctx.readiness.score}/100 (${ctx.readiness.label})`;

  if (m) {
    if (m.sleepHours != null)      s += `\nSchlaf: ${m.sleepHours.toFixed(1)}h${m.sleepScore != null ? ` Score ${m.sleepScore}` : ''}`;
    if (m.hrvRmssd != null)        s += `\nHRV: ${m.hrvRmssd.toFixed(0)} ms${m.hrvStatus ? ` (${m.hrvStatus})` : ''} | Ruhepuls: ${m.restingHr ?? '–'} bpm`;
    if (m.bodyBatteryMax != null)  s += `\nBody Battery: ${m.bodyBatteryMax}% | Stress: ${m.stressAvg?.toFixed(0) ?? '–'}`;
    if (m.steps != null)           s += `\nSchritte: ${m.steps.toLocaleString('de')}`;
  }

  if (c) {
    s += `\nCheck-in: Stimmung ${c.mood}/10 Energie ${c.energy}/10 Stress ${c.stress}/10 Motivation ${c.motivation}/10`;
    if (c.notes) s += ` | "${c.notes.slice(0, 80)}"`;
  } else {
    s += '\nKein Check-in heute.';
  }

  if (ctx.recovery) {
    const r = ctx.recovery;
    s += `\n\n== RECOVERY (7d vs 30d-Baseline) ==\nScore ${r.recoveryScore}/100 | Schlafdefizit ${r.sleepDebt7dH.toFixed(1)}h (${r.sleepDebtStatus}) | HRV ${r.hrvDeviationPct.toFixed(1)}% (${r.hrvStatus}) | Ruhepuls +${r.rhrDriftBpm.toFixed(1)}bpm (${r.rhrStatus})\nEmpfehlung: ${r.recommendation}`;
  }

  if (ctx.activeHealthStates && ctx.activeHealthStates.length > 0) {
    s += '\n\n== AKTIVE HEALTH-STATES ==';
    ctx.activeHealthStates.forEach(h => {
      const part = h.bodyPart ? ` ${h.bodyPart}` : '';
      const note = h.notes ? ` — ${h.notes.slice(0, 80)}` : '';
      const end = h.endDate ? ` bis ${h.endDate}` : '';
      s += `\n${h.type}/${h.severity}${part} seit ${h.startDate}${end}${note}`;
    });
  }

  if (ctx.activeRiskSignals && ctx.activeRiskSignals.length > 0) {
    s += '\n\n== RISIKO-SIGNALE (Risk-Engine) ==';
    ctx.activeRiskSignals.forEach(r => {
      s += `\n[${r.severity.toUpperCase()}] ${r.title} (${r.ruleId})`;
      s += `\nBeschreibung: ${r.description}`;
      s += `\nEmpfehlung: ${r.recommendation}`;
    });
  }

  if (ctx.nextBestActions && ctx.nextBestActions.length > 0) {
    s += '\n\n== NÄCHSTE AKTIONEN ==';
    ctx.nextBestActions.forEach(action => {
      s += `\n[${action.priority.toUpperCase()}] ${action.title}`;
      s += `\nGrund: ${action.reason}`;
      if (action.resolvedBy) s += `\nErledigt durch: ${action.resolvedBy}`;
      s += `\nCTA: ${action.cta} (${action.targetPath})`;
      if (action.evidence?.length) s += `\nEvidence: ${action.evidence.join(' | ')}`;
    });
    s += '\nWenn Tobi fragt, was als Nächstes ansteht, priorisiere diese Liste. Bei fachfremden Fragen nur critical/high Actions erwähnen oder wenn sie direkt zur Frage passen.';
  }

  if (ctx.suppressedNextBestActions && ctx.suppressedNextBestActions.length > 0) {
    s += '\n\n== SICHTBARE ACTION-HISTORIE ==';
    ctx.suppressedNextBestActions.slice(0, 3).forEach(action => {
      s += `\nAusgeblendet: ${action.title} (${action.suppressedReason})`;
      if (action.resolutionReason) s += `\nGrund: ${action.resolutionReason}`;
    });
    s += '\nDiese Einträge sind bereits erledigt, verschoben oder nicht mehr aktuell; nicht erneut als offene Aufgabe formulieren.';
  }

  if (hasVisibleCoachPreferences(ctx.coachPreferences)) {
    s += `\n\n${formatCoachPreferences(ctx.coachPreferences)}`;
  }

  s += `\n\n== TRAININGSBELASTUNG ==\nCTL ${ctx.load.ctl.toFixed(0)} | ATL ${ctx.load.atl.toFixed(0)} | TSB ${ctx.load.tsb.toFixed(0)}`;
  if (p) {
    const parts = [
      p.ftpWatts    ? `FTP ${p.ftpWatts}W`       : '',
      p.maxHrBpm    ? `MaxHR ${p.maxHrBpm}bpm`   : '',
      p.vo2max      ? `VO2max ${p.vo2max}`         : '',
      p.trainingPhase ? `Phase: ${p.trainingPhase}` : '',
    ].filter(Boolean);
    if (parts.length) s += `\n${parts.join(' | ')}`;
  }

  if (ctx.recentActivities.length > 0) {
    s += '\n\n== LETZTE AKTIVITÄTEN ==';
    ctx.recentActivities.slice(0, 8).forEach(a => {
      const dur = a.durationSec ? `${Math.round(a.durationSec / 60)}min` : '';
      const tss = a.tss        ? ` TSS=${a.tss.toFixed(0)}`      : '';
      const np  = a.normalizedPowerW ? ` NP=${a.normalizedPowerW}W` : '';
      const hr  = a.avgHr      ? ` HRØ=${a.avgHr}bpm`           : '';
      const zone = a.plannedZone ? ` Z${a.plannedZone}` : '';
      const rpe = a.rpe != null
        ? ` RPE=${a.rpe}/10${a.rpeNote ? ` ("${a.rpeNote.slice(0, 80)}")` : ''}`
        : ' kein RPE';
      s += `\n${a.date} ${a.activityType}${zone} ${dur}${tss}${np}${hr}${rpe}`;
    });
  }

  if (ctx.recentStrengthSessions && ctx.recentStrengthSessions.length > 0) {
    s += '\n\n== KRAFTTRAINING ==';
    ctx.recentStrengthSessions.slice(0, 3).forEach(session => {
      const duration = session.durationMin ? ` ${session.durationMin}min` : '';
      const lifts = session.topLifts.map(lift => {
        const e1rm = lift.bestSet.e1rmKg != null ? ` e1RM ${lift.bestSet.e1rmKg.toFixed(1)}kg` : '';
        const weight = lift.bestSet.weightKg != null ? `${lift.bestSet.weightKg}kg` : 'BW';
        const rpe = lift.bestSet.rpe != null ? ` RPE ${lift.bestSet.rpe}/10` : '';
        return `${lift.exercise} ${lift.bestSet.reps}x${weight}${e1rm}${rpe}`;
      }).join('; ');
      s += `\n${session.date}${duration}: ${lifts}`;
    });
  }

  if (ctx.equipmentDueForReplacement && ctx.equipmentDueForReplacement.length > 0) {
    s += '\n\n== EQUIPMENT ==';
    ctx.equipmentDueForReplacement.forEach(item => {
      s += `\n${item.name} (${item.category}): ${item.pctConsumed.toFixed(0)}% verbraucht (${item.kmCurrent.toFixed(0)}/${item.kmRetirement.toFixed(0)} km)`;
    });
  }

  if (ctx.upcomingWorkouts.length > 0) {
    s += '\n\n== NÄCHSTE TRAININGS ==';
    ctx.upcomingWorkouts.slice(0, 3).forEach(w => {
      const desc = w.description ? ` (${w.description.slice(0, 60)})` : '';
      s += `\n${w.plannedDate}: ${w.activityType} Z${w.zone} ${w.durationMin}min${desc}`;
    });
  }

  if (ctx.metrics14.length > 0) {
    s += '\n\n== 14-TAGE METRIKEN (Datum | Schlaf | HRV | Bat. | Stress) ==';
    ctx.metrics14.forEach(r => {
      s += `\n${r.date} | ${r.sleepHours?.toFixed(1) ?? '–'}h | ${r.hrvRmssd?.toFixed(0) ?? '–'}ms | ${r.bodyBatteryMax ?? '–'}% | ${r.stressAvg?.toFixed(0) ?? '–'}`;
    });
  }

  if (ctx.checkins14.length > 0) {
    s += `\n\n== MENTAL TREND (${ctx.checkins14.length} Check-ins — St/En/Str/Mo) ==`;
    ctx.checkins14.forEach(c => {
      s += `\n${c.date}: ${c.mood}/${c.energy}/${c.stress}/${c.motivation}`;
    });
  }

  if (ctx.latestWeight) {
    const w = ctx.latestWeight;
    const trend = w.trend30d != null
      ? ` | 30d-Trend: ${w.trend30d > 0 ? '+' : ''}${w.trend30d.toFixed(1)}kg`
      : '';
    s += `\n\n== GEWICHT ==\n${w.weightKg.toFixed(1)}kg (${w.date})${trend}`;
  }

  return s;
}

export async function getCoachReplyRich(
  message: string,
  systemPrompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-8).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: message },
  ];
  return llmChat(messages, SMART_MODEL);
}

// ─── Check-in classification (used by voice flow) ─────────────────────────────

export interface CheckinExtraction {
  mood:       number;
  energy:     number;
  stress:     number;
  motivation: number;
  themes:     string[];
  followUpQuestions: string[];
}

export interface CheckinClassification {
  isCheckin:  boolean;
  extraction: CheckinExtraction | undefined;
  coachReply: string;
}

const CHECKIN_SYSTEM_PROMPT = `Du bist Pulse, ein persönlicher Gesundheits- und Leistungscoach.

Analysiere die Nachricht des Nutzers und bestimme:
1. Ist dies ein Check-in (der Nutzer beschreibt seine aktuelle Befindlichkeit, Energie, Stimmung, Stressoren, Tagesgeschehen)?
2. Oder ist dies eine Frage oder ein Auftrag?

Antworte AUSSCHLIESSLICH mit folgendem JSON-Format (kein Markdown, kein Text davor oder danach):

{
  "isCheckin": true/false,
  "extraction": {          // nur wenn isCheckin=true
    "mood":       5,       // 1-10: wie gut fühlt sich der Nutzer emotional
    "energy":     6,       // 1-10: physische und mentale Energie
    "stress":     4,       // 1-10: Stresslevel (10 = maximal gestresst)
    "motivation": 7,       // 1-10: Motivation und Antrieb
    "themes":     ["Schlaf", "Rücken", "Arbeit"],
    "followUpQuestions": ["Seit wann hast du Rückenschmerzen?"]
  },
  "coachReply": "..."
}

Bei isCheckin=false: extraction weglassen, coachReply ist normale Antwort auf die Frage.`;

export async function classifyAndExtractCheckin(text: string): Promise<CheckinClassification> {
  const raw = await llmComplete(CHECKIN_SYSTEM_PROMPT, text, SMART_MODEL);

  try {
    const parsed = JSON.parse(raw) as {
      isCheckin: boolean;
      extraction?: CheckinExtraction;
      coachReply: string;
    };
    return {
      isCheckin:  parsed.isCheckin ?? false,
      extraction: parsed.isCheckin ? parsed.extraction : undefined,
      coachReply: parsed.coachReply ?? '',
    };
  } catch {
    return { isCheckin: false, extraction: undefined, coachReply: raw };
  }
}
