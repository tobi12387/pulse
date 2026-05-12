import type { PulseFitnessLoad, PulseMentalCheckin, PulseReadiness, PulseRecoveryMetrics } from '@coaching-os/shared/pulse';
import { mentalImpactLevel } from '../../mental/mental-impact';

export type ResilienceState = 'protect' | 'steady' | 'ready' | 'unknown';
export type ResilienceActionKind = 'check_in' | 'open_plan' | 'open_recovery';
export type ResilienceLaneId = 'boundary' | 'plan' | 'quality';
export type ResilienceCheckinInput = Partial<PulseMentalCheckin> | null;

export type ResilienceHomeInput = {
  readiness?: Pick<PulseReadiness, 'score' | 'label' | 'shortLabel' | 'color'> | null;
  fitnessLoad?: Pick<PulseFitnessLoad, 'tsb'> | null;
  recovery?: PulseRecoveryMetrics | null;
} | null;

export type ResilienceLane = {
  id: ResilienceLaneId;
  label: string;
  title: string;
  body: string;
};

export type ResilienceGuidance = {
  state: ResilienceState;
  tone: 'green' | 'amber' | 'rose' | 'info';
  title: string;
  summary: string;
  primaryAction: {
    kind: ResilienceActionKind;
    label: string;
    targetPath: string | null;
    resultPreview: string;
  };
  lanes: ResilienceLane[];
  evidence: string[];
};

function constrainedRecovery(home: ResilienceHomeInput): boolean {
  const recovery = home?.recovery;
  return (home?.readiness?.score != null && home.readiness.score < 55)
    || (recovery?.recoveryScore != null && recovery.recoveryScore < 58)
    || recovery?.sleepDebt7d.status === 'severe'
    || recovery?.hrvDeviation7d.status === 'declining'
    || recovery?.rhrDrift7d.status === 'elevated';
}

function mixedRecovery(home: ResilienceHomeInput): boolean {
  const recovery = home?.recovery;
  return (home?.readiness?.score != null && home.readiness.score < 72)
    || (home?.fitnessLoad?.tsb != null && home.fitnessLoad.tsb < -5)
    || (recovery?.recoveryScore != null && recovery.recoveryScore < 74)
    || recovery?.sleepDebt7d.status === 'mild'
    || recovery?.hrvDeviation7d.status === 'recovering';
}

function evidence(home: ResilienceHomeInput, checkin: ResilienceCheckinInput): string[] {
  const items = [
    home?.readiness?.score != null ? `Readiness ${home.readiness.score}/100` : 'Readiness offen',
    home?.fitnessLoad?.tsb != null ? `TSB ${home.fitnessLoad.tsb.toFixed(1)}` : 'TSB offen',
    home?.recovery?.recoveryScore != null ? `Recovery ${home.recovery.recoveryScore}/100` : 'Recovery offen',
    checkin?.stress != null ? `Stress ${checkin.stress}/10` : 'Check-in offen',
  ];
  return items.slice(0, 4);
}

function scoredCheckin(checkin: ResilienceCheckinInput): PulseMentalCheckin | null {
  if (!checkin) return null;
  return [checkin.mood, checkin.energy, checkin.stress, checkin.motivation].every(Number.isFinite)
    ? checkin as PulseMentalCheckin
    : null;
}

function qualityCopy(home: ResilienceHomeInput, checkin: ResilienceCheckinInput): string {
  const missing = [
    checkin ? null : 'Check-in',
    home?.readiness ? null : 'Readiness',
    home?.recovery ? null : 'Garmin-Recovery',
  ].filter((item): item is string => item != null);

  if (missing.length > 0) {
    return `${missing.join(', ')} offen. Pulse bewertet das als Signalqualität, nicht als Fehler oder Diagnose.`;
  }
  return 'Signale sind nutzbar: subjektive Lage, Readiness und Recovery zeigen gemeinsam in dieselbe Richtung.';
}

export function buildResilienceGuidance(input: {
  home: ResilienceHomeInput;
  checkin: ResilienceCheckinInput;
}): ResilienceGuidance {
  const checkin = scoredCheckin(input.checkin);
  const mentalLevel = checkin ? mentalImpactLevel(checkin) : null;
  const recoveryConstrained = constrainedRecovery(input.home);
  const recoveryMixed = mixedRecovery(input.home);

  if (!input.home && !checkin) {
    return {
      state: 'unknown',
      tone: 'info',
      title: 'Signale zuerst schließen',
      summary: 'Heute fehlen noch genug Recovery- und Mental-Signale für eine belastbare Grenze.',
      primaryAction: {
        kind: 'check_in',
        label: 'Check-in öffnen',
        targetPath: '#mental-checkin-form',
        resultPreview: 'Du springst zum Check-in; Pulse schreibt nichts in Plan oder Garmin.',
      },
      lanes: [
        { id: 'boundary', label: 'Grenze', title: 'Noch nicht festlegen', body: 'Erst subjektive Lage erfassen, dann Training oder Erholung bewerten.' },
        { id: 'plan', label: 'Planwirkung', title: 'Keine automatische Änderung', body: 'Der Plan bleibt unverändert, bis du eine Planaktion bewusst öffnest.' },
        { id: 'quality', label: 'Signalqualität', title: 'Evidenz offen', body: qualityCopy(input.home, checkin) },
      ],
      evidence: evidence(input.home, checkin),
    };
  }

  if (mentalLevel === 'protect' || recoveryConstrained) {
    return {
      state: 'protect',
      tone: 'rose',
      title: 'Heute Schutzmodus wählen',
      summary: 'Kopf oder Körper senden ein klares Vorsichtssignal. Halte den Tag kleiner und entscheide Planlast bewusst.',
      primaryAction: {
        kind: 'open_plan',
        label: 'Planwirkung prüfen',
        targetPath: '/plan?tab=training&source=resilience#plan-scenario-preview',
        resultPreview: 'Du öffnest die Planvorschau; Änderungen passieren erst nach Apply.',
      },
      lanes: [
        { id: 'boundary', label: 'Grenze', title: 'Kleiner reicht', body: 'Heute eine klare Grenze setzen: weniger Intensität, kein Zusatzdruck, kurzer Abschluss.' },
        { id: 'plan', label: 'Planwirkung', title: 'Plan bewusst prüfen', body: 'Intensität nur halten, wenn Warm-up, Check-in und Recovery nach dem Start stabil bleiben.' },
        { id: 'quality', label: 'Signalqualität', title: 'Vorsicht ist belegt', body: qualityCopy(input.home, checkin) },
      ],
      evidence: evidence(input.home, checkin),
    };
  }

  if (mentalLevel === 'steady' || recoveryMixed) {
    return {
      state: 'steady',
      tone: 'amber',
      title: 'Heute dosiert bleiben',
      summary: 'Die Signale sind gemischt. Ein ruhiger Rahmen ist hilfreicher als weitere Optionen oder ein harter Reiz.',
      primaryAction: {
        kind: 'open_recovery',
        label: 'Recovery prüfen',
        targetPath: '/data?tab=trends#data-recovery',
        resultPreview: 'Du öffnest die Recovery-Evidenz; Plan und Garmin bleiben unverändert.',
      },
      lanes: [
        { id: 'boundary', label: 'Grenze', title: 'Rahmen setzen', body: 'Vorher festlegen, wann genug ist: RPE, Dauer oder Intensität nicht nach oben verhandeln.' },
        { id: 'plan', label: 'Planwirkung', title: 'Belastung dosieren', body: 'Plan bleibt möglich, aber Intensität und Umfang sollten enger geführt werden.' },
        { id: 'quality', label: 'Signalqualität', title: 'Signale reichen für Richtung', body: qualityCopy(input.home, checkin) },
      ],
      evidence: evidence(input.home, checkin),
    };
  }

  return {
    state: 'ready',
    tone: 'green',
    title: 'Normal starten',
    summary: 'Recovery und mentale Lage wirken ruhig. Starte normal und halte die Entscheidung trotzdem einfach.',
    primaryAction: {
      kind: 'open_plan',
      label: 'Plan öffnen',
      targetPath: '/plan?tab=training&source=resilience#plan-scenario-preview',
      resultPreview: 'Du prüfst die nächste Planentscheidung; es wird nichts automatisch geschrieben.',
    },
    lanes: [
      { id: 'boundary', label: 'Grenze', title: 'Normale Grenze', body: 'Kein Sonderstopp nötig. Warm-up und Tagesgefühl bleiben die einfache Kontrollstelle.' },
      { id: 'plan', label: 'Planwirkung', title: 'Plan normal bewerten', body: 'Der geplante Reiz darf nach Planlogik bewertet werden, solange Ausführung und Fueling passen.' },
      { id: 'quality', label: 'Signalqualität', title: 'Evidenz nutzbar', body: qualityCopy(input.home, checkin) },
    ],
    evidence: evidence(input.home, checkin),
  };
}
