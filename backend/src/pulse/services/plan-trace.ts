import type { PulseFitnessLoad, PulsePlanDecision, PulsePlanLearningSnapshot, PulsePlanTrace } from '@coaching-os/shared/pulse';

type SportMix = Record<string, PulsePlanTrace['sportMix'][string]>;

export interface PlanTraceWorkout {
  plannedDate: string;
  activityType: string;
  zone: number;
  durationMin: number;
  targetTss: number | null;
}

export interface PlanTraceRecentActivity {
  date: string;
  activityType: string;
  durationMin: number;
  tss: number;
  rpe: number | null;
  plannedZone: number | null;
}

export interface PlanTraceGoal {
  title: string;
  targetDate: string | null;
  category: string | null;
  raceDiscipline: string | null;
  raceDistanceKm: number | null;
  racePriority: string | null;
}

export interface PlanTraceRiskSignal {
  ruleId: string;
  severity: string;
  title: string;
}

export interface PlanTraceHealthState {
  type: string;
  severity: string;
  bodyPart: string | null;
  startDate: string;
  endDate: string | null;
}

export interface BuildPlanTraceInput {
  weekStart: string;
  phase: string;
  mesocycleWeek: number;
  weeklyHoursTarget: number;
  availableDays: number[];
  load: PulseFitnessLoad;
  profile: {
    ftpWatts: number | null;
    maxHrBpm: number | null;
    lthrBpm: number | null;
  };
  goals: PlanTraceGoal[];
  riskSignals: PlanTraceRiskSignal[];
  healthStates: PlanTraceHealthState[];
  recentActivities: PlanTraceRecentActivity[];
  planLearning?: PulsePlanLearningSnapshot | null;
  planDecision: PulsePlanDecision;
  workouts: PlanTraceWorkout[];
}

export interface PlanTracePayload {
  inputSnapshot: PulsePlanTrace['inputSnapshot'];
  planDecision: PulsePlanDecision;
  sportMix: PulsePlanTrace['sportMix'];
  hardDays: PulsePlanTrace['hardDays'];
  generatedSummary: string[];
}

function addSportMixEntry(mix: SportMix, activityType: string, durationMin: number, targetTss: number): void {
  const current = mix[activityType] ?? { sessions: 0, totalMinutes: 0, totalTss: 0 };
  mix[activityType] = {
    sessions: current.sessions + 1,
    totalMinutes: current.totalMinutes + durationMin,
    totalTss: Math.round((current.totalTss + targetTss) * 10) / 10,
  };
}

export function buildSportMix(items: Array<{ activityType: string; durationMin: number; targetTss?: number | null; tss?: number | null }>): SportMix {
  const mix: SportMix = {};
  for (const item of items) {
    addSportMixEntry(mix, item.activityType, item.durationMin, item.targetTss ?? item.tss ?? 0);
  }
  return mix;
}

function summarizeTrace(
  input: BuildPlanTraceInput,
  sportMix: SportMix,
  hardDays: PulsePlanTrace['hardDays'],
  learningSnapshot: PulsePlanLearningSnapshot | null,
): string[] {
  const summary: string[] = [];
  const goal = input.goals[0] ?? null;
  if (goal) {
    summary.push(`Ziel-Fokus: ${goal.title}${goal.category ? ` (${goal.category})` : ''}.`);
  } else {
    summary.push('Kein aktives Ziel hinterlegt; Plan nutzt Basis-Periodisierung.');
  }

  summary.push(`Form: CTL ${input.load.ctl.toFixed(1)}, TSB ${input.load.tsb.toFixed(1)}, Phase ${input.phase}.`);

  if (input.planDecision.skippedAvailableDays.length > 0) {
    summary.push(`${input.planDecision.skippedAvailableDays.length} verfügbare Tag(e) bleiben bewusst frei.`);
  }

  if (hardDays.length > 0) {
    summary.push(`${hardDays.length} harte Einheit(en) ab Z4: ${hardDays.map(day => `${day.activityType} ${day.date}`).join(', ')}.`);
  }

  const sports = Object.entries(sportMix)
    .map(([sport, mix]) => `${sport}×${mix.sessions}`)
    .join(', ');
  if (sports) summary.push(`Sportmix: ${sports}.`);

  if (learningSnapshot?.learnedFromLastWeek[0]) {
    summary.push(`Gelernt: ${learningSnapshot.learnedFromLastWeek[0]}`);
  }
  if (learningSnapshot?.variationComparedToLastWeek[0]) {
    summary.push(`Variation: ${learningSnapshot.variationComparedToLastWeek[0]}`);
  }

  return summary;
}

function dayOffsetFromWeekStart(weekStart: string, date: string): number | null {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  const current = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(current)) return null;
  const offset = Math.round((current - start) / 86_400_000);
  return offset >= 0 && offset <= 6 ? offset : null;
}

function summarizePlanVariation(params: {
  previousWeek: PulsePlanLearningSnapshot['previousWeek'];
  currentSportMix: SportMix;
  currentHardDays: PulsePlanTrace['hardDays'];
  currentWeekStart: string;
}): string[] {
  const { previousWeek, currentSportMix, currentHardDays, currentWeekStart } = params;
  if (!previousWeek) return ['Keine Vorwoche als Vergleich vorhanden.'];

  const messages: string[] = [];
  const previousSports = Object.keys(previousWeek.sportMix).sort();
  const currentSports = Object.keys(currentSportMix).sort();
  const addedSports = currentSports.filter(sport => !previousSports.includes(sport));
  const removedSports = previousSports.filter(sport => !currentSports.includes(sport));

  if (addedSports.length > 0) messages.push(`Neuer Reiz: ${addedSports.join(', ')} ergänzt.`);
  if (removedSports.length > 0) messages.push(`Sportmix reduziert: ${removedSports.join(', ')} pausiert.`);

  const previousOffsets = previousWeek.hardDays
    .map(day => dayOffsetFromWeekStart(previousWeek.weekStart, day.date))
    .filter((day): day is number => day != null)
    .join(',');
  const currentOffsets = currentHardDays
    .map(day => dayOffsetFromWeekStart(currentWeekStart, day.date))
    .filter((day): day is number => day != null)
    .join(',');

  if (previousWeek.hardDays.length > 0 || currentHardDays.length > 0) {
    if (previousOffsets && currentOffsets && previousOffsets !== currentOffsets) {
      messages.push('Harte Tage gegenüber der Vorwoche versetzt.');
    } else if (previousWeek.hardDays.length > 0 && currentHardDays.length === 0) {
      messages.push('Keine harten Tage, weil Feedback/Erholung Vorrang hat.');
    } else if (previousOffsets === currentOffsets && currentOffsets) {
      messages.push('Harte Tage bleiben ähnlich, weil verfügbare Tage eng sind.');
    }
  }

  const previousSessions = previousWeek.plannedSessions;
  const currentSessions = Object.values(currentSportMix).reduce((sum, mix) => sum + mix.sessions, 0);
  if (previousSessions > 0 && currentSessions !== previousSessions) {
    messages.push(`${currentSessions} statt ${previousSessions} geplante Einheit(en).`);
  }

  return messages.length > 0 ? messages.slice(0, 4) : ['Sportmix und Belastung bewusst ähnlich gehalten.'];
}

export function buildPlanTrace(input: BuildPlanTraceInput): PlanTracePayload {
  const sportMix = buildSportMix(input.workouts);
  const recentSportMix = buildSportMix(input.recentActivities);
  const hardDays = input.workouts
    .filter(workout => workout.zone >= 4)
    .map(workout => ({
      date: workout.plannedDate,
      activityType: workout.activityType,
      zone: workout.zone,
      durationMin: workout.durationMin,
    }));
  const rpeReasons = input.planDecision.reasons.filter(reason => reason.toLowerCase().includes('rpe'));
  const learningSnapshot = input.planLearning
    ? {
        ...input.planLearning,
        variationComparedToLastWeek: summarizePlanVariation({
          previousWeek: input.planLearning.previousWeek,
          currentSportMix: sportMix,
          currentHardDays: hardDays,
          currentWeekStart: input.weekStart,
        }),
      }
    : null;
  const recentRpe = input.recentActivities
    .filter((activity): activity is PlanTraceRecentActivity & { rpe: number } => activity.rpe != null)
    .slice(0, 5)
    .map(activity => ({
      date: activity.date,
      activityType: activity.activityType,
      plannedZone: activity.plannedZone,
      rpe: activity.rpe,
      durationMin: activity.durationMin,
      tss: activity.tss,
    }));
  const dataWarnings: string[] = [];
  if (input.goals.length === 0) dataWarnings.push('Kein aktives Ziel hinterlegt.');
  if (input.profile.maxHrBpm == null) dataWarnings.push('MaxHF fehlt; HR-Zonen nutzen Fallback.');
  if (input.recentActivities.length === 0) dataWarnings.push('Keine Aktivitätshistorie der letzten 42 Tage.');
  if (recentRpe.length === 0) dataWarnings.push('Keine RPE-Bewertungen in den jüngsten Aktivitäten.');

  return {
    inputSnapshot: {
      phase: input.phase,
      mesocycleWeek: input.mesocycleWeek,
      weeklyHoursTarget: input.weeklyHoursTarget,
      availableDays: input.availableDays,
      load: input.load,
      profile: input.profile,
      goals: input.goals,
      riskSignals: input.riskSignals,
      healthStates: input.healthStates,
      recentRpe,
      rpeReasons,
      dataWarnings,
      recentSportMix,
      learningSnapshot,
    },
    planDecision: input.planDecision,
    sportMix,
    hardDays,
    generatedSummary: summarizeTrace(input, sportMix, hardDays, learningSnapshot),
  };
}
