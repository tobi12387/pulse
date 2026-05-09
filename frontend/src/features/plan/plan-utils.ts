import type { PulsePlannedWorkout } from '@coaching-os/shared/pulse';

type PlannedWorkout = PulsePlannedWorkout;

export type GarminConfidenceTone = 'ok' | 'watch' | 'error';

export type GarminConfidenceCopy = {
  title: string;
  detail: string;
  tone: GarminConfidenceTone;
};

export type WorkoutUpdate = {
  activityType?: string;
  zone?: number;
  durationMin?: number;
  plannedDate?: string;
  status?: 'planned' | 'skipped';
  description?: string | null;
};

export type PlanAlternativeId = 'shorter' | 'easier' | 'move' | 'rest';

export function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function executionStatusFor(workout: PlannedWorkout): NonNullable<PlannedWorkout['executionStatus']> {
  if (workout.executionStatus) return workout.executionStatus;
  if (workout.status === 'completed') return 'completed_matched';
  if (workout.garminScheduledId) return 'garmin_scheduled';
  if (workout.garminWorkoutId) return 'garmin_template';
  return 'local_planned';
}

export function garminConfidenceCopy(workout: PlannedWorkout): GarminConfidenceCopy {
  if (workout.garminSyncContract?.status === 'blocked') {
    return {
      title: 'Garmin Sync blockiert',
      detail: workout.garminSyncContract.summary,
      tone: 'error',
    };
  }
  if (workout.garminSyncContract?.status === 'degraded') {
    return {
      title: 'Garmin mit Einschränkung',
      detail: workout.garminSyncContract.summary,
      tone: 'watch',
    };
  }

  const status = executionStatusFor(workout);
  if (status === 'garmin_scheduled') {
    return {
      title: 'Auf Garmin geplant',
      detail: 'Template und Kalendertermin sind vorhanden.',
      tone: 'ok',
    };
  }
  if (status === 'garmin_template') {
    return {
      title: 'Garmin Vorlage vorhanden',
      detail: 'Noch nicht sicher im Kalender. Bei Bedarf erneut synchronisieren.',
      tone: 'watch',
    };
  }
  if (status === 'local_planned') {
    return {
      title: 'Nur in Pulse geplant',
      detail: 'Noch nicht auf Uhr oder Edge synchronisiert.',
      tone: 'watch',
    };
  }
  if (status === 'completed_matched') {
    return {
      title: 'Mit Garmin erledigt',
      detail: 'Eine Garmin-Aktivität passt zu diesem Workout.',
      tone: 'ok',
    };
  }
  if (status === 'missed') {
    return {
      title: 'Nicht ausgeführt',
      detail: 'Keine passende Garmin-Aktivität gefunden.',
      tone: 'error',
    };
  }
  return {
    title: 'Ersetzt oder außerhalb Plan',
    detail: 'Garmin zeigt eine andere Ausführung als geplant.',
    tone: 'watch',
  };
}

export function roundToFive(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5);
}

function appendPlanNote(description: string | null, note: string): string {
  const base = description?.trim();
  const next = base ? `${base}\n${note}` : note;
  return next.length > 1000 ? next.slice(0, 997) + '...' : next;
}

function dayIndexFromDate(date: string): number {
  const day = new Date(date + 'T12:00:00').getDay();
  return day === 0 ? 6 : day - 1;
}

export function nextAvailableDateAfter(date: string, availableDays: number[]): string {
  const allowed = availableDays.length > 0 ? availableDays : [dayIndexFromDate(date)];
  for (let offset = 1; offset <= 14; offset += 1) {
    const next = new Date(date + 'T12:00:00');
    next.setDate(next.getDate() + offset);
    if (allowed.includes(dayIndexFromDate(isoDate(next)))) return isoDate(next);
  }
  const next = new Date(date + 'T12:00:00');
  next.setDate(next.getDate() + 1);
  return isoDate(next);
}

export function weekStartForDate(date: string): string {
  return isoDate(getMonday(new Date(date + 'T12:00:00')));
}

export function getNextOpenWorkout(workouts: PlannedWorkout[], today: string): PlannedWorkout | null {
  return [...workouts]
    .filter(w => w.status !== 'completed' && w.status !== 'skipped' && w.plannedDate >= today)
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))[0] ?? null;
}

export function buildPlanAlternative(workout: PlannedWorkout, id: PlanAlternativeId, availableDays: number[]): WorkoutUpdate {
  if (id === 'shorter') {
    const durationMin = roundToFive(workout.durationMin * 0.65);
    return {
      durationMin,
      status: 'planned',
      description: appendPlanNote(workout.description, `Alternative: kürzer (${durationMin} min), damit der Trainingsreiz bleibt, aber weniger Tagesbudget verbraucht.`),
    };
  }
  if (id === 'easier') {
    const zone = Math.max(1, Math.min(2, workout.zone - 1));
    const durationMin = roundToFive(workout.durationMin * 0.85);
    return {
      zone,
      durationMin,
      status: 'planned',
      description: appendPlanNote(workout.description, `Alternative: leichter (Z${zone}, ${durationMin} min), wenn Load oder Tagesform gegen die geplante Intensität sprechen.`),
    };
  }
  if (id === 'move') {
    const plannedDate = nextAvailableDateAfter(workout.plannedDate, availableDays);
    return {
      plannedDate,
      status: 'planned',
      description: appendPlanNote(workout.description, `Alternative: verschoben auf ${plannedDate}, damit die Einheit nicht erzwungen wird.`),
    };
  }
  return {
    status: 'skipped',
    description: appendPlanNote(workout.description, 'Alternative: bewusst frei gelassen, damit Erholung heute Vorrang hat.'),
  };
}

export function getMondays(): string[] {
  const now = new Date();
  const off = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() + off);
  return [0, 1].map(w => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + w * 7);
    return isoDate(d);
  });
}

export function formatPlanDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}
