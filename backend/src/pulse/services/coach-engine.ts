import { llmComplete, FAST_MODEL } from '../../lib/llm.js';

export interface CoachContext {
  readiness: number;
  sleepHours: number | null;
  hrvStatus: string | null;
  bodyBatteryMax: number | null;
  tsb: number;
  stressAvg: number | null;
}

const INTENTS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'greeting',    pattern: /^(hallo|hi|hey|guten morgen|servus|moin)/i },
  { name: 'readiness',   pattern: /(readiness|bereit|wie.*fit|topfit|in form)/i },
  { name: 'sleep',       pattern: /(schlaf|schlafen|müde|ausgeschlafen)/i },
  { name: 'hrv',         pattern: /(hrv|herzrate|herzratenvariabil)/i },
  { name: 'load',        pattern: /(ctl|atl|tsb|trainingsbelastung|trainingslast)/i },
  { name: 'training',    pattern: /(trainingsplan|heute.*training|workout|was.*trainier)/i },
  { name: 'nutrition',   pattern: /(ernährung|essen|protein|kohlenhydrat|kalorien)/i },
  { name: 'race',        pattern: /(wettkampf|rennen|race|event)/i },
  { name: 'injury',      pattern: /(verletzung|schmerz|weh|übertraining)/i },
  { name: 'motivation',  pattern: /(motivat|demotiviert|lustlos|keine.*lust)/i },
  { name: 'weather',     pattern: /(wetter|regen|draußen|outdoor)/i },
  { name: 'goal',        pattern: /(ziel|goal|target|anpeilen)/i },
  { name: 'recovery',    pattern: /(erholung|recovery|regeneration)/i },
  { name: 'weight',      pattern: /(gewicht|weight.*kg|abnehm)/i },
];

export function detectIntent(message: string): string | null {
  for (const { name, pattern } of INTENTS) {
    if (pattern.test(message)) return name;
  }
  return null;
}

function ruleReply(intent: string, ctx: CoachContext): string | null {
  const r = ctx.readiness;
  const intensityAdvice = r >= 70
    ? 'Grünes Licht für hartes Training (Zone 4-5).'
    : r >= 50
    ? 'Moderates Training (Zone 2-3) ist ideal.'
    : 'Heute besser regenerieren — Zone 1 oder Pause.';

  switch (intent) {
    case 'greeting':
      return `Hallo! Deine Readiness heute: ${r}/100. ${intensityAdvice} Wie kann ich dir helfen?`;

    case 'readiness':
      return `Deine Readiness beträgt ${r}/100. Schlaf: ${ctx.sleepHours?.toFixed(1) ?? '–'}h, HRV: ${ctx.hrvStatus ?? '–'}, TSB: ${ctx.tsb}. ${intensityAdvice}`;

    case 'sleep':
      return ctx.sleepHours != null
        ? `Du hast ${ctx.sleepHours.toFixed(1)} Stunden geschlafen. ${ctx.sleepHours < 7 ? 'Das ist etwas wenig — priorisiere heute Erholung.' : 'Gute Schlafbasis für das Training!'}`
        : 'Keine Schlafdaten für heute verfügbar. Verbinde Garmin oder Apple Health.';

    case 'hrv':
      return ctx.hrvStatus != null
        ? `Dein HRV-Status: "${ctx.hrvStatus}". ${ctx.hrvStatus === 'poor' || ctx.hrvStatus === 'below_normal' ? 'Dein Nervensystem braucht Erholung — kein intensives Training heute.' : 'Dein Nervensystem ist gut erholt.'}`
        : 'Keine HRV-Daten verfügbar. Stelle sicher, dass du Garmin-Daten synchronisierst.';

    case 'load':
      return `Dein Training Stress Balance (TSB) liegt bei ${ctx.tsb}. ${ctx.tsb > 10 ? 'Du bist frisch und bereit für intensives Training.' : ctx.tsb < -15 ? 'Du akkumulierst Ermüdung — eine Regenerationswoche wäre sinnvoll.' : 'Ausgewogene Trainingsbelastung.'}`;

    case 'training':
      return `Basierend auf Readiness ${r}/100: ${intensityAdvice} ${r >= 65 ? 'Heute wäre ein guter Tag für Qualitätstraining.' : 'Halte die Intensität gering.'}`;

    case 'recovery':
      return `TSB ${ctx.tsb}: ${ctx.tsb < -10 ? 'Du akkumulierst Ermüdung. Plane aktive Erholung: Spazieren, Yoga, Stretching.' : ctx.tsb > 15 ? 'Du bist gut erholt und frisch — nutze diesen Zustand für intensives Training.' : 'Gute Balance zwischen Belastung und Erholung.'}`;

    case 'nutrition':
      return `Für Ausdauersport: 6-8g Kohlenhydrate/kg Körpergewicht an Trainingstagen, 1.6-2g Protein/kg täglich. ${r < 60 ? 'Bei geringer Readiness besonders auf ausreichende Kohlenhydratzufuhr achten.' : 'Bei guter Readiness kannst du die Kohlenhydrate moderat halten.'}`;

    case 'motivation':
      return `Motivationstief? Das ist normal. Deine Readiness (${r}/100) zeigt: ${r < 50 ? 'Dein Körper braucht Pause — Motivation kommt nach Erholung zurück.' : 'Du bist körperlich bereit, der Kopf braucht manchmal einen Schubs. Klein anfangen!'}`;

    case 'weight':
      return 'Gewichtsmanagement im Sport: Fokus auf Qualität der Nahrung, nicht Kalorienzählen. Trainiere nicht nüchtern bei hoher Intensität. Kleine Kaloriendefizite (200-300 kcal) in der Basisphase sind ok.';

    default:
      return null;
  }
}

export async function getCoachReply(message: string, ctx: CoachContext): Promise<string> {
  const intent = detectIntent(message);
  if (intent) {
    const rule = ruleReply(intent, ctx);
    if (rule) return rule;
  }

  // LLM fallback
  const systemPrompt = `Du bist Pulse, ein persönlicher Ausdauercoach. Antworte auf Deutsch, kurz und präzise (max 120 Wörter). Kein Markdown.
Kontext: Readiness ${ctx.readiness}/100, Schlaf ${ctx.sleepHours?.toFixed(1) ?? 'unbekannt'}h, HRV ${ctx.hrvStatus ?? 'unbekannt'}, TSB ${ctx.tsb}.`;

  return llmComplete(systemPrompt, message, FAST_MODEL);
}
