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
