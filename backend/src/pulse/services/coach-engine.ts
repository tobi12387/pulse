import { llmComplete, llmChat, SMART_MODEL, type LLMMessage } from '../../lib/llm.js';

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
  recentActivities: Array<{
    date: string; activityType: string; durationSec: number | null;
    tss: number | null; normalizedPowerW: number | null; avgHr: number | null;
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
}

export function buildRichSystemPrompt(ctx: CoachFullContext): string {
  const m = ctx.todayMetrics;
  const c = ctx.todayCheckin;
  const p = ctx.profile;

  let s = `Du bist Pulse, persönlicher Ausdauer-Coach für Tobi (polarisiertes Training, Radsport/Triathlon).
Antworte auf Deutsch, präzise (max 150 Wörter), kein Markdown, kein Fett, direkt und praktisch wie ein erfahrener Sportwissenschaftler.

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
      s += `\n${a.date} ${a.activityType} ${dur}${tss}${np}${hr}`;
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
