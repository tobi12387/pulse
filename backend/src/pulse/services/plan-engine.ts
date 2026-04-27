import { llmComplete, SMART_MODEL } from '../../lib/llm.js';

// Phase distribution: base=z2-heavy, build=z3+threshold, peak=race-specific, taper=reduced

type Phase = 'base' | 'build' | 'peak' | 'taper';
type ActivityType = 'run' | 'bike' | 'swim' | 'strength';

interface WorkoutTemplate {
  activityType: ActivityType;
  zone: number;
  durationMin: number;
  description: string;
}

interface WeekWorkout {
  plannedDate: string;
  activityType: ActivityType;
  zone: number;
  durationMin: number;
  targetTss: number;
  description: string;
}

const PHASE_TEMPLATES: Record<Phase, WorkoutTemplate[]> = {
  base: [
    { activityType: 'run',      zone: 2, durationMin: 60,  description: 'Langer Z2-Lauf — aerobes Fundament aufbauen' },
    { activityType: 'bike',     zone: 2, durationMin: 90,  description: 'Z2-Ausfahrt — Grundlagenausdauer' },
    { activityType: 'run',      zone: 2, durationMin: 45,  description: 'Lockerer Z2-Lauf' },
    { activityType: 'strength', zone: 1, durationMin: 45,  description: 'Kraft & Stabilität' },
  ],
  build: [
    { activityType: 'run',  zone: 4, durationMin: 60,  description: 'Tempotraining — Schwellenintervalle 4x10min' },
    { activityType: 'bike', zone: 2, durationMin: 120, description: 'Langer Z2-Block — Volumensaufbau' },
    { activityType: 'run',  zone: 3, durationMin: 75,  description: 'Tempoausdauer (Z3)' },
    { activityType: 'bike', zone: 4, durationMin: 60,  description: 'Schwellenintervalle Rad — 3x15min' },
  ],
  peak: [
    { activityType: 'run',  zone: 5, durationMin: 45, description: 'VO2max-Intervalle — 6x4min' },
    { activityType: 'bike', zone: 4, durationMin: 75, description: 'Renn-Simulation — Wettkampftempo' },
    { activityType: 'run',  zone: 2, durationMin: 30, description: 'Kurzer Aktivierungslauf' },
    { activityType: 'run',  zone: 3, durationMin: 60, description: 'Tempodauerlauf' },
  ],
  taper: [
    { activityType: 'run',  zone: 2, durationMin: 30, description: 'Lockeres Eintrotteln' },
    { activityType: 'bike', zone: 2, durationMin: 45, description: 'Lockere Aktivierung' },
    { activityType: 'run',  zone: 4, durationMin: 20, description: 'Kurze Aktivierungsintervalle — 4x1min schnell' },
  ],
};

export function generateWeekWorkouts(params: {
  weekStart: string;
  phase: Phase;
  weeklyHoursTarget: number;
  availableDays: number[]; // 0=Sun ... 6=Sat
}): WeekWorkout[] {
  const { weekStart, phase, weeklyHoursTarget, availableDays } = params;
  const templates = PHASE_TEMPLATES[phase];
  const totalMin = weeklyHoursTarget * 60;

  const workoutsPerWeek = Math.min(availableDays.length, templates.length);
  const selectedTemplates = templates.slice(0, workoutsPerWeek);
  const templateTotal = selectedTemplates.reduce((s, t) => s + t.durationMin, 0);
  const scaleFactor = totalMin / templateTotal;

  const startDate = new Date(weekStart);
  const result: WeekWorkout[] = [];

  for (let i = 0; i < workoutsPerWeek; i++) {
    const template = selectedTemplates[i]!;
    const dayOffset = availableDays[i]!;
    const plannedDate = new Date(startDate);
    plannedDate.setDate(plannedDate.getDate() + dayOffset);

    const durationMin = Math.round(template.durationMin * scaleFactor);
    const targetTss = Math.round(template.zone * 15 * (durationMin / 60));

    result.push({
      plannedDate: plannedDate.toISOString().split('T')[0]!,
      activityType: template.activityType,
      zone: template.zone,
      durationMin,
      targetTss,
      description: template.description,
    });
  }

  return result;
}

export interface LLMPlanInput {
  weekStart: string;
  phase: Phase;
  weeklyHoursTarget: number;
  availableDays: number[];
  ctl: number;
  atl: number;
  tsb: number;
  ftpWatts: number;
  recentActivities: Array<{ activityType: string; durationMin: number; tss: number }>;
}

export async function generateLLMWeekPlan(input: LLMPlanInput): Promise<WeekWorkout[]> {
  // availableDays convention: 0=Mo, 1=Di, 2=Mi, 3=Do, 4=Fr, 5=Sa, 6=So (matches dayOffset in LLM output)
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const availableStr = input.availableDays.map(d => dayNames[d] ?? String(d)).join(', ');
  const availableOffsets = [...input.availableDays].sort((a, b) => a - b).join(', ');
  const phaseLabel = input.phase === 'base' ? 'Grundlagenaufbau' : input.phase === 'build' ? 'Aufbau' : input.phase === 'peak' ? 'Wettkampfvorbereitung' : 'Tapering';
  const recentStr = input.recentActivities.slice(0, 3).map(a => `${a.activityType} ${a.durationMin}min TSS=${a.tss}`).join(', ') || 'keine';

  const prompt = `Erstelle einen polarisierten Trainingsplan für diese Woche (ab ${input.weekStart}).

Athletenprofil:
- Phase: ${phaseLabel}
- Wöchentliche Stunden: ${input.weeklyHoursTarget}h
- FTP: ${input.ftpWatts}W
- Fitness CTL=${input.ctl.toFixed(0)}, Ermüdung ATL=${input.atl.toFixed(0)}, Form TSB=${input.tsb.toFixed(0)}
- Letzte Trainings: ${recentStr}

WICHTIG — Verfügbare Tage (dayOffset): ${availableOffsets} (= ${availableStr})
Du darfst NUR diese dayOffset-Werte verwenden: [${availableOffsets}]. Alle anderen Tage sind GESPERRT.

Polarisiertes Modell: ~80% extensiv (Z1-Z2), ~20% intensiv (Z4-Z5). Kein Z3.${input.tsb < -15 ? '\nWICHTIG: Hohe Ermüdung (TSB=' + input.tsb.toFixed(0) + ') — Intensität reduzieren, Erholung priorisieren.' : ''}

Antworte NUR mit einem JSON-Array, kein Text davor/danach:
[{"dayOffset":0,"activityType":"run|bike|swim|strength","zone":1-5,"durationMin":60,"description":"kurze Beschreibung auf Deutsch"}]
dayOffset = Tage ab Montag (0=Mo,1=Di,2=Mi,3=Do,4=Fr,5=Sa,6=So)`;

  const raw = await llmComplete(
    'Du bist Sportwissenschaftler und Ausdauercoach. Antworte nur mit validem JSON-Array.',
    prompt,
    SMART_MODEL,
  );

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('LLM returned no valid JSON');

  const items = JSON.parse(jsonMatch[0]) as Array<{
    dayOffset: number; activityType: string; zone: number; durationMin: number; description: string;
  }>;

  const availableSet = new Set(input.availableDays);
  const startDate = new Date(input.weekStart);
  return items.filter(item => availableSet.has(item.dayOffset)).map(item => {
    const plannedDate = new Date(startDate);
    plannedDate.setDate(plannedDate.getDate() + (item.dayOffset ?? 0));
    const durationMin = Math.max(15, Math.min(300, item.durationMin ?? 60));
    const zone = Math.max(1, Math.min(5, item.zone ?? 2));
    return {
      plannedDate: plannedDate.toISOString().split('T')[0]!,
      activityType: (['run','bike','swim','strength','hike','other'].includes(item.activityType) ? item.activityType : 'run') as ActivityType,
      zone,
      durationMin,
      targetTss: Math.round(zone * 15 * (durationMin / 60)),
      description: item.description ?? '',
    };
  });
}

export function adaptIntensityForReadiness(
  workout: { durationMin: number; zone: number },
  readiness: number,
): { durationMin: number; zone: number } {
  if (readiness >= 65) return workout;

  if (readiness < 35) {
    return {
      durationMin: Math.round(workout.durationMin * 0.5),
      zone: Math.max(1, workout.zone - 2),
    };
  }

  // readiness 35-64: reduce duration, cap zone at 3
  return {
    durationMin: Math.round(workout.durationMin * 0.7),
    zone: Math.min(workout.zone, 3),
  };
}
