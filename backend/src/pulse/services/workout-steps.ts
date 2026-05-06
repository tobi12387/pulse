import type { WorkoutStep } from '../../db/pulse-schema.js';
import { llmComplete, SMART_MODEL } from '../../lib/llm.js';
import { hrTargetRangeForZone } from '@coaching-os/shared/pulse-thresholds';

type WorkoutStepWorkout = {
  id?: string;
  activityType: string;
  zone: number;
  durationMin: number;
  description: string | null;
};

type WorkoutStepProfile = {
  ftpWatts?: number | null;
  maxHrBpm: number | null;
  lthrBpm: number | null;
};

function supportsHrStepTargets(activityType: string): boolean {
  return activityType === 'run' || activityType === 'bike' || activityType === 'hike';
}

function addHrTargetToStep(step: WorkoutStep, profile: WorkoutStepProfile | undefined): WorkoutStep {
  const maxHr = profile?.maxHrBpm ?? 185;
  const target = hrTargetRangeForZone(step.zone, maxHr, profile?.lthrBpm ?? null);
  const description = step.description?.includes('bpm')
    ? step.description
    : `${step.description ? `${step.description} ` : ''}HR ${target.label}.`.trim();
  const next: WorkoutStep = {
    ...step,
    description,
    targetLabel: target.label,
  };
  if (target.minBpm != null) next.targetHrMinBpm = target.minBpm;
  if (target.maxBpm != null) next.targetHrMaxBpm = target.maxBpm;
  return next;
}

function hrZoneReference(maxHrBpm: number, lthrBpm: number | null | undefined): string {
  return [1, 2, 3, 4, 5]
    .map(zone => {
      const target = hrTargetRangeForZone(zone, maxHrBpm, lthrBpm ?? null);
      return `Z${zone} ${target.label}`;
    })
    .join(', ');
}

function buildDeterministicWorkoutSteps(
  workout: WorkoutStepWorkout,
  profile: WorkoutStepProfile | undefined,
): WorkoutStep[] {
  const duration = Math.max(5, workout.durationMin);
  const zone = Math.max(1, Math.min(5, workout.zone));
  let steps: WorkoutStep[];

  if (duration <= 20) {
    steps = [{ type: 'steady', durationMin: duration, zone, description: 'Kurze Aktivierung sauber und kontrolliert ausführen.' }];
  } else if (zone >= 4) {
    const warmup = Math.min(15, Math.max(8, Math.round(duration * 0.25)));
    const cooldown = Math.min(10, Math.max(5, Math.round(duration * 0.15)));
    const workBudget = Math.max(8, duration - warmup - cooldown);
    const reps = Math.max(2, Math.min(zone >= 5 ? 6 : 5, Math.floor(workBudget / (zone >= 5 ? 5 : 8))));
    const restMin = zone >= 5 ? 2 : 3;
    const intervalMin = Math.max(2, Math.floor((workBudget - restMin * (reps - 1)) / reps));
    steps = [
      { type: 'warmup', durationMin: warmup, zone: 1, description: 'Progressiv aufwaermen, locker starten.' },
      { type: 'interval', reps, durationMin: intervalMin, restMin, zone, description: `Qualitaetsblock in Z${zone}, Pausen wirklich locker.` },
      { type: 'cooldown', durationMin: cooldown, zone: 1, description: 'Ausschwingen und Puls beruhigen.' },
    ];
  } else {
    const warmup = duration >= 45 ? 10 : 5;
    const cooldown = duration >= 45 ? 10 : 5;
    steps = [
      { type: 'warmup', durationMin: warmup, zone: 1, description: 'Locker einrollen/einlaufen.' },
      { type: 'steady', durationMin: Math.max(5, duration - warmup - cooldown), zone, description: `Stabiler aerober Block in Z${zone}.` },
      { type: 'cooldown', durationMin: cooldown, zone: 1, description: 'Ruhig beenden.' },
    ];
  }

  return steps.map(step => supportsHrStepTargets(workout.activityType) ? addHrTargetToStep(step, profile) : step);
}

export async function buildWorkoutSteps(
  workout: WorkoutStepWorkout,
  profile: WorkoutStepProfile | undefined,
): Promise<{ steps: WorkoutStep[]; updatedDescription: string | null }> {
  const ftp = profile?.ftpWatts ?? 250;
  const maxHr = profile?.maxHrBpm ?? 185;

  const isRun = workout.activityType === 'run';
  const isBike = workout.activityType === 'bike';
  const intensityRef = supportsHrStepTargets(workout.activityType)
    ? `HR-first: ${hrZoneReference(maxHr, profile?.lthrBpm)}. FTP=${ftp}W nur als Sekundärkontrolle.`
    : isBike
    ? `FTP=${ftp}W als Sekundärinfo; wenn Pulsdaten fehlen: Z2 ${Math.round(ftp*0.56)}-${Math.round(ftp*0.75)}W, Z4 ${Math.round(ftp*0.90)}-${Math.round(ftp*1.05)}W.`
    : isRun
    ? `Max-HF=${maxHr}bpm, HR-first: ${hrZoneReference(maxHr, profile?.lthrBpm)}.`
    : `Technik/Bewegungsqualität; keine harte Zielzone erzwingen.`;

  const prompt = `Erstelle eine detaillierte Trainingsanleitung für dieses Workout:

Typ: ${workout.activityType} | Zone: ${workout.zone} | Dauer: ${workout.durationMin} min
Kurzbeschreibung: ${workout.description ?? '-'}
Athleten-Referenz: ${intensityRef}

Antworte NUR mit einem JSON-Objekt:
{
  "steps": [
    {"type":"warmup","durationMin":10,"zone":1,"description":"Beschreibung"},
    {"type":"interval","reps":4,"durationMin":8,"zone":4,"restMin":2,"description":"Ziel: X"},
    {"type":"cooldown","durationMin":10,"zone":1,"description":"Ausschwingen"}
  ],
  "coachingNote": "1-2 Sätze Coaching-Hinweis auf Deutsch"
}

Typen: warmup, interval, steady, cooldown. Zonen 1-5.
Gesamtdauer der steps muss ~${workout.durationMin} Minuten ergeben (inkl. Pausen).
Bei reinen Z2-Workouts: nur warmup + steady + cooldown, kein interval.
Bei Run/Bike/Hike: Beschreibungen müssen die HR-Zielrange nennen; Watt/Pace nur als Sekundärkontrolle.`;

  try {
    const raw = await llmComplete(
      'Du bist Sportwissenschaftler und Ausdauercoach. Antworte nur mit validem JSON.',
      prompt,
      SMART_MODEL,
    );

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('LLM returned no valid JSON for workout steps');

    const parsed = JSON.parse(jsonMatch[0]) as { steps: WorkoutStep[]; coachingNote?: string };
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error('LLM returned empty workout steps');
    }
    const steps: WorkoutStep[] = parsed.steps.map(s => {
      const step: WorkoutStep = {
        type: (['warmup','interval','rest','cooldown','steady'].includes(s.type) ? s.type : 'steady') as WorkoutStep['type'],
        durationMin: Math.max(1, s.durationMin ?? 10),
        zone: Math.max(1, Math.min(5, s.zone ?? workout.zone)),
      };
      if (s.reps != null) step.reps = s.reps;
      if (s.restMin != null) step.restMin = s.restMin;
      if (s.description) step.description = s.description;
      return supportsHrStepTargets(workout.activityType) ? addHrTargetToStep(step, profile) : step;
    });

    const coachingNote = parsed.coachingNote ?? null;
    const updatedDescription = coachingNote
      ? `${workout.description ?? ''}\n\n${coachingNote}`.trim()
      : workout.description;

    return { steps, updatedDescription };
  } catch {
    return {
      steps: buildDeterministicWorkoutSteps(workout, profile),
      updatedDescription: workout.description,
    };
  }
}
