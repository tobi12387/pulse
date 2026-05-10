export type SupportSessionFocus = 'cycling_prehab' | 'run_prehab' | 'mobility_only' | 'core_stability';

export interface SupportSessionBlock {
  label: string;
  minutes: number;
  intensity: 'easy' | 'controlled';
  examples: string[];
}

export interface SupportSession {
  title: string;
  description: string;
  planNote: string;
  blocks: SupportSessionBlock[];
}

const FOCUS_TITLE: Record<SupportSessionFocus, string> = {
  cycling_prehab: 'Cycling Prehab',
  run_prehab: 'Run Prehab',
  mobility_only: 'Mobility',
  core_stability: 'Core Stability',
};

function clampDuration(durationMin: number): number {
  return Math.max(10, Math.min(45, Math.round(durationMin)));
}

export function buildSupportSession(input: {
  focus: SupportSessionFocus;
  durationMin: number;
  fatigue: 'normal' | 'high';
}): SupportSession {
  const duration = clampDuration(input.durationMin);
  const easy = input.fatigue === 'high';
  const blockIntensity: SupportSessionBlock['intensity'] = easy ? 'easy' : 'controlled';

  const blocks: SupportSessionBlock[] = [
    {
      label: 'Mobility',
      minutes: input.focus === 'mobility_only'
        ? Math.max(6, Math.round(duration * 0.6))
        : duration < 20
          ? Math.max(5, Math.round(duration * 0.45))
          : Math.max(5, Math.round(duration * 0.25)),
      intensity: 'easy',
      examples: ['Huefte', 'BWS-Rotation', 'Ankle Rocks'],
    },
  ];
  const coreMin = input.focus === 'mobility_only'
    ? 0
    : input.focus === 'core_stability'
      ? Math.max(5, Math.round(duration * 0.45))
      : duration < 20
        ? Math.max(3, Math.round(duration * 0.35))
        : Math.max(5, Math.round(duration * 0.25));
  if (coreMin > 0) {
    blocks.push({
      label: 'Core',
      minutes: coreMin,
      intensity: blockIntensity,
      examples: ['Dead Bug', 'Side Plank', 'Bird Dog'],
    });
  }
  const gluteMin = (input.focus === 'cycling_prehab' || input.focus === 'run_prehab') && duration >= 20
    ? Math.max(5, Math.round(duration * 0.25))
    : 0;
  if (gluteMin > 0) {
    blocks.push({
      label: 'Glutes',
      minutes: gluteMin,
      intensity: blockIntensity,
      examples: ['Glute Bridge', 'Monster Walk', 'Single-Leg Hinge'],
    });
  }
  const usedMin = blocks.reduce((sum, block) => sum + block.minutes, 0);
  blocks.push({
    label: 'Cooldown',
    minutes: Math.max(2, duration - usedMin),
    intensity: 'easy',
    examples: ['Atmung', 'lockeres Dehnen'],
  });

  return {
    title: `${FOCUS_TITLE[input.focus]} ${duration}`,
    description: easy
      ? 'Sehr leichte Support-Session fuer Beweglichkeit und Recovery; kein Zusatzstress.'
      : 'Support-Session fuer Belastbarkeit; kontrolliert ausfuehren, kein Zusatzstress und kein Muskelversagen.',
    planNote: easy
      ? 'Recovery bleibt Prioritaet; diese Einheit darf sich leichter anfuehlen als geplant.'
      : 'Unterstuetzt Haltung, Core und robuste Wiederholbarkeit.',
    blocks,
  };
}
