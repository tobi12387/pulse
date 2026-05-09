import { llmComplete, SMART_MODEL } from '../../lib/llm.js';
import { hrTargetRangeForZone } from '@coaching-os/shared/pulse-thresholds';
import type { PulseGoalLimiter, PulsePlanLearningSnapshot, PulseSeasonStrategy, PulseTrainingExecutionReview } from '@coaching-os/shared/pulse';
import { trainingArchetypes, type TrainingArchetype } from './training-intelligence.js';

type Phase = 'base' | 'build' | 'peak' | 'taper';
type ActivityType = 'run' | 'bike' | 'swim' | 'strength';

export interface ActiveHealthState {
  type: 'illness' | 'injury' | 'fatigue' | 'travel';
  severity: 'mild' | 'moderate' | 'severe';
  bodyPart: string | null;
  startDate: string;     // YYYY-MM-DD
  endDate: string | null;
  notes: string | null;
}

interface WeekWorkout {
  plannedDate: string;
  activityType: ActivityType;
  zone: number;
  durationMin: number;
  targetTss: number;
  description: string;
  archetypeId?: string;
  variationReason?: string;
  adjustedReason?: string;     // non-null when modified by enforceHealthConstraints
}

type GoalCategory = 'race' | 'weight' | 'ftp' | 'vo2max' | 'volume' | string | null;

interface GoalLite {
  title: string;
  targetDate: string | null;
  category: GoalCategory;
  metrics?: Record<string, unknown> | null;
  raceDiscipline?: string | null;
  raceDistanceKm?: number | null;
  racePriority?: 'A' | 'B' | 'C' | null;
}

interface RiskSignalLite {
  ruleId: string;
  severity: 'info' | 'warn' | 'critical';
  title: string;
  recommendation: string;
}

interface RecentPlanActivity {
  date: string;
  activityType: string;
  durationMin: number;
  tss: number;
  rpe?: number | null;
  plannedZone?: number | null;
}

interface FuelingPlanHistoryInput {
  date: string;
  context?: string | null;
  activityType?: string | null;
  durationMin?: number | null;
  carbsG?: number | null;
  bottles750Ml?: number | null;
  powderG?: number | null;
  giComfort?: string | null;
  notes?: string | null;
}

interface RpePlanSafety {
  blockHard: boolean;
  reduceSessions: boolean;
  reasons: string[];
  summary: string | null;
  descriptionNote: string | null;
}

interface FuelingPlanSafety {
  reduceSessions: boolean;
  capLongEnduranceMin: number | null;
  summary: string | null;
  descriptionNote: string | null;
}

// ─── TSS / intensity helpers ──────────────────────────────────────────────────

// Intensity Factor per zone (fraction of FTP-equivalent effort)
const IF_BY_ZONE: Record<number, number> = {
  1: 0.55,
  2: 0.70,
  3: 0.82,
  4: 0.93,
  5: 1.08,
};

export function tssFromWorkout(durationMin: number, zone: number): number {
  const ef = IF_BY_ZONE[zone] ?? 0.70;
  return Math.round((durationMin / 60) * ef * ef * 100);
}

function inferZoneFromTss(durationMin: number, tss: number): number | null {
  if (durationMin <= 0 || tss <= 0) return null;
  const tssPerHour = tss / (durationMin / 60);
  if (tssPerHour < 35) return 1;
  if (tssPerHour < 70) return 2;
  if (tssPerHour < 92) return 3;
  if (tssPerHour < 120) return 4;
  return 5;
}

function summarizeRpeSafety(activities: RecentPlanActivity[] = []): RpePlanSafety {
  const rated = activities
    .filter((a): a is RecentPlanActivity & { rpe: number } => a.rpe != null)
    .slice(0, 8);
  if (rated.length === 0) {
    const longLoadOnly = activities.find(a => a.plannedZone == null && (a.durationMin >= 240 || a.tss >= 250));
    if (!longLoadOnly) {
      return { blockHard: false, reduceSessions: false, reasons: [], summary: null, descriptionNote: null };
    }
    const reason = `Lange reale Einheit: ${longLoadOnly.activityType} mit ${longLoadOnly.durationMin}min und TSS ${longLoadOnly.tss}; Folgewoche zuerst absorbieren.`;
    return {
      blockHard: true,
      reduceSessions: true,
      reasons: [reason],
      summary: reason,
      descriptionNote: 'lange reale Einheit zuletzt: Erholung schuetzen, keine direkte Wiederholung des langen Reizes.',
    };
  }

  const hardFeelingEasy = rated.find(a => {
    const zone = a.plannedZone ?? inferZoneFromTss(a.durationMin, a.tss);
    return zone != null && zone <= 2 && a.rpe >= 8;
  });
  const longOffPlanLoad = activities.find(a => a.plannedZone == null && (a.durationMin >= 240 || a.tss >= 250));
  const highRpeCount = rated.slice(0, 5).filter(a => a.rpe >= 8).length;
  const latest = rated[0]!;

  const reasons: string[] = [];
  if (longOffPlanLoad) {
    reasons.push(`Lange reale Einheit: ${longOffPlanLoad.activityType} mit ${longOffPlanLoad.durationMin}min und TSS ${longOffPlanLoad.tss}; Folgewoche zuerst absorbieren.`);
  }
  if (hardFeelingEasy) {
    reasons.push(`RPE-Signal: eine leichte ${hardFeelingEasy.activityType}-Einheit fühlte sich mit RPE ${hardFeelingEasy.rpe}/10 zu hart an.`);
  }
  if (highRpeCount >= 2) {
    reasons.push(`RPE-Signal: ${highRpeCount} der letzten ${Math.min(5, rated.length)} bewerteten Einheiten lagen bei RPE >= 8.`);
  }

  const blockHard = longOffPlanLoad != null || hardFeelingEasy != null || highRpeCount >= 2;
  const reduceSessions = blockHard || latest.rpe >= 9;
  const summary = reasons.length > 0
    ? reasons.join(' ')
    : `Letzte RPE-Bewertung: ${latest.activityType} am ${latest.date} mit RPE ${latest.rpe}/10.`;
  const descriptionNote = longOffPlanLoad
    ? 'lange reale Einheit zuletzt: Erholung schuetzen, keine direkte Wiederholung des langen Reizes.'
    : blockHard
    ? 'Subjektive Ermüdung zuletzt hoch: sauber aerob bleiben, keine Zusatzreize.'
    : null;

  return { blockHard, reduceSessions, reasons, summary, descriptionNote };
}

function fuelingCarbsPerHour(log: FuelingPlanHistoryInput): number | null {
  if (log.carbsG == null || log.durationMin == null || log.durationMin <= 0) return null;
  return Math.round(log.carbsG / (log.durationMin / 60));
}

function summarizeFuelingPlanSafety(history: FuelingPlanHistoryInput[] = []): FuelingPlanSafety {
  const relevant = history
    .filter(log => log.context === 'during' || log.context == null)
    .filter(log => (log.durationMin ?? 0) >= 180 || (log.carbsG ?? 0) > 0 || (log.powderG ?? 0) > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  const issue = relevant.find(log => log.giComfort === 'mild_issue' || log.giComfort === 'issue');
  if (!issue) {
    return { reduceSessions: false, capLongEnduranceMin: null, summary: null, descriptionNote: null };
  }

  const cph = fuelingCarbsPerHour(issue);
  const bottle = issue.bottles750Ml != null && issue.bottles750Ml > 0 ? `, ${issue.bottles750Ml}x750 ml` : '';
  const powder = issue.powderG != null && issue.powderG > 0 ? `, ${Math.round(issue.powderG)}g Pulver` : '';
  const summary = `Fueling-Toleranz: ${issue.date} ${issue.giComfort}${cph != null ? ` bei ${cph}g/h` : ''}${bottle}${powder}.`;
  return {
    reduceSessions: true,
    capLongEnduranceMin: 165,
    summary,
    descriptionNote: `${summary} Naechste lange Einheit kontrolliert verpflegen, frueh starten und keine maximale Langdistanz direkt wiederholen.`,
  };
}

function hasLearningFlag(learning: PulsePlanLearningSnapshot | null | undefined, flag: PulsePlanLearningSnapshot['flags'][number]): boolean {
  return learning?.flags.includes(flag) ?? false;
}

function hasExecutionSignal(review: PulseTrainingExecutionReview | null | undefined, signal: PulseTrainingExecutionReview['signals'][number]): boolean {
  return review?.signals.includes(signal) ?? false;
}

function executionReviewNeedsRecoveryProtection(review: PulseTrainingExecutionReview | null | undefined): boolean {
  return hasExecutionSignal(review, 'protect_recovery') || hasExecutionSignal(review, 'reduce_next_intensity');
}

function hardDayAvoidanceOffsets(
  learning: PulsePlanLearningSnapshot | null | undefined,
  review: PulseTrainingExecutionReview | null | undefined,
): Set<number> {
  return new Set([
    ...previousHardDayOffsets(learning),
    ...(review?.recommendedHardDayAvoidance ?? []),
  ]);
}

function dayOffsetFromWeekStart(weekStart: string, date: string): number | null {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  const current = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(current)) return null;
  const offset = Math.round((current - start) / 86_400_000);
  return offset >= 0 && offset <= 6 ? offset : null;
}

function previousHardDayOffsets(learning: PulsePlanLearningSnapshot | null | undefined): Set<number> {
  const previousWeek = learning?.previousWeek;
  if (!previousWeek) return new Set();
  return new Set(
    previousWeek.hardDays
      .map(day => dayOffsetFromWeekStart(previousWeek.weekStart, day.date))
      .filter((day): day is number => day != null),
  );
}

function hrTargetForZone(zone: number, maxHrBpm: number, lthrBpm?: number): string {
  return hrTargetRangeForZone(zone, maxHrBpm, lthrBpm).label;
}

function isEnduranceFuelingActivity(activityType: ActivityType): boolean {
  return activityType === 'bike' || activityType === 'run';
}

// ─── Mesocycle position ───────────────────────────────────────────────────────

// 3+1 periodization: weeks 1-3 progressive load, week 4 recovery
export function getMesocycleWeek(weekStart: string): 1 | 2 | 3 | 4 {
  const d = new Date(weekStart + 'T00:00:00Z');
  // ISO week number (1-53)
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const dayOfYear = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86_400_000);
  const weekNum = Math.ceil((dayOfYear + jan4.getUTCDay()) / 7);
  return (((weekNum - 1) % 4) + 1) as 1 | 2 | 3 | 4;
}

// ─── Weekly TSS target ────────────────────────────────────────────────────────

function computeWeeklyTssTarget(params: {
  ctl: number;
  tsb: number;
  weeklyHoursTarget: number;
  mesocycleWeek: 1 | 2 | 3 | 4;
  phase: Phase;
}): number {
  const { ctl, tsb, weeklyHoursTarget, mesocycleWeek, phase } = params;

  // Base: maintain current CTL (CTL * 7 = approximate weekly TSS to stay flat)
  const baseTss = Math.max(120, ctl * 7);

  // 3+1 mesocycle progression multipliers
  const mesoMult = (mesocycleWeek === 4)
    ? 0.65                                               // recovery week
    : ([1.00, 1.08, 1.16] as number[])[mesocycleWeek - 1] ?? 1.00; // progressive build

  // Phase modifier: taper = sharp reduction, peak = slight boost
  const phaseMult = { base: 1.00, build: 1.05, peak: 1.10, taper: 0.55 }[phase] ?? 1.00;

  // Fatigue gate: protect athlete when TSB is very negative
  const tsbMult = tsb < -25 ? 0.70 : tsb < -15 ? 0.85 : 1.00;

  // Ceiling: what's actually achievable in the available hours
  // Mixed training yields ~55-70 TSS/hour; use 63 as a realistic mean
  const hoursCap = weeklyHoursTarget * 63;

  const target = Math.round(baseTss * mesoMult * phaseMult * tsbMult);
  return Math.min(hoursCap, Math.max(80, Math.min(900, target)));
}

// ─── Sport rotation by phase ──────────────────────────────────────────────────

// Ordered template: for N available days, take the first N entries
const SPORT_ROTATION: Record<Phase, ActivityType[]> = {
  //         Primary sport (bike=aerobic base), quality run, strength, long run/ride...
  base:  ['bike', 'run',      'bike', 'strength', 'run',      'bike', 'run'],
  build: ['run',  'bike',     'run',  'bike',      'strength', 'run',  'bike'],
  peak:  ['run',  'bike',     'run',  'run',       'bike',     'run',  'bike'],
  taper: ['run',  'bike',     'run',  'bike',      'run',      'bike', 'run'],
};

interface GoalWorkoutProfile {
  label: string;
  rotation: ActivityType[];
  hardSequence: ActivityType[];
  longSequence: ActivityType[];
}

function primaryGoalDetail(goals: GoalLite[]): GoalLite | null {
  return goals.find(g => g.category === 'race')
    ?? goals[0]
    ?? null;
}

function goalWorkoutProfile(goals: GoalLite[], phase: Phase): GoalWorkoutProfile {
  const goal = primaryGoalDetail(goals);
  const category = goal?.category ?? null;
  const raceDiscipline = goal?.raceDiscipline ?? '';

  if (category === 'ftp') {
    return {
      label: 'FTP/Bike-Fokus',
      rotation: ['bike', 'bike', 'run', 'bike', 'strength', 'bike', 'run'],
      hardSequence: ['bike'],
      longSequence: ['bike', 'bike', 'run'],
    };
  }

  if (category === 'vo2max') {
    return {
      label: 'VO2max-Fokus',
      rotation: ['run', 'bike', 'run', 'bike', 'strength', 'run', 'bike'],
      hardSequence: ['run', 'bike'],
      longSequence: ['run', 'bike', 'run'],
    };
  }

  if (category === 'weight') {
    return {
      label: 'Gewichts-/Aerob-Fokus',
      rotation: ['bike', 'run', 'bike', 'run', 'bike', 'swim', 'run'],
      hardSequence: ['bike'],
      longSequence: ['bike', 'run', 'bike'],
    };
  }

  if (category === 'volume') {
    return {
      label: 'Volumen-Fokus',
      rotation: ['bike', 'run', 'bike', 'run', 'bike', 'run', 'bike'],
      hardSequence: ['run', 'bike'],
      longSequence: ['bike', 'run', 'bike'],
    };
  }

  if (category === 'race') {
    if (raceDiscipline.includes('triathlon')) {
      return {
        label: 'Triathlon-Race-Fokus',
        rotation: phase === 'taper'
          ? ['run', 'bike', 'swim', 'run', 'bike', 'swim', 'run']
          : ['swim', 'bike', 'run', 'bike', 'run', 'swim', 'bike'],
        hardSequence: ['bike', 'run'],
        longSequence: ['bike', 'run', 'swim'],
      };
    }
    if (raceDiscipline === 'bike') {
      return {
        label: 'Bike-Race-Fokus',
        rotation: ['bike', 'run', 'bike', 'strength', 'bike', 'bike', 'run'],
        hardSequence: ['bike'],
        longSequence: ['bike', 'bike', 'run'],
      };
    }
    if (raceDiscipline === 'swim') {
      return {
        label: 'Swim-Race-Fokus',
        rotation: ['swim', 'strength', 'swim', 'bike', 'swim', 'run', 'swim'],
        hardSequence: ['swim'],
        longSequence: ['swim', 'bike', 'run'],
      };
    }
    return {
      label: 'Run-Race-Fokus',
      rotation: ['run', 'bike', 'run', 'strength', 'run', 'bike', 'run'],
      hardSequence: ['run'],
      longSequence: ['run', 'bike', 'run'],
    };
  }

  return {
    label: `${phase}-Standard`,
    rotation: SPORT_ROTATION[phase],
    hardSequence: phase === 'peak' ? ['run', 'bike'] : ['run'],
    longSequence: ['bike', 'run', 'bike'],
  };
}

function rotationShiftForLearning(learning: PulsePlanLearningSnapshot | null | undefined): number {
  return hasLearningFlag(learning, 'repeated_sport_mix') ? 1 : 0;
}

function pickActivityType(
  profile: GoalWorkoutProfile,
  index: number,
  hardIndex: number | null,
  isLastSession: boolean,
  rotationShift = 0,
): ActivityType {
  if (hardIndex != null) return profile.hardSequence[hardIndex % profile.hardSequence.length]!;
  if (isLastSession) return profile.longSequence[index % profile.longSequence.length]!;
  return profile.rotation[(index + rotationShift) % profile.rotation.length]!;
}

// Base session duration (min) per sport per zone — used as sanity-check floor/ceiling
const BASE_DURATION: Record<ActivityType, Record<number, number>> = {
  run:      { 1: 40, 2: 60,  3: 65,  4: 55,  5: 45 },
  bike:     { 1: 70, 2: 100, 3: 90,  4: 75,  5: 60 },
  swim:     { 1: 45, 2: 55,  3: 50,  4: 45,  5: 40 },
  strength: { 1: 50, 2: 50,  3: 50,  4: 45,  5: 45 },
};

const ARCHETYPE_BY_ID = new Map(trainingArchetypes.map(archetype => [archetype.id, archetype]));

function archetypeForWorkout(workout: Pick<WeekWorkout, 'activityType' | 'zone' | 'durationMin'>): TrainingArchetype {
  const id = workout.activityType === 'strength'
    ? 'strength_support'
    : workout.zone <= 1
    ? 'recovery_spin'
    : workout.zone === 2 && workout.durationMin >= 150
    ? 'long_endurance'
    : workout.zone === 2
    ? 'endurance_steady'
    : workout.zone === 3
    ? workout.activityType === 'bike' && workout.durationMin >= 90
      ? 'gravel_specificity'
      : 'tempo_sustained'
    : workout.zone === 4
    ? 'threshold_intervals'
    : workout.durationMin <= 40
    ? 'anaerobic_sharpening'
    : 'vo2_repeats';

  return ARCHETYPE_BY_ID.get(id) ?? ARCHETYPE_BY_ID.get('endurance_steady')!;
}

function learningNeedsVariation(
  learning: PulsePlanLearningSnapshot | null | undefined,
  review: PulseTrainingExecutionReview | null | undefined,
): boolean {
  return hasLearningFlag(learning, 'repeated_sport_mix')
    || hasLearningFlag(learning, 'repeated_hard_pattern')
    || (review?.intents.includes('rotate') ?? false);
}

function variationReasonForWorkout(
  workout: WeekWorkout,
  learning: PulsePlanLearningSnapshot | null | undefined,
  review: PulseTrainingExecutionReview | null | undefined,
): string | null {
  if (!learningNeedsVariation(learning, review)) return null;
  if (workout.zone >= 4) {
    return 'gleicher Zielreiz, aber andere Struktur/Laenge statt identischem Wochenmuster.';
  }
  if (workout.durationMin >= 120 && workout.zone <= 2) {
    return 'langer aerober Block bleibt, Umfang und Fokus werden bewusst anders gesetzt.';
  }
  return 'leichter Baustein rotiert Sportart, Umfang oder Platzierung gegen Routine.';
}

function withTrainingIntentAnnotations(
  workouts: WeekWorkout[],
  ctx: {
    planLearning?: PulsePlanLearningSnapshot | null | undefined;
    executionReview?: PulseTrainingExecutionReview | null | undefined;
  },
): WeekWorkout[] {
  const needsVariation = learningNeedsVariation(ctx.planLearning, ctx.executionReview);
  return workouts.map((workout, index) => {
    const archetype = archetypeForWorkout(workout);
    const variationReason = variationReasonForWorkout(workout, ctx.planLearning, ctx.executionReview);
    let next: WeekWorkout = {
      ...workout,
      archetypeId: archetype.id,
    };
    if (variationReason) next.variationReason = variationReason;

    if (needsVariation) {
      const durationDelta = workout.zone >= 4
        ? -5
        : index === workouts.length - 1 && workout.zone <= 2
        ? 10
        : index % 2 === 0
        ? -5
        : 5;
      const lowerBound = workout.zone >= 4 ? 35 : workout.activityType === 'strength' ? 25 : 30;
      const upperBound = workout.zone <= 2 && index === workouts.length - 1 ? 180 : workout.activityType === 'strength' ? 55 : 120;
      next = tssRecompute({
        ...next,
        durationMin: Math.max(lowerBound, Math.min(upperBound, workout.durationMin + durationDelta)),
      });
    }

    return next;
  });
}

// ─── Hard-day selector ────────────────────────────────────────────────────────

// Polarized: ~20% of sessions are Z4-5, rest Z2.
// Rules: no hard day first session of the week, no consecutive hard days.
function selectHardDays(sortedDays: number[], hardCount: number, avoidDays = new Set<number>()): Set<number> {
  if (hardCount === 0) return new Set();

  const result = new Set<number>();
  // Skip the very first day (recovery from prior week)
  const candidates = sortedDays.slice(1);
  const orderedCandidates = [
    ...candidates.filter(day => !avoidDays.has(day)),
    ...candidates.filter(day => avoidDays.has(day)),
  ];

  for (const day of orderedCandidates) {
    if (result.size >= hardCount) break;
    // Ensure at least 1 easy day between hard sessions
    const lastHard = [...result].at(-1) ?? -99;
    if (day - lastHard > 1) result.add(day);
  }

  // If we couldn't find enough, relax the gap constraint
  if (result.size < hardCount && orderedCandidates.length > 0) {
    for (const day of orderedCandidates) {
      if (result.size >= hardCount) break;
      result.add(day);
    }
  }

  return result;
}

// ─── Candidate-day planning ─────────────────────────────────────────────────

export interface PlanDayDecision {
  selectedDays: number[];
  skippedAvailableDays: number[];
  targetSessionCount: number;
  primaryGoal: GoalCategory;
  reasons: string[];
}

function primaryGoal(goals: GoalLite[]): GoalCategory {
  return primaryGoalDetail(goals)?.category ?? null;
}

function scoreDayCombination(days: number[], phase: Phase, goal: GoalCategory): number {
  let score = 0;
  const sorted = [...days].sort((a, b) => a - b);

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]! - sorted[i - 1]!;
    score += gap >= 2 ? 6 : -8;
  }

  if (sorted.includes(5) || sorted.includes(6)) score += 4;
  if (phase === 'taper' && sorted.includes(6)) score -= 4;
  if (goal === 'weight') {
    if (sorted.includes(0)) score += 2;
    if (sorted.includes(6)) score += 2;
  }
  if (goal === 'race' && (sorted.includes(2) || sorted.includes(3))) score += 2;

  return score;
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [[]];
  if (items.length < size) return [];
  if (items.length === size) return [items];
  const [head, ...tail] = items;
  return [
    ...combinations(tail, size - 1).map(rest => [head!, ...rest]),
    ...combinations(tail, size),
  ];
}

export function decidePlanDays(params: {
  availableDays: number[];
  weeklyHoursTarget: number;
  tsb: number;
  phase: Phase;
  mesocycleWeek: 1 | 2 | 3 | 4;
  goals: GoalLite[];
  riskSignals?: RiskSignalLite[];
  recentActivities?: RecentPlanActivity[];
  fuelingHistory?: FuelingPlanHistoryInput[];
  planLearning?: PulsePlanLearningSnapshot | null | undefined;
  executionReview?: PulseTrainingExecutionReview | null | undefined;
  seasonStrategy?: PulseSeasonStrategy | null | undefined;
  goalLimiter?: PulseGoalLimiter | null | undefined;
}): PlanDayDecision {
  const available = [...new Set(params.availableDays)].sort((a, b) => a - b);
  const goal = primaryGoal(params.goals);
  const reasons: string[] = [];
  const rpeSafety = summarizeRpeSafety(params.recentActivities ?? []);
  const fuelingSafety = summarizeFuelingPlanSafety(params.fuelingHistory ?? []);

  let target = params.weeklyHoursTarget <= 3.5 ? 2
    : params.weeklyHoursTarget <= 5.5 ? 3
    : params.weeklyHoursTarget <= 8 ? 4
    : params.weeklyHoursTarget <= 11 ? 5
    : 6;

  if (goal === 'weight') {
    target = Math.min(target, params.weeklyHoursTarget <= 6 ? 3 : 4);
    reasons.push('Gewichtsziel: Konsistenz und Erholung vor maximaler Einheitendichte.');
  } else if (goal === 'ftp' || goal === 'vo2max') {
    target = Math.min(target, 4);
    reasons.push(`${goal.toUpperCase()}-Ziel: wenige, gezielte Reize statt viele Fülltage.`);
  } else if (goal === 'race') {
    target = Math.min(target + 1, 5);
    reasons.push('Race-Ziel: spezifischere Wochenstruktur mit Platz für Schlüsselreize.');
  }

  if (params.mesocycleWeek === 4) {
    target -= 1;
    reasons.push('Regenerationswoche: ein freier Tag mehr als Belastungswochen.');
  }
  if (params.tsb < -25) {
    target -= 2;
    reasons.push('TSB stark negativ: Trainingsfrequenz deutlich reduziert.');
  } else if (params.tsb < -12) {
    target -= 1;
    reasons.push('TSB negativ: ein verfügbarer Tag bleibt bewusst frei.');
  }
  if (params.phase === 'taper') {
    target = Math.min(target, 3);
    reasons.push('Taper: Frische hat Vorrang vor Volumen.');
  }

  if (rpeSafety.reduceSessions) {
    target -= 1;
    reasons.push(rpeSafety.reasons[0] ?? 'RPE-Signal: subjektive Belastung war zuletzt hoch; ein Trainingstag bleibt frei.');
  }

  if (fuelingSafety.reduceSessions) {
    target -= 1;
    reasons.push(`${fuelingSafety.summary} Ein verfügbarer Tag bleibt frei, damit der nächste lange Reiz als kontrollierte Fueling-Praxis geplant wird.`);
  }

  if (hasLearningFlag(params.planLearning, 'low_compliance') || hasLearningFlag(params.planLearning, 'low_completion')) {
    target -= 1;
    reasons.push('Lernsignal: niedrige Compliance/Completion der Vorwoche, deshalb eine Einheit weniger statt alle Tage zu füllen.');
  } else if (hasLearningFlag(params.planLearning, 'high_rpe_easy') && !rpeSafety.reduceSessions) {
    target -= 1;
    reasons.push('Lernsignal: lockere Einheiten fühlten sich zuletzt hart an; ein verfügbarer Tag bleibt frei.');
  }
  if (hasLearningFlag(params.planLearning, 'repeated_sport_mix')) {
    reasons.push('Lernsignal: Sportmix der letzten Wochen war gleich; leichte Einheiten werden bewusst rotiert, ohne die Dichte zu erhöhen.');
  }

  if (executionReviewNeedsRecoveryProtection(params.executionReview)) {
    target -= 1;
    reasons.push('Ausführung: Vorwochenbelastung spricht für mehr Erholung; deshalb eine Einheit weniger und harte Reize vorsichtiger platzieren.');
  } else if (hasExecutionSignal(params.executionReview, 'maintain_structure')) {
    reasons.push('Ausführung stabil: ähnliche Struktur ist bewusst gewählt, nicht ein Fallback.');
  }

  const criticalRisk = (params.riskSignals ?? []).find(r => r.severity === 'critical');
  const warnRisks = (params.riskSignals ?? []).filter(r => r.severity === 'warn');
  if (criticalRisk) {
    target = Math.min(target, 2);
    reasons.push(`Kritisches Risk-Signal (${criticalRisk.ruleId}): Trainingsdichte stark reduziert.`);
  } else if (warnRisks.length > 0) {
    target -= 1;
    reasons.push(`Risk-Watch Warnsignal: ein zusätzlicher verfügbarer Tag bleibt frei.`);
  }

  if (params.seasonStrategy) {
    const guardrails = params.seasonStrategy.guardrails;
    target = Math.min(target, guardrails.targetSessions);
    reasons.push(`Saisonlinie: ${guardrails.freeDayRationale}`);
    reasons.push(`Saisonlast: ${params.seasonStrategy.loadModel.currentWeek.kind} mit Ziel ${params.seasonStrategy.loadModel.currentWeek.targetHours}h / ${params.seasonStrategy.loadModel.currentWeek.targetTss} TSS.`);
    if (params.seasonStrategy.loadModel.warnings.length > 0) {
      reasons.push(`Saisonlast-Warnung: ${params.seasonStrategy.loadModel.warnings[0]}`);
    }
    if (guardrails.deload) {
      target = Math.min(target, Math.max(2, guardrails.targetSessions));
      reasons.push('Saisonlinie: Konsolidierungs-/Deload-Woche begrenzt die Trainingsdichte.');
    }
  }

  if (params.goalLimiter) {
    reasons.push(`Limiter: ${params.goalLimiter.label} — ${params.goalLimiter.planBias}.`);
  }

  const minSessions = available.length <= 1 ? available.length : 2;
  target = Math.min(available.length, Math.max(minSessions, target));

  const selectedDays = combinations(available, target)
    .sort((a, b) => scoreDayCombination(b, params.phase, goal) - scoreDayCombination(a, params.phase, goal))[0]
    ?? available;

  const skippedAvailableDays = available.filter(d => !selectedDays.includes(d));
  if (skippedAvailableDays.length > 0) {
    reasons.push(`${skippedAvailableDays.length} verfügbare Tag(e) bleiben als Reserve/Ruhetag frei.`);
  }

  return {
    selectedDays,
    skippedAvailableDays,
    targetSessionCount: selectedDays.length,
    primaryGoal: goal,
    reasons,
  };
}

// ─── Polarized week builder ───────────────────────────────────────────────────

function buildPolarizedWorkouts(params: {
  weekStart: string;
  availableDays: number[];
  phase: Phase;
  weeklyTss: number;
  weeklyHoursTarget: number;
  tsb: number;
  primaryGoal: GoalCategory;
  goals: GoalLite[];
  riskSignals?: RiskSignalLite[];
  recentActivities?: RecentPlanActivity[];
  fuelingHistory?: FuelingPlanHistoryInput[];
  planLearning?: PulsePlanLearningSnapshot | null | undefined;
  executionReview?: PulseTrainingExecutionReview | null | undefined;
  seasonStrategy?: PulseSeasonStrategy | null | undefined;
  goalLimiter?: PulseGoalLimiter | null | undefined;
}): WeekWorkout[] {
  const { weekStart, availableDays, phase, weeklyTss, weeklyHoursTarget, tsb, primaryGoal, goals, riskSignals = [] } = params;
  const sorted = [...availableDays].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return [];

  const profile = goalWorkoutProfile(goals, phase);
  const rpeSafety = summarizeRpeSafety(params.recentActivities ?? []);
  const fuelingSafety = summarizeFuelingPlanSafety(params.fuelingHistory ?? []);
  const rotationShift = rotationShiftForLearning(params.planLearning);

  // 80/20 polarization: ~22% of sessions are hard (Z4-5), 0 if very fatigued
  const hasBlockingRisk = riskSignals.some(r => r.severity === 'critical' || r.ruleId === 'rhr_drift_7d' || r.ruleId === 'hrv_trend_decline' || r.ruleId === 'sleep_debt_5d');
  const executionBlocksHard = executionReviewNeedsRecoveryProtection(params.executionReview);
  const baseHardCount = tsb < -20 || hasBlockingRisk || rpeSafety.blockHard || executionBlocksHard || (primaryGoal === 'weight' && tsb < 5) || primaryGoal === 'volume'
    ? 0
    : Math.min(primaryGoal === 'weight' ? 1 : 2, Math.max(1, Math.round(n * 0.22)));
  const hardCount = Math.min(baseHardCount, params.seasonStrategy?.guardrails.maxHardDays ?? baseHardCount);
  const hardDays = selectHardDays(sorted, hardCount, hardDayAvoidanceOffsets(params.planLearning, params.executionReview));

  const startDate = new Date(weekStart + 'T00:00:00Z');
  const workouts: WeekWorkout[] = [];
  let tssLeft = weeklyTss;
  let hardIndex = 0;

  for (let i = 0; i < n; i++) {
    const dayOffset = sorted[i]!;
    const remaining = n - i;
    const isHard = hardDays.has(dayOffset);
    let activityType = pickActivityType(profile, i, isHard ? hardIndex++ : null, i === n - 1, rotationShift);
    if (params.goalLimiter?.kind === 'long_endurance_fueling' && !isHard && i === n - 1) {
      activityType = 'bike';
    } else if (params.goalLimiter?.kind === 'threshold_vo2' && isHard) {
      activityType = 'bike';
    }

    // Zone: Z4 in base/build, Z5 for peak quality sessions, Z2 for easy days
    const zone = activityType === 'strength'
      ? 1
      : isHard
      ? (params.goalLimiter?.kind === 'threshold_vo2' ? 4 : phase === 'peak' ? 5 : 4)
      : 2;

    const ef = IF_BY_ZONE[zone] ?? 0.70;

    // Derive duration from TSS budget share
    const tssShare = Math.round(tssLeft / remaining);
    const derivedMin = Math.round((tssShare / (ef * ef * 100)) * 60);

    // Cross-check bounds
    const baseDur = BASE_DURATION[activityType]?.[zone] ?? 60;
    const maxMinPerDay = Math.round((weeklyHoursTarget * 60) / remaining * 1.4);

    const defaultMaxMin = activityType === 'strength' ? 50 : 180;
    const fuelingCap = fuelingSafety.capLongEnduranceMin != null && zone <= 2 && isEnduranceFuelingActivity(activityType)
      ? fuelingSafety.capLongEnduranceMin
      : defaultMaxMin;

    const durationMin = Math.max(
      20,
      Math.min(
        fuelingCap,
        Math.min(maxMinPerDay, isHard ? derivedMin : Math.max(derivedMin, Math.round(baseDur * 0.8))),
      ),
    );

    const tss = tssFromWorkout(durationMin, zone);
    tssLeft -= tss;

    const plannedDate = new Date(startDate);
    plannedDate.setUTCDate(startDate.getUTCDate() + dayOffset);

    workouts.push({
      plannedDate: plannedDate.toISOString().split('T')[0]!,
      activityType,
      zone,
      durationMin,
      targetTss: tss,
      description: '',
    });
  }

  return workouts;
}

// ─── Race-week taper enforcement ──────────────────────────────────────────────
// Even if the LLM doesn't fully respect the race prompt, this caps volume in race week.

interface RaceLite {
  date: string;
  daysUntil: number;
  priority: 'A'|'B'|'C';
  distanceKm: number | null;
}

export function applyRaceTaper(
  workouts: WeekWorkout[],
  races: RaceLite[],
  weekStart: string,
): WeekWorkout[] {
  if (races.length === 0) return workouts;

  return workouts.map((w): WeekWorkout => {
    // Find any race within 14d AFTER this workout date (forward-looking)
    const wDate = new Date(w.plannedDate + 'T00:00:00Z');
    const upcomingRace = races
      .filter(r => r.priority !== 'C')
      .map(r => ({ r, days: Math.round((new Date(r.date + 'T00:00:00Z').getTime() - wDate.getTime()) / 86_400_000) }))
      .filter(({ days }) => days >= 0)
      .sort((a, b) => a.days - b.days)[0];

    if (!upcomingRace) return w;
    const { r, days } = upcomingRace;

    // Race day itself: kein eigenes Training (race ist das Training)
    if (days === 0) return { ...w, durationMin: 0 };

    // Day before race: short opener with Z3 pickups (15-25min)
    if (days === 1) {
      return tssRecompute({
        ...w,
        zone: 2,
        durationMin: Math.min(20, w.durationMin),
        adjustedReason: 'race_taper',
      });
    }

    // Race week (≤6 days): cut volume in half, keep one moderate intensity day
    if (days <= 6) {
      const newDur = Math.round(w.durationMin * 0.5);
      const newZone = w.zone >= 4 ? 3 : w.zone;   // sharpen, not exhaust
      return tssRecompute({ ...w, zone: newZone, durationMin: newDur, adjustedReason: 'race_taper' });
    }

    // 7-14 days out (only A): mild taper
    if (r.priority === 'A' && days <= 14) {
      const newDur = Math.round(w.durationMin * 0.75);
      return tssRecompute({ ...w, durationMin: newDur, adjustedReason: 'race_taper' });
    }

    return w;
  }).filter(w => w.durationMin > 0);
}

// ─── Health-state constraint enforcement ──────────────────────────────────────

function dateInRange(date: string, start: string, end: string | null): boolean {
  if (date < start) return false;
  if (end != null && date > end) return false;
  return true;
}

function tssRecompute(w: WeekWorkout): WeekWorkout {
  return { ...w, targetTss: tssFromWorkout(w.durationMin, w.zone) };
}

function withHrFirstDescriptions(
  workouts: WeekWorkout[],
  ctx: {
    phase: Phase;
    maxHrBpm: number;
    lthrBpm?: number | undefined;
    goals: GoalLite[];
    rpeSafety: RpePlanSafety;
    fuelingSafety: FuelingPlanSafety;
    executionReview?: PulseTrainingExecutionReview | null | undefined;
    goalLimiter?: PulseGoalLimiter | null | undefined;
  },
): WeekWorkout[] {
  const profile = goalWorkoutProfile(ctx.goals, ctx.phase);
  return workouts.map((w): WeekWorkout => {
    const hr = hrTargetForZone(w.zone, ctx.maxHrBpm, ctx.lthrBpm);
    const goalPrefix = profile.label.endsWith('-Standard') ? '' : `${profile.label}: `;
    const archetype = (w.archetypeId ? ARCHETYPE_BY_ID.get(w.archetypeId) : null) ?? archetypeForWorkout(w);
    const archetypeText = `Archetyp ${archetype.label}: ${archetype.description}`;
    const variation = w.variationReason
      ? ` Variation zur Vorwoche: ${w.variationReason}`
      : '';
    const fueling = ctx.fuelingSafety.descriptionNote && w.zone <= 2 && isEnduranceFuelingActivity(w.activityType)
      ? ` ${ctx.fuelingSafety.descriptionNote}`
      : '';
    const safety = ctx.rpeSafety.descriptionNote
      ? ` ${ctx.rpeSafety.descriptionNote}`
      : '';
    const executionNote = executionReviewNeedsRecoveryProtection(ctx.executionReview)
      ? ' Ausführung der Vorwoche: Erholung schützen, Umfang und harte Reize konservativ halten.'
      : hasExecutionSignal(ctx.executionReview, 'maintain_structure')
      ? ' Ausführung stabil: ähnliche Struktur ist bewusst gewählt.'
      : '';
    const limiterNote = ctx.goalLimiter
      ? ` Limiter: ${ctx.goalLimiter.label} (${ctx.goalLimiter.planBias}).`
      : '';
    const purpose = w.zone >= 4
      ? 'Qualitätsreiz mit klaren Erholungsphasen'
      : w.zone === 3
      ? 'kontrollierter Tempo-/Schwellenübergang'
      : w.zone === 1
      ? 'Regeneration und Bewegungsqualität'
      : 'aerobe Grundlage und effiziente Fettstoffwechselarbeit';
    return {
      ...w,
      description: `${goalPrefix}${archetypeText} ${purpose}. ${w.durationMin} min in Z${w.zone}, primär über Puls steuern (${hr}); Watt nur als Sekundärkontrolle nutzen.${variation}${fueling}${safety}${executionNote}${limiterNote}`,
    };
  });
}

// Hard programmatic safety net AFTER LLM/heuristic generation.
// Applied even if the LLM ignores the prompt instructions.
export function enforceHealthConstraints(
  workouts: WeekWorkout[],
  states: ActiveHealthState[],
): WeekWorkout[] {
  if (states.length === 0) return workouts;

  return workouts.map((w): WeekWorkout => {
    const blocking = states.filter(s => dateInRange(w.plannedDate, s.startDate, s.endDate));
    if (blocking.length === 0) return w;

    let next: WeekWorkout = { ...w };

    for (const s of blocking) {
      // Illness: severe → full rest; moderate → max Z1, 30min; mild → max Z2, cap 60min
      if (s.type === 'illness') {
        if (s.severity === 'severe') {
          next = { ...next, zone: 1, durationMin: 0, adjustedReason: 'illness' };
        } else if (s.severity === 'moderate') {
          next = { ...next, zone: 1, durationMin: Math.min(next.durationMin, 30), adjustedReason: 'illness' };
        } else {
          next = { ...next, zone: Math.min(next.zone, 2), durationMin: Math.min(next.durationMin, 60), adjustedReason: 'illness' };
        }
      }
      // Injury: route around affected sport
      if (s.type === 'injury' && s.bodyPart) {
        const part = s.bodyPart.toLowerCase();
        const blocksRun  = /knee|foot|ankle|achilles|shin|calf|hamstring|hip/.test(part);
        const blocksBike = /knee_severe|hip_severe|wrist|hand|shoulder/.test(part);
        const blocksSwim = /shoulder|wrist|elbow/.test(part);

        if (blocksRun  && next.activityType === 'run')  next = { ...next, activityType: 'bike', adjustedReason: 'injury' };
        if (blocksBike && next.activityType === 'bike') next = { ...next, activityType: 'swim', adjustedReason: 'injury' };
        if (blocksSwim && next.activityType === 'swim') next = { ...next, activityType: 'bike', adjustedReason: 'injury' };

        // Severe injuries cap intensity regardless
        if (s.severity === 'severe') {
          next = { ...next, zone: Math.min(next.zone, 2), durationMin: Math.min(next.durationMin, 45) };
        }
      }
      // Fatigue: cap intensity, allow Z2 only
      if (s.type === 'fatigue') {
        const cap = s.severity === 'severe' ? { zone: 1, dur: 30 } :
                    s.severity === 'moderate' ? { zone: 2, dur: 60 } :
                    { zone: 2, dur: next.durationMin };
        next = { ...next, zone: Math.min(next.zone, cap.zone), durationMin: Math.min(next.durationMin, cap.dur), adjustedReason: 'fatigue' };
      }
      // Travel: keep intensity moderate, prefer running (no bike), shorter
      if (s.type === 'travel') {
        if (next.activityType === 'bike') next = { ...next, activityType: 'run' };
        next = { ...next, zone: Math.min(next.zone, 2), durationMin: Math.min(next.durationMin, 45), adjustedReason: 'travel' };
      }
    }

    return tssRecompute(next);
  }).filter(w => w.durationMin > 0);   // drop full-rest days
}

// ─── History aggregation ──────────────────────────────────────────────────────

interface WeekSummary {
  weekStart: string;
  totalTss: number;
  totalHours: number;
  sports: Partial<Record<string, { sessions: number; tss: number }>>;
}

function aggregateHistory(activities: Array<{
  date: string;
  activityType: string;
  durationMin: number;
  tss: number;
}>): WeekSummary[] {
  const map = new Map<string, WeekSummary>();

  for (const act of activities) {
    const d = new Date(act.date + 'T00:00:00Z');
    const dow = d.getUTCDay(); // 0=Sun
    const offset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + offset);
    const key = monday.toISOString().split('T')[0]!;

    if (!map.has(key)) map.set(key, { weekStart: key, totalTss: 0, totalHours: 0, sports: {} });
    const w = map.get(key)!;
    w.totalTss += act.tss;
    w.totalHours += act.durationMin / 60;
    const s = w.sports[act.activityType] ?? { sessions: 0, tss: 0 };
    s.sessions++;
    s.tss += act.tss;
    w.sports[act.activityType] = s;
  }

  return [...map.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// ─── LLM description enrichment ──────────────────────────────────────────────

async function enrichDescriptions(
  workouts: WeekWorkout[],
  ctx: {
    phase: Phase;
    mesocycleWeek: 1 | 2 | 3 | 4;
    weeklyTss: number;
    ctl: number;
    atl: number;
    tsb: number;
    ftpWatts: number;
    maxHrBpm: number;
    weekSummaries: WeekSummary[];
    goals: GoalLite[];
    recentFeedback?: Array<{ date: string; activityType: string; plannedZone: number; plannedDurationMin: number; feedback: string; complianceScore: number }> | undefined;
    recentActivities?: RecentPlanActivity[] | undefined;
    rpeSafety?: RpePlanSafety | undefined;
    planLearning?: PulsePlanLearningSnapshot | null | undefined;
    executionReview?: PulseTrainingExecutionReview | null | undefined;
    healthStates?: ActiveHealthState[] | undefined;
    lthrBpm?: number | undefined;
    races?: Array<{
      title: string;
      date: string;
      daysUntil: number;
      priority: 'A'|'B'|'C';
      discipline: string | null;
      distanceKm: number | null;
    }> | undefined;
  },
): Promise<WeekWorkout[]> {
  const phaseLabel = { base: 'Grundlagenaufbau', build: 'Aufbau', peak: 'Wettkampfvorbereitung', taper: 'Tapering' }[ctx.phase];
  const mesoLabel = ctx.mesocycleWeek === 4 ? 'Regenerationswoche (Woche 4)' : `Aufbauwoche ${ctx.mesocycleWeek}/3`;

  const historyStr = ctx.weekSummaries.slice(-6).map(w => {
    const sports = Object.entries(w.sports)
      .map(([s, d]) => `${s}×${d!.sessions}`)
      .join('+');
    return `${w.weekStart}: TSS=${w.totalTss.toFixed(0)}, ${w.totalHours.toFixed(1)}h (${sports})`;
  }).join('\n  ');

  const goalsStr = ctx.goals.length > 0
    ? ctx.goals.map(g => `${g.title}${g.targetDate ? ` bis ${g.targetDate}` : ''}`).join(', ')
    : 'keine';

  // HR-First zone reference (Friel's 7-zone model on LTHR if available, else MaxHR-fraction fallback)
  const lthr = ctx.lthrBpm ?? Math.round(ctx.maxHrBpm * 0.92);  // ~92% MaxHR ≈ LTHR estimate
  const hrZone = (loPct: number, hiPct: number) =>
    `${Math.round(lthr * loPct / 100)}–${Math.round(lthr * hiPct / 100)}bpm`;
  const zoneRef = [
    `Z1 <${hrZone(0, 81).split('–')[1]}`,
    `Z2 ${hrZone(82, 88)}`,
    `Z3 ${hrZone(89, 93)}`,
    `Z4 ${hrZone(94, 99)}`,
    `Z5 >${Math.round(lthr)}bpm`,
    `(LTHR: ${lthr}bpm, FTP: ${ctx.ftpWatts}W als Sekundärinfo)`,
  ].join(' | ');

  const workoutList = workouts
    .map((w, i) => `[${i}] ${w.plannedDate} | ${w.activityType.toUpperCase()} | Z${w.zone} | ${w.durationMin}min | TSS≈${w.targetTss} | Basis: ${w.description}`)
    .join('\n');

  const totalTss = workouts.reduce((s, w) => s + w.targetTss, 0);
  const hardCount = workouts.filter(w => w.zone >= 4).length;
  const easyPct = Math.round(((workouts.length - hardCount) / workouts.length) * 100);

  const feedbackStr = (ctx.recentFeedback ?? []).length > 0
    ? (ctx.recentFeedback ?? []).slice(-5).map(f =>
        `- ${f.date} ${f.activityType} Z${f.plannedZone} ${f.plannedDurationMin}min ` +
        `[Compliance ${Math.round(f.complianceScore * 100)}%]: ${f.feedback}`
      ).join('\n')
    : null;

  const rpeStr = (ctx.recentActivities ?? [])
    .filter(a => a.rpe != null)
    .slice(0, 5)
    .map(a => {
      const zone = a.plannedZone ?? inferZoneFromTss(a.durationMin, a.tss);
      return `- ${a.date} ${a.activityType}${zone != null ? ` Z${zone}` : ''}: RPE ${a.rpe}/10, ${a.durationMin}min, TSS ${a.tss}`;
    })
    .join('\n');

  const healthStr = (ctx.healthStates ?? []).length > 0
    ? (ctx.healthStates ?? []).map(s => {
        const range = `${s.startDate}${s.endDate ? `–${s.endDate}` : '+'}`;
        const part = s.bodyPart ? ` (${s.bodyPart})` : '';
        return `- ${range}: ${s.type}/${s.severity}${part}${s.notes ? ` — ${s.notes}` : ''}`;
      }).join('\n')
    : null;

  const learningStr = ctx.planLearning
    ? [
        ...ctx.planLearning.learnedFromLastWeek.map(item => `- gelernt: ${item}`),
        ...ctx.planLearning.variationComparedToLastWeek.map(item => `- Variation: ${item}`),
      ].slice(0, 6).join('\n')
    : null;

  const executionStr = ctx.executionReview
    ? [
        ...ctx.executionReview.learnedFromLastWeek.map(item => `- Ausführung: ${item}`),
        ...ctx.executionReview.variationComparedToLastWeek.map(item => `- Anpassung: ${item}`),
      ].slice(0, 6).join('\n')
    : null;

  const racesStr = (ctx.races ?? []).length > 0
    ? (ctx.races ?? []).slice(0, 3).map(r => {
        const dist = r.distanceKm ? ` ${r.distanceKm}km` : '';
        const wks = r.daysUntil >= 0 ? `in ${r.daysUntil}d` : `vor ${-r.daysUntil}d`;
        return `- ${r.date} (${wks}) — ${r.title}${dist}, ${r.discipline ?? '?'}, Priority ${r.priority}`;
      }).join('\n')
    : null;

  const prompt = `Du bist Sportwissenschaftler und Ausdauercoach. Schreibe präzise Trainingsbeschreibungen.

ATHLETEN-STATUS:
- Phase: ${phaseLabel}, ${mesoLabel}
- Fitness CTL=${ctx.ctl.toFixed(0)}, Ermüdung ATL=${ctx.atl.toFixed(0)}, Form TSB=${ctx.tsb.toFixed(0)}
- FTP: ${ctx.ftpWatts}W | Max-HF: ${ctx.maxHrBpm}bpm
- Ziele: ${goalsStr}

TRAININGSHISTORIE (letzte 6 Wochen):
  ${historyStr || 'keine Daten'}
${feedbackStr ? `\nWORKOUT-FEEDBACK (letzte Einheiten):\n${feedbackStr}\n` : ''}${healthStr ? `\nGESUNDHEITSSTATUS (HARTE Constraints — diese Daten sind verbindlich):\n${healthStr}\nRegeln: bei illness/severe = Ruhetag; illness/moderate = max Z1 30min; illness/mild = max Z2 60min; injury/* = passende Sportart vermeiden; fatigue = nur Z1–Z2.\n` : ''}${racesStr ? `\nRACES (Plan periodisiert dorthin):\n${racesStr}\nPriorities: A = Saisonhöhepunkt mit 2w Taper; B = wichtig mit 1w Taper; C = Mitnahme ohne Taper. In Race-Week (≤6d): Volumen halbieren, Intensität erhalten, Race-Pace-Workout 3-5d vor Race, Tag -1 = kurzer Aktivierungslauf 15-25min mit kurzen Z3-Pickups.\n` : ''}
${learningStr ? `\nPLAN-LERNEN (Vorwochenfeedback, verbindlich für Tonalität und Zusatzreize):\n${learningStr}\n` : ''}
${executionStr ? `\nAUSFÜHRUNGS-REVIEW (deterministische Anpassung, verbindlich):\n${executionStr}\n` : ''}
${rpeStr ? `\nRPE-SIGNATUR (subjektive Belastung, verbindlich für Zusatzreize):\n${rpeStr}\n${ctx.rpeSafety?.summary ? `Safety-Auswertung: ${ctx.rpeSafety.summary}\n` : ''}` : ''}
DIESE WOCHE: ${workouts.length} Einheiten | Ziel-TSS ${totalTss} | ${easyPct}% extensiv (polarisiertes Modell 80/20)
${workoutList}

Intensitätsbereiche (HR-First Steuerung): ${zoneRef}

Erstelle für jedes Workout eine 1-2-sätzige Beschreibung auf Deutsch:
- Z2/Z1-Workouts: Fokus auf Aerob-Effizienz, Fettstoffwechsel, Regeneration — HR-Range nennen
- Z4/Z5-Workouts: Konkrete HR-Zielintervalle, Intervalstruktur-Empfehlung, Trainingseffekt
- Berücksichtige den Wochenverlauf (Ermüdung akkumuliert)
- Berücksichtige das Workout-Feedback: Passe Umfang/Intensität an wenn nötig
- Steuerung primär über Puls; Watt nur als Sekundär-Info erwähnen wo sinnvoll
- Erhalte die HR-first Basis jeder Einheit; die Pulsrange darf nicht verschwinden
${ctx.tsb < -15 ? '- ACHTUNG: Hohe Ermüdung — betone Erholungscharakter, keine Zusatzreize\n' : ''}
Antworte NUR mit JSON-Array (gleiche Reihenfolge wie oben):
[{"index":0,"description":"..."}]`;

  const raw = await llmComplete(
    'Du bist Sportwissenschaftler. Antworte nur mit validem JSON-Array.',
    prompt,
    SMART_MODEL,
  );

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return workouts;

  const items = JSON.parse(jsonMatch[0]) as Array<{ index: number; description: string }>;
  return workouts.map((w, i) => ({
    ...w,
    description: items.find(it => it.index === i)?.description ?? w.description,
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ScientificPlanInput {
  weekStart: string;
  phase: Phase;
  weeklyHoursTarget: number;
  availableDays: number[];
  ctl: number;
  atl: number;
  tsb: number;
  ftpWatts: number;
  maxHrBpm: number;
  lthrBpm?: number | undefined;
  recentActivities: RecentPlanActivity[];
  fuelingHistory?: FuelingPlanHistoryInput[];
  goals: GoalLite[];
  riskSignals?: RiskSignalLite[];
  planLearning?: PulsePlanLearningSnapshot | null;
  executionReview?: PulseTrainingExecutionReview | null;
  seasonStrategy?: PulseSeasonStrategy | null;
  goalLimiter?: PulseGoalLimiter | null;
  recentFeedback?: Array<{
    date: string;
    activityType: string;
    plannedZone: number;
    plannedDurationMin: number;
    feedback: string;
    complianceScore: number;
  }>;
  healthStates?: ActiveHealthState[];
  races?: Array<{
    title: string;
    date: string;
    daysUntil: number;
    priority: 'A'|'B'|'C';
    discipline: string | null;
    distanceKm: number | null;
  }>;
}

export async function generateScientificWeekPlan(input: ScientificPlanInput): Promise<WeekWorkout[]> {
  const mesocycleWeek = getMesocycleWeek(input.weekStart);
  const phase = input.phase as Phase;

  const weeklyTss = computeWeeklyTssTarget({
    ctl: input.ctl,
    tsb: input.tsb,
    weeklyHoursTarget: input.weeklyHoursTarget,
    mesocycleWeek,
    phase,
  });

  const dayDecision = decidePlanDays({
    availableDays: input.availableDays,
    weeklyHoursTarget: input.weeklyHoursTarget,
    tsb: input.tsb,
    phase,
    mesocycleWeek,
    goals: input.goals,
    riskSignals: input.riskSignals ?? [],
    recentActivities: input.recentActivities,
    fuelingHistory: input.fuelingHistory ?? [],
    planLearning: input.planLearning,
    executionReview: input.executionReview,
    seasonStrategy: input.seasonStrategy,
    goalLimiter: input.goalLimiter,
  });

  const rawWorkouts = buildPolarizedWorkouts({
    weekStart: input.weekStart,
    availableDays: dayDecision.selectedDays,
    phase,
    weeklyTss,
    weeklyHoursTarget: input.weeklyHoursTarget,
    tsb: input.tsb,
    primaryGoal: dayDecision.primaryGoal,
    goals: input.goals,
    riskSignals: input.riskSignals ?? [],
    recentActivities: input.recentActivities,
    fuelingHistory: input.fuelingHistory ?? [],
    planLearning: input.planLearning,
    executionReview: input.executionReview,
    seasonStrategy: input.seasonStrategy,
    goalLimiter: input.goalLimiter,
  });

  // HARD constraints: filter/cap workouts based on active health states
  let workouts = enforceHealthConstraints(rawWorkouts, input.healthStates ?? []);

  // Race-week tapering (programmatic safety net even if LLM ignores prompt)
  workouts = applyRaceTaper(workouts, input.races ?? [], input.weekStart);

  workouts = withTrainingIntentAnnotations(workouts, {
    planLearning: input.planLearning,
    executionReview: input.executionReview,
  });

  const rpeSafety = summarizeRpeSafety(input.recentActivities);
  const fuelingSafety = summarizeFuelingPlanSafety(input.fuelingHistory ?? []);
  workouts = withHrFirstDescriptions(workouts, {
    phase,
    maxHrBpm: input.maxHrBpm,
    lthrBpm: input.lthrBpm,
    goals: input.goals,
    rpeSafety,
    fuelingSafety,
    executionReview: input.executionReview,
    goalLimiter: input.goalLimiter,
  });

  if (workouts.length === 0) return [];

  const weekSummaries = aggregateHistory(input.recentActivities);

  try {
    return await enrichDescriptions(workouts, {
      phase,
      mesocycleWeek,
      weeklyTss,
      ctl: input.ctl,
      atl: input.atl,
      tsb: input.tsb,
      ftpWatts: input.ftpWatts,
      maxHrBpm: input.maxHrBpm,
      weekSummaries,
      goals: input.goals,
      recentFeedback: input.recentFeedback,
      healthStates: input.healthStates,
      lthrBpm: input.lthrBpm,
      races: input.races,
      recentActivities: input.recentActivities,
      rpeSafety,
      planLearning: input.planLearning,
      executionReview: input.executionReview,
    });
  } catch (err) {
    // Keep deterministic HR-first descriptions if LLM enrichment fails.
    return workouts;
  }
}

// ─── Simple template fallback (last resort if DB/LLM both fail) ──────────────

const PHASE_TEMPLATES: Record<Phase, Array<{ activityType: ActivityType; zone: number; durationMin: number; description: string }>> = {
  base: [
    { activityType: 'bike',     zone: 2, durationMin: 90, description: 'Z2-Ausfahrt — Grundlagenausdauer' },
    { activityType: 'run',      zone: 2, durationMin: 60, description: 'Lockerer Z2-Lauf' },
    { activityType: 'run',      zone: 4, durationMin: 55, description: 'Schwellenintervalle' },
    { activityType: 'strength', zone: 1, durationMin: 45, description: 'Kraft & Stabilität' },
  ],
  build: [
    { activityType: 'run',  zone: 4, durationMin: 60,  description: 'Schwellenintervalle 4×10min' },
    { activityType: 'bike', zone: 2, durationMin: 120, description: 'Langer Z2-Block' },
    { activityType: 'run',  zone: 5, durationMin: 50,  description: 'VO2max-Intervalle' },
    { activityType: 'bike', zone: 2, durationMin: 75,  description: 'Z2-Ausfahrt' },
  ],
  peak: [
    { activityType: 'run',  zone: 5, durationMin: 45, description: 'VO2max-Intervalle 6×4min' },
    { activityType: 'bike', zone: 4, durationMin: 75, description: 'Renn-Simulation' },
    { activityType: 'run',  zone: 2, durationMin: 40, description: 'Aktivierungslauf' },
  ],
  taper: [
    { activityType: 'run',  zone: 2, durationMin: 30, description: 'Lockeres Eintrotteln' },
    { activityType: 'bike', zone: 2, durationMin: 45, description: 'Lockere Aktivierung' },
    { activityType: 'run',  zone: 4, durationMin: 20, description: 'Kurze Aktivierungsintervalle' },
  ],
};

export function generateWeekWorkouts(params: {
  weekStart: string;
  phase: string;
  weeklyHoursTarget: number;
  availableDays: number[];
}): WeekWorkout[] {
  const phase = (params.phase as Phase) ?? 'base';
  const templates = PHASE_TEMPLATES[phase];
  const sorted = [...params.availableDays].sort((a, b) => a - b);
  const n = Math.min(sorted.length, templates.length);
  const totalMin = params.weeklyHoursTarget * 60;
  const selectedTemplates = templates.slice(0, n);
  const templateTotal = selectedTemplates.reduce((s, t) => s + t.durationMin, 0);
  const scale = totalMin / templateTotal;
  const startDate = new Date(params.weekStart + 'T00:00:00Z');

  return selectedTemplates.map((t, i) => {
    const durationMin = Math.round(t.durationMin * scale);
    const plannedDate = new Date(startDate);
    plannedDate.setUTCDate(startDate.getUTCDate() + sorted[i]!);
    return {
      plannedDate: plannedDate.toISOString().split('T')[0]!,
      activityType: t.activityType,
      zone: t.zone,
      durationMin,
      targetTss: tssFromWorkout(durationMin, t.zone),
      description: t.description,
    };
  });
}

export function adaptIntensityForReadiness(
  workout: { durationMin: number; zone: number },
  readiness: number,
): { durationMin: number; zone: number } {
  if (readiness >= 65) return workout;
  if (readiness < 35) return { durationMin: Math.round(workout.durationMin * 0.5), zone: Math.max(1, workout.zone - 2) };
  return { durationMin: Math.round(workout.durationMin * 0.7), zone: Math.min(workout.zone, 3) };
}
