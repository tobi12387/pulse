import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  useCheckinHistory, useCheckinToday,
  usePulseActivities, usePulsePlan, usePulseGoals,
  useUpdateWorkout, usePulseReview, useGenerateReview, useGeneratePlan,
  usePlanRefreshPreview, usePlanScenarioPreview, usePlanTrace, useStrengthSessions, useTrainingAnalytics, useWeekAvailability, useSaveAvailability, useRaceCommand, useSeasonStrategy, useCreateWorkout,
  useGoalProjection,
  useTodayOptions, useFitnessLoad, useAdaptationEvents,
} from '@/pulse/hooks';
import { LineChart } from '@/components/SparkChart';
import { Skeleton } from '@/components/Skeleton';
import { GarminExecutionTrustPanel } from '@/components/GarminExecutionTrustPanel';
import { StrengthLogger } from '@/components/StrengthLogger';
import { TodayOptionsCard } from '@/components/TodayOptionsCard';
import { WorkoutDetailModal } from '@/components/WorkoutDetailModal';
import { PageHeader, RangeControl, SegmentedControl } from '@/components/PulseChrome';
import { InlineFeedback } from '@/components/Feedback';
import { errorMessage } from '@/components/feedback-utils';
import { coachPromptPath } from '@/pulse/coach-link';
import { PlanChangeInboxCard } from '@/features/plan/PlanChangeInboxCard';
import { buildPlanChangeInbox } from '@/features/plan/change-inbox-model';
import {
  buildPlanAlternative,
  executionStatusFor,
  getMonday,
  getMondays,
  getNextOpenWorkout,
  isoDate,
  isoDateLocal,
  nextAvailableDateAfter,
  roundToFive,
  weekStartForDate,
  type PlanAlternativeId,
} from '@/features/plan/plan-utils';
import { GoalCard, GoalForm } from '@/features/plan/goals/goal-components';
import { AdaptiveSeasonContractCard, PlanDecisionCard, PlanTraceCard, RaceCommandCard, SeasonStrategyCard } from '@/features/plan/strategy/strategy-components';
import { PlanLimiterWorkoutSummary, WeekStrip, WorkoutRow } from '@/features/plan/training/training-components';
import { DAY_SHORT } from '@/features/plan/training/training-copy';
import { ACTIVITY_LABEL, workoutArchetypeCopy } from '@/pulse/activity-labels';
import { mentalImpact } from '@/features/mental/mental-impact';
import { TrainingCapabilityCard } from '@/features/training/TrainingCapabilityCard';
import type { PulseActivityType, PulseAdaptationEvent, PulseFitnessLoad, PulsePlanRefreshPreview, PulsePlanScenarioPreview, PulsePlanScenarioRequest, PulsePlanTrace, PulsePlannedWorkout, PulseStrengthSession, PulseStrengthTrendPoint, PulseTodayOptionsResponse } from '@coaching-os/shared/pulse';

type Tab = 'training' | 'ausfuehrung' | 'ziele' | 'review' | 'statistik';

function fmt(v: number | null | undefined, decimals = 1, suffix = ''): string {
  return v == null ? '–' : `${v.toFixed(decimals)}${suffix}`;
}

function translucent(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton height={10} width="35%" />
          <Skeleton height={16} width="70%" />
          <Skeleton height={12} width="50%" />
        </div>
      ))}
    </div>
  );
}

type PlannedWorkout = PulsePlannedWorkout;
type SourceChip = { label: string; targetPath?: string };
const CUSTOM_ACTIVITY_TYPES: PulseActivityType[] = ['bike', 'run', 'hike', 'swim', 'strength', 'other'];
type ScenarioPreviewMode = 'tour' | 'move' | 'reduce' | 'availability';
type AdaptationScenarioMode = Extract<ScenarioPreviewMode, 'move' | 'reduce'>;

type GarminSyncOutcome = {
  status: 'skipped' | 'synced' | 'failed' | 'unchanged' | 'removed';
  error?: string;
};

type PlanMutationNotice = {
  title: string;
  message: string;
  tone: 'warning' | 'info' | 'error';
};

type PlanAdaptationSignal = {
  id: string;
  title: string;
  detail: string;
  color: string;
};

type GarminSyncDebtSummary = {
  futureCount: number;
  deviceWindowDays: number;
  deviceWindowDebt: number;
  localOnly: number;
  templateOnly: number;
  degraded: number;
  blocked: number;
};

type PlanAlternativeOption = {
  id: PlanAlternativeId;
  label: string;
  detail: string;
  levelEffect?: string;
  recommended?: boolean;
  recommendationReason?: string;
};

const FIT_DECISION_META: Record<NonNullable<PlannedWorkout['capabilityFit']>, {
  label: string;
  tone: string;
  nextAction: string;
  recommendation: string | null;
  recommendedAlternative: PlanAlternativeId | null;
}> = {
  recovery: {
    label: 'Recovery',
    tone: 'var(--green)',
    nextAction: 'Sehr leicht. Ausführen, wenn Bewegung dich frischer macht.',
    recommendation: null,
    recommendedAlternative: null,
  },
  maintenance: {
    label: 'Machbar',
    tone: 'var(--green)',
    nextAction: 'Machbar, eher Erhaltung oder Technik als echter Fortschritt.',
    recommendation: null,
    recommendedAlternative: null,
  },
  productive: {
    label: 'Produktiv',
    tone: 'var(--green)',
    nextAction: 'Guter Fortschrittsreiz, wenn Warm-up und Fueling passen.',
    recommendation: null,
    recommendedAlternative: null,
  },
  stretch: {
    label: 'Stretch',
    tone: 'var(--amber)',
    nextAction: 'Kontrollieren: nur mit guter Tagesform, sauberem Warm-up und ausreichend Fueling.',
    recommendation: 'Athlete-Level: Stretch kontrollieren',
    recommendedAlternative: 'shorter',
  },
  too_hard_today: {
    label: 'Zu hart heute',
    tone: 'var(--rose)',
    nextAction: 'Heute besser entschärfen, verschieben oder bewusst frei lassen.',
    recommendation: 'Athlete-Level: zu hart heute',
    recommendedAlternative: 'easier',
  },
};

function athleteLevelSummary(workout: PlannedWorkout): {
  label: string;
  tone: string;
  workoutLevel: string | null;
  nextAction: string;
} | null {
  if (!workout.capabilityFit && workout.difficultyLevel == null) return null;
  const meta = workout.capabilityFit ? FIT_DECISION_META[workout.capabilityFit] : null;
  return {
    label: meta?.label ?? 'Noch nicht bewertet',
    tone: meta?.tone ?? 'var(--text-3)',
    workoutLevel: workout.difficultyLevel != null ? `Workout-Level ${workout.difficultyLevel.toFixed(1)}` : null,
    nextAction: meta?.nextAction ?? 'Noch keine belastbare Level-Einschätzung. Erst Ausführung und Feedback sammeln.',
  };
}

function garminSyncNotice(outcome: GarminSyncOutcome | null | undefined, savedMessage: string): PlanMutationNotice | null {
  if (outcome?.status !== 'failed') return null;
  const detail = outcome.error ? `: ${outcome.error}` : '.';
  return {
    title: 'Garmin-Sync offen',
    message: `${savedMessage}, aber Garmin wurde nicht aktualisiert${detail} Später im Workout oder in Settings erneut synchronisieren.`,
    tone: 'warning',
  };
}

function activityTypeFromParam(value: string | null): PulseActivityType {
  return CUSTOM_ACTIVITY_TYPES.includes(value as PulseActivityType) ? value as PulseActivityType : 'bike';
}

function numberFromParam(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value ?? '');
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function buildPlanAdaptationSignals(
  workouts: PlannedWorkout[],
  planTrace: PulsePlanTrace | null,
  today: string,
): PlanAdaptationSignal[] {
  const signals: PlanAdaptationSignal[] = [];
  const divergentWorkouts = workouts
    .filter(workout => workout.plannedDate <= today && workout.status !== 'completed')
    .filter(workout => ['missed', 'replaced_or_off_plan'].includes(executionStatusFor(workout)))
    .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate));

  const missed = divergentWorkouts.filter(workout => executionStatusFor(workout) === 'missed');
  const replaced = divergentWorkouts.filter(workout => executionStatusFor(workout) === 'replaced_or_off_plan');
  if (missed.length > 0) {
    signals.push({
      id: 'missed',
      title: 'Verpasste Einheit',
      detail: `${missed.length} geplante Einheit(en) ohne passende Garmin-Ausführung. Prüfe, ob Umfang oder Timing angepasst werden sollten.`,
      color: 'var(--rose)',
    });
  }
  if (replaced.length > 0) {
    signals.push({
      id: 'replaced',
      title: 'Andere Garmin-Ausführung',
      detail: `${replaced.length} Plantag(e) wurden anders ausgeführt. Die Folgetage sollten nicht blind am ursprünglichen Plan hängen.`,
      color: 'var(--amber)',
    });
  }

  const adaptation = planTrace?.adaptation ?? planTrace?.inputSnapshot.adaptation ?? null;
  if (adaptation?.learnedFromExecution.length) {
    signals.push({
      id: 'trace-execution',
      title: 'Ausführung gelernt',
      detail: adaptation.learnedFromExecution.slice(0, 2).join(' '),
      color: 'var(--green)',
    });
  }
  if (adaptation?.variationRationale.length) {
    signals.push({
      id: 'trace-variation',
      title: 'Variation prüfen',
      detail: adaptation.variationRationale.slice(0, 2).join(' '),
      color: 'var(--accent)',
    });
  }

  return signals.slice(0, 4);
}

function buildGarminSyncDebtSummary(workouts: PlannedWorkout[], today: string): GarminSyncDebtSummary | null {
  const future = workouts.filter(workout => workout.status === 'planned' && workout.plannedDate >= today);
  if (future.length === 0) return null;

  const localOnly = future.filter(workout => executionStatusFor(workout) === 'local_planned').length;
  const templateOnly = future.filter(workout => executionStatusFor(workout) === 'garmin_template').length;
  const degraded = future.filter(workout => workout.garminSyncContract?.status === 'degraded').length;
  const blocked = future.filter(workout => workout.garminSyncContract?.status === 'blocked').length;
  const deviceWindowDays = 15;
  const deviceWindowEnd = isoDateLocal(addLocalDays(new Date(today + 'T12:00:00'), deviceWindowDays));
  const deviceWindowDebt = future.filter(workout => workout.plannedDate <= deviceWindowEnd && (
    executionStatusFor(workout) === 'local_planned'
    || executionStatusFor(workout) === 'garmin_template'
    || workout.garminSyncContract?.status === 'degraded'
    || workout.garminSyncContract?.status === 'blocked'
  )).length;

  if (localOnly + templateOnly + degraded + blocked === 0) return null;
  return { futureCount: future.length, deviceWindowDays, deviceWindowDebt, localOnly, templateOnly, degraded, blocked };
}

function PlanGarminSyncDebtCard({
  workouts,
  today,
  onNavigate,
}: {
  workouts: PlannedWorkout[];
  today: string;
  onNavigate: (path: string) => void;
}) {
  const summary = buildGarminSyncDebtSummary(workouts, today);
  if (!summary) return null;

  const tone = summary.blocked > 0 ? 'var(--rose)' : 'var(--amber)';
  const chips = [
    summary.localOnly > 0 ? `${summary.localOnly} lokal` : null,
    summary.templateOnly > 0 ? `${summary.templateOnly} nur Vorlage` : null,
    summary.degraded > 0 ? `${summary.degraded} Einschränkung` : null,
    summary.blocked > 0 ? `${summary.blocked} blockiert` : null,
  ].filter((chip): chip is string => chip != null);

  return (
    <section
      className="card"
      data-testid="plan-garmin-sync-debt"
      style={{ borderColor: translucent(tone, 28), background: translucent(tone, 5) }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
        <span className="label-mono" style={{ color: tone }}>Garmin Sync-Check</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          {summary.futureCount} Zukunftseinheit(en)
        </span>
      </div>
      <h2 style={{ fontSize: 15, color: 'var(--text)', margin: '0 0 6px', fontWeight: 600 }}>
        Uhr/Edge-Handoff prüfen
      </h2>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
        Einige geplante Einheiten sind noch nicht vollständig als Garmin-Vorlage oder Kalendertermin abgesichert.
      </p>
      <div style={{ marginTop: 9, fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>
        Gerätehorizont {summary.deviceWindowDays} Tage · {summary.deviceWindowDebt} offen im Gerätehorizont
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {chips.map(chip => (
          <span
            key={chip}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: tone,
              border: `1px solid ${translucent(tone, 45)}`,
              borderRadius: 4,
              padding: '3px 6px',
            }}
          >
            {chip}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onNavigate('/settings?section=garmin')}
        style={{
          marginTop: 12,
          minHeight: 42,
          minWidth: 44,
          width: '100%',
          background: 'var(--surface-2)',
          border: `1px solid ${tone}`,
          borderRadius: 'var(--radius)',
          color: tone,
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 0,
          textTransform: 'uppercase',
        }}
      >
        Garmin öffnen
      </button>
    </section>
  );
}

function NextTrainingDecisionCard({
  nextWorkout,
  availableDays,
  activeGoalsCount,
  currentLoad,
  planTrace,
  mentalPlanImpact,
  todayOptionsState,
  onNavigate,
  onOpen,
  onOpenCustom,
  onOpenAvailability,
  onOpenGenerator,
}: {
  nextWorkout: PlannedWorkout | null;
  availableDays: number[];
  activeGoalsCount: number;
  currentLoad: PulseFitnessLoad | null;
  planTrace: PulsePlanTrace | null;
  mentalPlanImpact: string | null;
  todayOptionsState: PulseTodayOptionsResponse['state'] | null;
  onNavigate: (path: string) => void;
  onOpen: (workout: PlannedWorkout) => void;
  onOpenCustom: () => void;
  onOpenAvailability: () => void;
  onOpenGenerator: () => void;
}) {
  const update = useUpdateWorkout();
  const [alternativeError, setAlternativeError] = useState<{ id: PlanAlternativeId; message: string } | null>(null);
  const today = isoDateLocal(new Date());

  if (!nextWorkout && todayOptionsState === 'planned_workout') {
    return null;
  }

  if (!nextWorkout) {
    return (
      <div id="next-training-decision" tabIndex={-1} className="card" data-testid="next-training-decision" style={{ borderColor: 'rgba(94,230,207,0.18)' }}>
        <div className="label-mono" style={{ color: 'var(--accent)', marginBottom: 7 }}>
          NÄCHSTE TRAININGSENTSCHEIDUNG
        </div>
        <h2 style={{ fontSize: 16, color: 'var(--text)', margin: '0 0 6px', fontWeight: 600 }}>
          Kein offenes Training geplant
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>
          Prüfe deine Verfügbarkeit oder erstelle einen neuen Wochenplan, wenn du diese Woche trainieren willst.
        </p>
        <div
          data-testid="plan-primary-action"
          style={{
            marginTop: 12,
            padding: '10px 11px',
            border: '1px solid rgba(94,230,207,0.26)',
            borderRadius: 6,
            background: 'rgba(94,230,207,0.05)',
          }}
        >
          <div className="label-mono" style={{ color: 'var(--accent)', marginBottom: 5 }}>Plan-Aktion</div>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
            Verfügbarkeit klären
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45, margin: 0 }}>
            Warum jetzt: Ohne verfügbare Tage kann Pulse keinen sinnvollen Wochenplan statt nur freie Slots erzeugen.
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45, margin: '6px 0 0' }}>
            Nach dem Klick: Du setzt die Trainingsfenster; danach kann Pulse Planvorschlag und Garmin-Handoff konkreter prüfen.
          </p>
          <button
            type="button"
            onClick={onOpenAvailability}
            style={{
              marginTop: 10,
              minHeight: 42,
              width: '100%',
              background: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
              color: '#04110f',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0,
              padding: '9px 10px',
              textTransform: 'uppercase',
            }}
          >
            Verfügbarkeit prüfen
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 12 }}>
          {[
            { label: 'Einheit hinzufügen', onClick: onOpenCustom, accent: false },
            { label: 'Plan generieren', onClick: onOpenGenerator, accent: false },
            {
              label: 'Coach fragen',
              onClick: () => onNavigate(coachPromptPath(
                'Ich habe kein offenes Training geplant. Soll ich Verfügbarkeit, Plan-Generator oder bewusste Erholung priorisieren?',
                'plan',
              )),
              accent: true,
            },
          ].map(action => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              style={{
                minHeight: 40,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: action.accent ? 'var(--accent)' : 'var(--text-2)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: 0,
                padding: '8px 10px',
                textTransform: 'uppercase',
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const dateLabel = new Date(nextWorkout.plannedDate + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  const isToday = nextWorkout.plannedDate === today;
  const load = currentLoad;
  const riskCount = planTrace?.inputSnapshot.riskSignals.length ?? 0;
  const goalsCount = activeGoalsCount || planTrace?.inputSnapshot.goals.length || 0;
  const fitDecision = nextWorkout.capabilityFit ? FIT_DECISION_META[nextWorkout.capabilityFit] : null;
  const levelSummary = athleteLevelSummary(nextWorkout);
  const sourceChips: SourceChip[] = [
    load
      ? { label: `Einbezogen: TSB ${load.tsb.toFixed(1)}`, targetPath: '/data?tab=analysis#data-plan-trace' }
      : { label: 'Einbezogen: aktueller Plan', targetPath: '/data?tab=analysis#data-plan-trace' },
    { label: `Verfügbarkeit ${availableDays.map(day => DAY_SHORT[day]).join('/') || 'offen'}` },
    goalsCount > 0
      ? { label: `Ziele ${goalsCount} aktiv`, targetPath: '/plan?tab=goals' }
      : { label: 'Ziele keine aktiven', targetPath: '/plan?tab=goals' },
    riskCount > 0
      ? { label: `Risiko ${riskCount} Signal(e)`, targetPath: '/data?tab=analysis#data-plan-trace' }
      : { label: 'Risiko unauffällig', targetPath: '/data?tab=analysis#data-plan-trace' },
  ];
  const fatigueAlternativeNeeded = load != null && load.tsb <= -20;
  const growthAlternativeAllowed = riskCount === 0
    && !mentalPlanImpact
    && !fatigueAlternativeNeeded
    && goalsCount > 0
    && nextWorkout.zone <= 2
    && nextWorkout.durationMin <= 180
    && load != null
    && load.tsb >= 5;
  const protectiveAlternative: { id: PlanAlternativeId; reason: string } | null = riskCount > 0 || mentalPlanImpact || fatigueAlternativeNeeded
    ? ((load?.tsb ?? 0) <= -20
      ? { id: 'rest', reason: 'Empfohlen wegen TSB/Risiko' }
      : { id: 'easier', reason: 'Empfohlen wegen TSB/Risiko' })
    : null;
  const levelAlternative: { id: PlanAlternativeId; reason: string } | null = fitDecision?.recommendedAlternative
    ? { id: fitDecision.recommendedAlternative, reason: fitDecision.recommendation ?? `Athlete-Level: ${fitDecision.label}` }
    : null;
  const recommendedAlternative: { id: PlanAlternativeId; reason: string } | null = protectiveAlternative
    ?? (growthAlternativeAllowed
      ? { id: 'longer', reason: 'Ziel + grüne Signale' }
      : levelAlternative
      ?? (goalsCount > 0 && nextWorkout.zone >= 3
        ? { id: 'shorter', reason: 'Zielreiz behalten, Tageslast senken' }
        : null));
  const baseAlternatives: PlanAlternativeOption[] = [
    {
      id: 'shorter',
      label: 'Kürzer',
      detail: `${roundToFive(nextWorkout.durationMin * 0.65)} min, Intensität bleibt`,
      levelEffect: ['stretch', 'too_hard_today'].includes(nextWorkout.capabilityFit ?? '')
        ? 'Level-Wirkung: Zielreiz bleibt, Belastung sinkt'
        : undefined,
    },
    {
      id: 'easier',
      label: 'Leichter',
      detail: `Z${Math.max(1, Math.min(2, nextWorkout.zone - 1))}, ${roundToFive(nextWorkout.durationMin * 0.85)} min`,
      levelEffect: ['stretch', 'too_hard_today'].includes(nextWorkout.capabilityFit ?? '')
        ? 'Level-Wirkung: Intensität fällt in einen machbareren Bereich'
        : undefined,
    },
    ...(growthAlternativeAllowed ? [{
      id: 'longer' as const,
      label: 'Länger',
      detail: `${Math.min(240, roundToFive(nextWorkout.durationMin * 1.25))} min ruhige Ausdauer`,
    }] : []),
    {
      id: 'move',
      label: 'Verschieben',
      detail: nextAvailableDateAfter(nextWorkout.plannedDate, availableDays),
    },
    {
      id: 'rest',
      label: 'Frei lassen',
      detail: 'bewusster Ruhetag',
    },
  ];
  const alternatives: PlanAlternativeOption[] = baseAlternatives.map(option => option.id === recommendedAlternative?.id
    ? { ...option, recommended: true, recommendationReason: recommendedAlternative.reason }
    : option);
  const recommendedOption = alternatives.find(option => option.recommended) ?? null;
  const adaptationStatus = recommendedOption
    ? {
      label: '1 Empfehlung prüfen',
      title: `${recommendedOption.label} empfohlen`,
      detail: `${recommendedOption.recommendationReason ?? 'Pulse sieht eine sinnvolle Anpassung.'} · ${recommendedOption.detail}`,
      tone: 'var(--amber)',
      border: 'rgba(251,191,36,0.28)',
      background: 'rgba(251,191,36,0.08)',
    }
    : {
      label: 'Plan aktuell',
      title: 'Keine Anpassung nötig',
      detail: 'Load, Risiko, mentale Lage und Ziele sprechen gerade nicht gegen die geplante Einheit.',
      tone: 'var(--green)',
      border: 'rgba(52,211,153,0.28)',
      background: 'rgba(52,211,153,0.08)',
    };
  const primaryActionTitle = isToday ? 'Einheit öffnen und ausführen' : 'Nächste Einheit prüfen';
  const primaryActionReason = recommendedOption
    ? `${recommendedOption.label} ist als Alternative markiert; prüfe erst Zweck und Garmin-Handoff, bevor du den Plan änderst.`
    : 'Diese Einheit passt aktuell zu Load, Risiko, mentaler Lage und deinen aktiven Zielen.';
  const primaryActionResult = isToday
    ? 'Du siehst Struktur, Garmin-Status und Feedback direkt an der Einheit, ohne den Plan automatisch zu verändern.'
    : 'Du öffnest Struktur, Garmin-Handoff und Feedback. Änderungen bleiben bewusst, bevor Garmin betroffen ist.';

  async function applyAlternative(id: PlanAlternativeId) {
    const workout = nextWorkout;
    if (!workout) return;
    setAlternativeError(null);
    try {
      await update.mutateAsync({
        id: workout.id,
        data: buildPlanAlternative(workout, id, availableDays),
      });
    } catch (err) {
      setAlternativeError({
        id,
        message: errorMessage(err, 'Die Planänderung konnte nicht gespeichert werden.'),
      });
    }
  }

  return (
    <div id="next-training-decision" tabIndex={-1} className="card" data-testid="next-training-decision" style={{ borderColor: 'rgba(94,230,207,0.24)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 8 }}>
        <span className="label-mono" style={{ color: 'var(--accent)' }}>
          NÄCHSTE TRAININGSENTSCHEIDUNG
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isToday ? 'var(--accent)' : 'var(--text-3)' }}>
          {isToday ? 'Heute' : dateLabel}
        </span>
      </div>
      <h2 style={{ fontSize: 17, color: 'var(--text)', margin: '0 0 5px', fontWeight: 600 }}>
        {ACTIVITY_LABEL[nextWorkout.activityType] ?? nextWorkout.activityType} · Zone {nextWorkout.zone}
      </h2>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 9 }}>
        {nextWorkout.durationMin} min{nextWorkout.targetTss ? ` · TSS ${nextWorkout.targetTss}` : ''}
      </div>
      {nextWorkout.description && (
        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: '0 0 12px' }}>
          {nextWorkout.description.split('\n')[0]}
        </p>
      )}
      {levelSummary && (
        <div
          data-testid="plan-athlete-level-summary"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            margin: '0 0 12px',
            padding: '9px 10px',
            border: `1px solid color-mix(in srgb, ${levelSummary.tone} 34%, transparent)`,
            borderRadius: 5,
            background: `color-mix(in srgb, ${levelSummary.tone} 8%, transparent)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span className="label-mono" style={{ color: levelSummary.tone }}>Athlete-Level</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: levelSummary.tone, textTransform: 'uppercase' }}>
              {levelSummary.label}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>
            {levelSummary.workoutLevel ? `${levelSummary.workoutLevel}: ` : ''}{levelSummary.nextAction}
          </p>
        </div>
      )}
      {mentalPlanImpact && (
        <p
          data-testid="mental-plan-impact"
          style={{
            fontSize: 12,
            color: 'var(--amber)',
            lineHeight: 1.45,
            margin: '0 0 12px',
            padding: '8px 9px',
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 5,
          }}
        >
          Mentale Lage: {mentalPlanImpact}
        </p>
      )}
      <div
        data-testid="plan-primary-action"
        style={{
          marginBottom: 12,
          padding: '10px 11px',
          border: '1px solid rgba(94,230,207,0.26)',
          borderRadius: 6,
          background: 'rgba(94,230,207,0.05)',
        }}
      >
        <div className="label-mono" style={{ color: 'var(--accent)', marginBottom: 5 }}>Plan-Aktion</div>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
          {primaryActionTitle}
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45, margin: 0 }}>
          Warum jetzt: {primaryActionReason}
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45, margin: '6px 0 0' }}>
          Nach dem Klick: {primaryActionResult}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 7, marginTop: 10 }}>
          <button
            type="button"
            onClick={() => onOpen(nextWorkout)}
            style={{
              minHeight: 42,
              background: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
              color: '#04110f',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0,
              padding: '9px 10px',
              textTransform: 'uppercase',
            }}
          >
            Einheit öffnen
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/plan?tab=execution')}
            style={{
              minHeight: 42,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: 0,
              padding: '9px 10px',
              textTransform: 'uppercase',
            }}
          >
            Garmin prüfen
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {sourceChips.map(chip => (
          chip.targetPath ? (
            <button
              key={`${chip.targetPath}:${chip.label}`}
              type="button"
              onClick={() => onNavigate(chip.targetPath!)}
              style={{
                minWidth: 44,
                minHeight: 44,
                maxWidth: '100%',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text-2)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: 0,
                overflowWrap: 'anywhere',
                padding: '8px 9px',
              }}
            >
              {chip.label}
            </button>
          ) : (
            <span key={chip.label} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-2)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '3px 6px',
            }}>
              {chip.label}
            </span>
          )
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
        {[
          ['Metriken prüfen', '/data?tab=trends#data-recovery'],
          ['Mental prüfen', '/data?tab=today#data-mental'],
          ['Ziele prüfen', '/plan?tab=goals'],
        ].map(([label, path]) => (
          <button
            key={path}
            type="button"
            onClick={() => onNavigate(path)}
            style={{
              minHeight: 40,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: 0,
              padding: '7px 10px',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        data-testid="plan-adaptation-status"
        style={{
          marginBottom: 12,
          padding: '9px 10px',
          border: `1px solid ${adaptationStatus.border}`,
          borderRadius: 5,
          background: adaptationStatus.background,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
          <span className="label-mono" style={{ color: adaptationStatus.tone }}>
            ADAPTIONS-CHECK
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: adaptationStatus.tone, textTransform: 'uppercase' }}>
            {adaptationStatus.label}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, marginBottom: 3 }}>
          {adaptationStatus.title}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>
          {adaptationStatus.detail}
        </div>
      </div>
      <div className="label-mono" style={{ color: 'var(--accent)', marginBottom: 7 }}>ALTERNATIVEN</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 7, marginBottom: 10 }}>
        {alternatives.map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => { void applyAlternative(option.id); }}
            disabled={update.isPending}
            style={{
              minHeight: 58,
              textAlign: 'left',
              background: option.id === 'rest' ? 'transparent' : 'var(--surface)',
              border: `1px solid ${option.id === 'rest' ? 'var(--border)' : 'rgba(94,230,207,0.28)'}`,
              borderRadius: 5,
              color: 'var(--text)',
              cursor: update.isPending ? 'wait' : 'pointer',
              padding: '8px 9px',
            }}
          >
            {option.recommended && (
              <span style={{
                display: 'inline-block',
                marginBottom: 5,
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                color: 'var(--green)',
                border: '1px solid rgba(52,211,153,0.45)',
                borderRadius: 3,
                padding: '1px 5px',
                textTransform: 'uppercase',
              }}>
                Empfohlen
              </span>
            )}
            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: option.id === 'rest' ? 'var(--amber)' : 'var(--accent)', textTransform: 'uppercase' }}>
              {option.label}
            </span>
            <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.35 }}>
              {option.detail}
            </span>
            {option.recommendationReason && (
              <span style={{ display: 'block', marginTop: 4, fontSize: 10.5, color: 'var(--text-2)', lineHeight: 1.35 }}>
                {option.recommendationReason}
              </span>
            )}
            {option.levelEffect && (
              <span style={{ display: 'block', marginTop: 4, fontSize: 10.5, color: 'var(--amber)', lineHeight: 1.35 }}>
                {option.levelEffect}
              </span>
            )}
          </button>
        ))}
      </div>
      {alternativeError && (
        <div style={{ marginBottom: 10 }}>
          <InlineFeedback
            title="Änderung nicht gespeichert"
            message={alternativeError.message}
            actionLabel="Erneut versuchen"
            actionPending={update.isPending}
            onAction={() => { void applyAlternative(alternativeError.id); }}
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => onOpen(nextWorkout)}
        style={{
          width: '100%',
          background: 'var(--surface-2)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)',
          color: 'var(--accent)',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 0,
          padding: '9px 10px',
          textTransform: 'uppercase',
        }}
      >
        Details öffnen
      </button>
    </div>
  );
}

// ─── Availability Editor ──────────────────────────────────────────────────────

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function AvailabilityEditor({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useWeekAvailability();
  const save = useSaveAvailability();
  const weeks = data?.weeks ?? [];
  const [local, setLocal] = useState<Record<string, { availableDays: number[]; weeklyHours: number; notes: string }>>({});
  const [saveError, setSaveError] = useState<{ weekStart: string; message: string } | null>(null);

  function getWeek(weekStart: string) {
    if (local[weekStart]) return local[weekStart]!;
    const w = weeks.find(w => w.weekStart === weekStart);
    return { availableDays: w?.availableDays ?? [0, 2, 4, 5], weeklyHours: w?.weeklyHours ?? 8, notes: w?.notes ?? '' };
  }

  function toggleDay(weekStart: string, day: number) {
    const cur = getWeek(weekStart);
    const days = cur.availableDays.includes(day)
      ? cur.availableDays.filter(d => d !== day)
      : [...cur.availableDays, day].sort();
    setLocal(l => ({ ...l, [weekStart]: { ...cur, availableDays: days } }));
  }

  async function handleSave(weekStart: string) {
    const cur = getWeek(weekStart);
    setSaveError(null);
    try {
      await save.mutateAsync({ weekStart, data: { availableDays: cur.availableDays, weeklyHours: cur.weeklyHours, notes: cur.notes || undefined } });
      setLocal(l => { const n = { ...l }; delete n[weekStart]; return n; });
    } catch (err) {
      setSaveError({
        weekStart,
        message: errorMessage(err, 'Die Verfügbarkeit konnte nicht gespeichert werden.'),
      });
    }
  }

  const mondayStrs = getMondays();

  if (!open) {
    return (
      <button onClick={() => onOpenChange(true)} style={{
        width: '100%', padding: '8px 12px', textAlign: 'left',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5,
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em',
        color: 'var(--text-2)', cursor: 'pointer', textTransform: 'uppercase',
      }}>
        ⊕ Verfügbarkeit anpassen
      </button>
    );
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: 'var(--text-2)', textTransform: 'uppercase' }}>
          Verfügbarkeit — nächste 2 Wochen
        </span>
        <button onClick={() => onOpenChange(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      {isLoading ? <div style={{ padding: 12 }}><Skeleton height={80} /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {mondayStrs.map((weekStart, wi) => {
            const cur = getWeek(weekStart);
            const isDirty = !!local[weekStart];
            const isSaving = save.isPending;
            const label = wi === 0 ? 'Diese Woche' : 'Nächste Woche';
            const d = new Date(weekStart + 'T12:00:00');
            const dEnd = new Date(d); dEnd.setDate(d.getDate() + 6);
            const range = `${d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} – ${dEnd.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}`;

            return (
              <div key={weekStart} style={{ padding: '12px 14px', borderTop: wi > 0 ? '1px solid var(--border)' : undefined, background: 'var(--bg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginLeft: 8 }}>{range}</span>
                  </div>
                  {isDirty && (
                    <button onClick={() => void handleSave(weekStart)} disabled={isSaving || cur.availableDays.length === 0} style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
                      background: 'var(--accent)', color: 'var(--bg)', border: 'none',
                      borderRadius: 3, padding: '4px 10px', cursor: 'pointer',
                    }}>
                      {isSaving ? '…' : '⇪ Speichern & regenerieren'}
                    </button>
                  )}
                </div>

                {/* Day toggles */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                  {DAY_LABELS.map((label, i) => {
                    const active = cur.availableDays.includes(i);
                    return (
                      <button key={i} onClick={() => toggleDay(weekStart, i)} style={{
                        flex: 1, padding: '6px 0', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 3, background: active ? translucent('var(--accent)', 13) : 'var(--surface)',
                        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.06em',
                        color: active ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer',
                      }}>{label}</button>
                    );
                  })}
                </div>

                {/* Hours slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                    {cur.weeklyHours.toFixed(1)} h/Wo
                  </span>
                  <input type="range" min={1} max={20} step={0.5} value={cur.weeklyHours}
                    onChange={e => setLocal(l => ({ ...l, [weekStart]: { ...getWeek(weekStart), weeklyHours: Number(e.target.value) } }))}
                    style={{ flex: 1, accentColor: 'var(--accent)' }}
                  />
                </div>

                {/* Notes */}
                <input type="text" placeholder="Notiz (z.B. Dienstreise, Urlaub…)" value={cur.notes}
                  onChange={e => setLocal(l => ({ ...l, [weekStart]: { ...getWeek(weekStart), notes: e.target.value } }))}
                  style={{
                    marginTop: 8, width: '100%', boxSizing: 'border-box',
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3,
                    padding: '6px 10px', fontSize: 11, color: 'var(--text)', outline: 'none',
                  }}
                />
              </div>
            );
          })}
          {saveError && (
            <div style={{ padding: '0 12px 12px' }}>
              <InlineFeedback
                title="Verfügbarkeit nicht gespeichert"
                message={saveError.message}
                actionLabel="Erneut versuchen"
                actionPending={save.isPending}
                onAction={() => { void handleSave(saveError.weekStart); }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomWorkoutForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (workout: PlannedWorkout, notice: PlanMutationNotice | null) => void;
}) {
  const createWorkout = useCreateWorkout();
  const [plannedDate, setPlannedDate] = useState(isoDateLocal(new Date()));
  const [activityType, setActivityType] = useState<PulseActivityType>('bike');
  const [zone, setZone] = useState(2);
  const [distanceKm, setDistanceKm] = useState('');
  const [expectedSpeedKmh, setExpectedSpeedKmh] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [description, setDescription] = useState('');
  const [syncGarmin, setSyncGarmin] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const distance = Number(distanceKm.replace(',', '.'));
  const speed = Number(expectedSpeedKmh.replace(',', '.'));
  const explicitDuration = Number(durationMin);
  const inferredDuration = Number.isFinite(distance) && distance > 0 && Number.isFinite(speed) && speed > 0
    ? Math.round((distance / speed) * 60)
    : null;
  const effectiveDuration = Number.isFinite(explicitDuration) && explicitDuration > 0 ? explicitDuration : inferredDuration;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!effectiveDuration) {
      setFormError('Dauer oder Distanz plus Schnitt fehlt.');
      return;
    }
    try {
      const payload = {
        plannedDate,
        activityType,
        zone,
        durationMin: Number.isFinite(explicitDuration) && explicitDuration > 0 ? Math.round(explicitDuration) : undefined,
        distanceKm: Number.isFinite(distance) && distance > 0 ? distance : undefined,
        expectedSpeedKmh: Number.isFinite(speed) && speed > 0 ? speed : undefined,
        description: description.trim() || undefined,
        syncGarmin,
        userLocked: true,
      };
      const result = await createWorkout.mutateAsync(payload);
      onCreated(result.workout, garminSyncNotice(result.garminSync, 'Die Einheit ist in Pulse gespeichert'));
    } catch (err) {
      setFormError(errorMessage(err, 'Die Einheit konnte nicht erstellt werden.'));
    }
  }

  return (
    <form data-testid="custom-workout-form" className="card" onSubmit={handleSubmit} style={{ borderColor: 'rgba(94,230,207,0.22)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <span className="label-mono" style={{ color: 'var(--accent)' }}>Eigene Einheit</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          {effectiveDuration ? `${Math.round(effectiveDuration)} min` : 'Dauer offen'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
          Datum
          <input type="date" value={plannedDate} onChange={e => setPlannedDate(e.target.value)} style={fieldStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
          Sportart
          <select value={activityType} onChange={e => setActivityType(e.target.value as PulseActivityType)} style={fieldStyle}>
            {CUSTOM_ACTIVITY_TYPES.map(type => (
              <option key={type} value={type}>{ACTIVITY_LABEL[type] ?? type}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
          Zone
          <input type="number" min={1} max={5} value={zone} onChange={e => setZone(Number(e.target.value))} style={fieldStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
          km optional
          <input inputMode="decimal" value={distanceKm} onChange={e => setDistanceKm(e.target.value)} placeholder="z.B. 155" style={fieldStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
          km/h optional
          <input inputMode="decimal" value={expectedSpeedKmh} onChange={e => setExpectedSpeedKmh(e.target.value)} placeholder="z.B. 22" style={fieldStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
          Minuten
          <input inputMode="numeric" value={durationMin} onChange={e => setDurationMin(e.target.value)} placeholder={inferredDuration ? String(inferredDuration) : ''} style={fieldStyle} />
        </label>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)', marginTop: 10 }}>
        Notiz
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }} />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 11, color: 'var(--text-2)' }}>
        <input type="checkbox" checked={syncGarmin} onChange={e => setSyncGarmin(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        Garmin synchronisieren
      </label>

      {formError && (
        <div style={{ marginTop: 10 }}>
          <InlineFeedback title="Einheit nicht erstellt" message={formError} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="submit" disabled={createWorkout.isPending} style={{
          flex: 1, minHeight: 42, background: 'var(--surface-2)', border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)', color: 'var(--accent)', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          {createWorkout.isPending ? '● Speichere…' : 'Einheit speichern'}
        </button>
        <button type="button" onClick={onCancel} style={{
          minHeight: 42, background: 'transparent', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', color: 'var(--text-3)', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
          padding: '0 12px',
        }}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  boxSizing: 'border-box',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text)',
  fontSize: 12,
  padding: '8px 9px',
};

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

type ScenarioProjectedWorkout = PulsePlanScenarioPreview['projectedWorkouts'][number];

type ScenarioAffectedWorkout = {
  id: string;
  title: string;
  detail: string;
  fitLine: string | null;
  fitDetail: string | null;
  durationLine: string;
  tssLine: string;
  tone: string;
};

function scenarioTss(workout: Pick<ScenarioProjectedWorkout, 'durationMin' | 'zone' | 'targetTss'>): number {
  if (workout.targetTss != null) return Math.round(workout.targetTss);
  const factor = [0, 0.35, 0.7, 0.9, 1.12, 1.3][Math.max(1, Math.min(5, workout.zone))] ?? 0.7;
  return Math.round(workout.durationMin * factor);
}

function scenarioFitCopy(workout: ScenarioProjectedWorkout): { line: string; detail: string | null } | null {
  const archetypeLabel = workout.archetypeLabel ?? workoutArchetypeCopy(workout.archetypeId)?.label ?? null;
  const workoutLevel = workout.difficultyLevel != null ? `Workout-Level ${workout.difficultyLevel.toFixed(1)}` : null;
  const fitLabel = workout.capabilityFit
    ? FIT_DECISION_META[workout.capabilityFit]?.label ?? workout.capabilityFitDetail?.displayLabel ?? null
    : workout.capabilityFitDetail?.displayLabel ?? null;
  const line = [archetypeLabel, workoutLevel, fitLabel].filter(Boolean).join(' · ');
  if (!line) return null;
  return {
    line,
    detail: workout.capabilityFitDetail?.recommendation
      ?? (workout.capabilityFit ? FIT_DECISION_META[workout.capabilityFit]?.nextAction ?? null : null),
  };
}

function workoutImpactLabel(before: PlannedWorkout | null, after: ScenarioProjectedWorkout): ScenarioAffectedWorkout | null {
  const title = `${ACTIVITY_LABEL[after.activityType] ?? after.activityType} · ${after.plannedDate}`;
  const afterTss = scenarioTss(after);
  const fitCopy = scenarioFitCopy(after);

  if (!before) {
    return {
      id: after.id,
      title,
      detail: after.description ?? 'Neue Einheit aus der Vorschau.',
      fitLine: fitCopy?.line ?? null,
      fitDetail: fitCopy?.detail ?? null,
      durationLine: `+${after.durationMin} min`,
      tssLine: `+${afterTss} TSS`,
      tone: 'var(--accent)',
    };
  }

  const beforeTss = scenarioTss(before);
  const dateChanged = before.plannedDate !== after.plannedDate;
  const durationChanged = before.durationMin !== after.durationMin;
  const tssChanged = beforeTss !== afterTss;
  const zoneChanged = before.zone !== after.zone;
  if (!dateChanged && !durationChanged && !tssChanged && !zoneChanged) return null;

  return {
    id: after.id,
    title,
    detail: [
      dateChanged ? `Datum ${before.plannedDate} -> ${after.plannedDate}` : null,
      `Z${before.zone} -> Z${after.zone}`,
      after.description ?? before.description ?? null,
    ].filter(Boolean).join(' · '),
    fitLine: fitCopy?.line ?? null,
    fitDetail: fitCopy?.detail ?? null,
    durationLine: `${before.durationMin} -> ${after.durationMin} min`,
    tssLine: `${beforeTss} -> ${afterTss} TSS`,
    tone: after.durationMin < before.durationMin || afterTss < beforeTss ? 'var(--amber)' : 'var(--accent)',
  };
}

function scenarioAffectedWorkouts(workouts: PlannedWorkout[], preview: PulsePlanScenarioPreview): ScenarioAffectedWorkout[] {
  const beforeById = new Map(workouts.map(workout => [workout.id, workout]));
  return preview.projectedWorkouts
    .map(workout => workoutImpactLabel(beforeById.get(workout.id) ?? null, workout))
    .filter((item): item is ScenarioAffectedWorkout => item != null)
    .slice(0, 5);
}

type PlanRefreshComparison = PulsePlanRefreshPreview['comparisons'][number];

function refreshWorkoutLine(workout: NonNullable<PlanRefreshComparison['current']>): string {
  const sport = ACTIVITY_LABEL[workout.activityType] ?? workout.activityType;
  const archetype = workout.archetypeId ? ` · ${workout.archetypeId}` : '';
  return `${sport} · Z${workout.zone} · ${workout.durationMin} min${archetype}`;
}

function PlanRefreshPreviewCard({ weekStart }: { weekStart: string }) {
  const refreshPreview = usePlanRefreshPreview(weekStart);
  const preview = refreshPreview.data?.preview ?? null;
  const shouldShow = preview
    ? preview.stale || preview.triggers.length > 0 || preview.comparisons.length > 0
    : refreshPreview.isError;

  if (!shouldShow) return null;

  if (refreshPreview.isError) {
    return (
      <InlineFeedback
        title="Planprüfung nicht geladen"
        message={errorMessage(refreshPreview.error, 'Die Refresh-Vorschau konnte nicht gelesen werden.')}
        actionLabel="Erneut prüfen"
        onAction={() => { void refreshPreview.refetch(); }}
      />
    );
  }

  if (!preview) return null;

  return (
    <section className="card evidence-section" data-testid="plan-refresh-preview-card" style={{ borderColor: 'rgba(94,230,207,0.26)' }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 240px' }}>
            <div className="label-mono" style={{ color: 'var(--accent)', marginBottom: 5 }}>Plan prüfen</div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{preview.summary}</p>
          </div>
          <button
            type="button"
            onClick={() => { void refreshPreview.refetch(); }}
            disabled={refreshPreview.isFetching}
            style={{
              minHeight: 44,
              minWidth: 44,
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
              background: refreshPreview.isFetching ? 'var(--surface-2)' : 'rgba(94,230,207,0.08)',
              color: 'var(--accent)',
              cursor: refreshPreview.isFetching ? 'wait' : 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '0 12px',
            }}
          >
            {refreshPreview.isFetching ? '● Prüfe…' : 'Refresh Preview'}
          </button>
        </div>

        {preview.triggers.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {preview.triggers.map(trigger => (
              <span
                key={trigger.kind}
                className="chip"
                title={[trigger.detail, ...trigger.evidence].filter(Boolean).join(' · ')}
                style={{
                  borderColor: trigger.severity === 'action' ? 'rgba(244,63,94,0.45)' : trigger.severity === 'watch' ? 'rgba(245,158,11,0.45)' : 'var(--border)',
                  color: trigger.severity === 'action' ? 'var(--rose)' : trigger.severity === 'watch' ? 'var(--amber)' : 'var(--text-2)',
                }}
              >
                {trigger.label}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(116px, 1fr))', gap: 6 }}>
          {[
            ['TSS', `${preview.loadImpact.tssDelta >= 0 ? '+' : ''}${preview.loadImpact.tssDelta}`],
            ['Dauer', `${preview.loadImpact.durationDeltaMin >= 0 ? '+' : ''}${preview.loadImpact.durationDeltaMin} min`],
            ['Apply', preview.applySupported ? 'bereit' : 'read-only'],
          ].map(([label, value]) => (
            <div key={label} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: 9 }}>
              <div className="label-mono" style={{ fontSize: 8, color: 'var(--text-3)' }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>
          {preview.garminImpact?.summary ?? 'Garmin nach Apply: keine Remote-Aenderung erwartet.'}
        </div>

        {preview.comparisons.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }} data-testid="plan-refresh-comparisons">
            {preview.comparisons.slice(0, 4).map(comparison => (
              <div
                key={`${comparison.date}-${comparison.current?.id ?? 'new'}`}
                style={{
                  border: '1px solid var(--border)',
                  borderLeft: '3px solid var(--accent)',
                  borderRadius: 4,
                  background: 'var(--surface-2)',
                  padding: '9px 10px',
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>{comparison.date}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)' }}>{comparison.changes.join(' / ')}</span>
                </div>
                {comparison.current && <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>Jetzt: {refreshWorkoutLine(comparison.current)}</div>}
                {comparison.proposed && <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.45 }}>Vorschlag: {refreshWorkoutLine(comparison.proposed)}</div>}
                {comparison.proposed?.why && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>
                    Warum: {comparison.proposed.why}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.45 }}>{comparison.reason}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(136px, auto)', gap: 8, alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.45 }}>{preview.mutationBoundary}</p>
          <button
            type="button"
            disabled
            style={{
              minHeight: 44,
              minWidth: 44,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--surface-2)',
              color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Vorschau anwenden
          </button>
        </div>
      </div>
    </section>
  );
}

function PlanScenarioPreviewCard({
  workouts,
  nextWorkout,
  availableDays,
  reviewRequest,
  entrySource,
  onApplied,
}: {
  workouts: PlannedWorkout[];
  nextWorkout: PlannedWorkout | null;
  availableDays: number[];
  reviewRequest: { seq: number; mode: AdaptationScenarioMode };
  entrySource: string | null;
  onApplied: (workout: PlannedWorkout | null, notice: PlanMutationNotice | null) => void;
}) {
  const [searchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const scenarioParam = searchParams.get('scenario');
  const activityTypeParam = searchParams.get('activityType');
  const zoneParam = searchParams.get('zone');
  const durationParam = searchParams.get('durationMin');
  const descriptionParam = searchParams.get('description');
  const archetypeParam = searchParams.get('archetypeId');
  const previewScenario = usePlanScenarioPreview();
  const previewScenarioMutateAsync = previewScenario.mutateAsync;
  const createWorkout = useCreateWorkout();
  const updateWorkout = useUpdateWorkout();
  const today = isoDateLocal(new Date());
  const [mode, setMode] = useState<ScenarioPreviewMode>('tour');
  const [workoutActivityType, setWorkoutActivityType] = useState<PulseActivityType>('bike');
  const [workoutZone, setWorkoutZone] = useState(2);
  const [workoutDuration, setWorkoutDuration] = useState('');
  const [workoutArchetypeId, setWorkoutArchetypeId] = useState<string | null>(null);
  const [tourDate, setTourDate] = useState(isoDateLocal(addLocalDays(new Date(), 1)));
  const [tourDistance, setTourDistance] = useState('');
  const [tourSpeed, setTourSpeed] = useState('');
  const [tourDescription, setTourDescription] = useState('');
  const [moveDate, setMoveDate] = useState(nextWorkout ? nextAvailableDateAfter(nextWorkout.plannedDate, availableDays) : isoDateLocal(addLocalDays(new Date(), 1)));
  const [reduceFactor, setReduceFactor] = useState(75);
  const [error, setError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [reviewHint, setReviewHint] = useState<string | null>(null);
  const [preview, setPreview] = useState<PulsePlanScenarioPreview | null>(null);
  const autoPreviewKeyRef = useRef<string | null>(null);
  const previewPending = previewScenario.isPending;
  const applyPending = createWorkout.isPending || updateWorkout.isPending;
  const pending = previewPending || applyPending;
  const activeFutureWorkouts = workouts.filter(workout => workout.status === 'planned' && workout.plannedDate >= today);
  const affectedWorkouts = preview ? scenarioAffectedWorkouts(workouts, preview) : [];
  const isQuickScenarioEntry = entrySource === 'today-options' || entrySource === 'mobile-intent';

  useEffect(() => {
    if (!isQuickScenarioEntry) return;
    async function runAutoPreview(request: PulsePlanScenarioRequest) {
      if (autoPreviewKeyRef.current === searchKey) return;
      autoPreviewKeyRef.current = searchKey;
      try {
        const result = await previewScenarioMutateAsync(request);
        setPreview(result.preview);
      } catch (err) {
        setError(errorMessage(err, 'Die Vorschau konnte nicht berechnet werden.'));
      }
    }

    if (scenarioParam === 'reduce_volume' && entrySource === 'mobile-intent') {
      const request: PulsePlanScenarioRequest = { type: 'reduce_volume', factor: 0.7 };
      queueMicrotask(() => {
        setMode('reduce');
        setReduceFactor(70);
        setWorkoutArchetypeId(null);
        setPreview(null);
        setError(null);
        setApplyError(null);
        setReviewHint(descriptionParam || 'Heute bewusst frei halten.');
      });
      void runAutoPreview(request);
      return;
    }
    if (scenarioParam !== 'workout') return;
    const activityType = activityTypeFromParam(activityTypeParam);
    const zone = numberFromParam(zoneParam, 2, 1, 5);
    const durationMin = numberFromParam(durationParam, 45, 5, 900);
    const description = descriptionParam
      || `${ACTIVITY_LABEL[activityType] ?? activityType} ${durationMin} min Z${zone} aus ${entrySource === 'mobile-intent' ? 'Mobile Quick Decision' : 'TrainNow'}.`;
    const request: PulsePlanScenarioRequest = {
      type: 'add_custom_tour',
      workout: {
        plannedDate: today,
        activityType,
        zone,
        durationMin,
        distanceKm: null,
        expectedSpeedKmh: null,
        description,
        archetypeId: archetypeParam,
      },
    };

    queueMicrotask(() => {
      setMode('tour');
      setWorkoutActivityType(activityType);
      setWorkoutZone(zone);
      setWorkoutDuration(String(durationMin));
      setWorkoutArchetypeId(archetypeParam);
      setTourDate(today);
      setTourDistance('');
      setTourSpeed('');
      setTourDescription(description);
      setPreview(null);
      setError(null);
      setApplyError(null);
      setReviewHint(entrySource === 'mobile-intent'
        ? 'Mobile Quick Decision vorbereitet: Pulse prueft erst Wochenlast und Garmin-Auswirkung, bevor etwas gespeichert wird.'
        : 'TrainNow vorbereitet: Prüfe erst die Auswirkungen auf Plan und Garmin, bevor Pulse die Einheit speichert.');
    });
    void runAutoPreview(request);
  }, [activityTypeParam, archetypeParam, descriptionParam, durationParam, entrySource, isQuickScenarioEntry, previewScenarioMutateAsync, scenarioParam, searchKey, today, zoneParam]);

  useEffect(() => {
    if (reviewRequest.seq <= 0) return;
    queueMicrotask(() => {
      setMode(reviewRequest.mode);
      setPreview(null);
      setError(null);
      setApplyError(null);
      setReviewHint(reviewRequest.mode === 'move'
        ? 'Adaptions-Check vorbereitet: Verschieben prueft, ob die naechste offene Einheit sinnvoller auf einen anderen verfuegbaren Tag passt.'
        : 'Adaptions-Check vorbereitet: Umfang senken prueft, ob die naechsten Workouts nach verpassten oder anders ausgefuehrten Einheiten defensiver werden sollten.');
    });
  }, [reviewRequest.mode, reviewRequest.seq]);

  function scenario(): PulsePlanScenarioRequest {
    if (mode === 'move' && nextWorkout) {
      return { type: 'move_workout', workoutId: nextWorkout.id, targetDate: moveDate };
    }
    if (mode === 'reduce') {
      return { type: 'reduce_volume', factor: reduceFactor / 100 };
    }
    if (mode === 'availability') {
      return {
        type: 'change_availability',
        weekStart: weekStartForDate(today),
        availableDays,
      };
    }
    const distanceKm = Number(tourDistance.replace(',', '.'));
    const expectedSpeedKmh = Number(tourSpeed.replace(',', '.'));
    const durationMin = Number(workoutDuration.replace(',', '.'));
    return {
      type: 'add_custom_tour',
      workout: {
        plannedDate: tourDate,
        activityType: workoutActivityType,
        zone: workoutZone,
        durationMin: Number.isFinite(durationMin) && durationMin > 0 ? Math.round(durationMin) : undefined,
        distanceKm: Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : null,
        expectedSpeedKmh: Number.isFinite(expectedSpeedKmh) && expectedSpeedKmh > 0 ? expectedSpeedKmh : null,
        description: tourDescription.trim() || null,
        archetypeId: workoutArchetypeId,
      },
    };
  }

  async function handlePreview(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setApplyError(null);
    try {
      const result = await previewScenarioMutateAsync(scenario());
      setPreview(result.preview);
    } catch (err) {
      setError(errorMessage(err, 'Die Vorschau konnte nicht berechnet werden.'));
    }
  }

  async function handleApply() {
    if (!preview) return;
    setApplyError(null);
    try {
      if (mode === 'tour') {
        const sc = scenario();
        if (sc.type !== 'add_custom_tour') return;
        const result = await createWorkout.mutateAsync({
          plannedDate: sc.workout.plannedDate,
          activityType: sc.workout.activityType,
          zone: sc.workout.zone ?? 2,
          durationMin: sc.workout.durationMin ?? undefined,
          distanceKm: sc.workout.distanceKm ?? undefined,
          expectedSpeedKmh: sc.workout.expectedSpeedKmh ?? undefined,
          description: sc.workout.description ?? undefined,
          archetypeId: sc.workout.archetypeId ?? undefined,
          syncGarmin: true,
          userLocked: true,
        });
        onApplied(result.workout, garminSyncNotice(result.garminSync, 'Die Einheit ist in Pulse gespeichert'));
      } else if (mode === 'move' && nextWorkout) {
        const result = await updateWorkout.mutateAsync({
          id: nextWorkout.id,
          data: { plannedDate: moveDate },
        });
        onApplied(result.workout, garminSyncNotice(result.garminSync, 'Die Planänderung ist in Pulse gespeichert'));
      } else if (mode === 'reduce') {
        const factor = reduceFactor / 100;
        const results = await Promise.all(activeFutureWorkouts
          .filter(workout => !workout.userLocked)
          .map(workout => updateWorkout.mutateAsync({
            id: workout.id,
            data: { durationMin: roundToFive(workout.durationMin * factor) },
          })));
        const notice = results
          .map(result => garminSyncNotice(result.garminSync, 'Die Planänderung ist in Pulse gespeichert'))
          .find((item): item is PlanMutationNotice => item != null) ?? null;
        onApplied(null, notice);
      }
      setPreview(null);
    } catch (err) {
      setApplyError(errorMessage(err, 'Die Vorschau konnte nicht angewendet werden.'));
    }
  }

  function renderPreviewActions() {
    if (!preview) return null;
    const applyEnabled = preview.applySupported && mode !== 'availability';
    const actionActive = applyEnabled && !pending;
    const applyLabel = mode === 'availability'
      ? 'Im Verfügbarkeitsbereich speichern'
      : applyPending
      ? '● Wende an…'
      : previewPending
      ? 'Vorschau prüft…'
      : 'Vorschau anwenden';
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(96px, auto)', gap: 8 }}>
        <button
          type="button"
          onClick={() => { void handleApply(); }}
          disabled={pending || !applyEnabled}
          style={{
            minHeight: 44,
            minWidth: 44,
            background: actionActive ? 'var(--accent)' : 'var(--surface-2)',
            color: actionActive ? 'var(--bg)' : 'var(--text-3)',
            border: actionActive ? 'none' : '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            cursor: actionActive ? 'pointer' : 'default',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {applyLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            setPreview(null);
            setApplyError(null);
          }}
          style={{
            minHeight: 44,
            minWidth: 44,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-2)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Abbrechen
        </button>
      </div>
    );
  }

  const previewResult = preview ? (
    <div style={{ marginTop: 12, display: 'grid', gap: 10 }} data-testid="plan-scenario-preview-result">
      <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{preview.summary}</div>
      <div
        data-testid="scenario-result-contract"
        style={{
          display: 'grid',
          gap: 6,
          border: '1px solid rgba(94,230,207,0.22)',
          borderRadius: 6,
          background: 'rgba(94,230,207,0.05)',
          padding: '9px 10px',
        }}
      >
        <div style={{ display: 'grid', gap: 2 }}>
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--accent)' }}>Nach Apply</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.4 }}>
            {preview.garminImpact?.summary ?? (preview.applySupported ? 'Pulse speichert die Änderung erst nach bewusstem Anwenden.' : 'Keine Plan- oder Garmin-Änderung.')}
          </span>
        </div>
        <div style={{ display: 'grid', gap: 2 }}>
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--accent)' }}>Sicherste Entscheidung</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.4 }}>
            {preview.warnings.length > 0
              ? 'Warnungen zuerst lesen; nur anwenden, wenn die Einheit heute noch zu Körpergefühl, Zeit und Fueling passt.'
              : 'Anwenden nur, wenn sich die Option nach Warm-up, Tagesgefühl und Zeitfenster weiterhin passend anfühlt.'}
          </span>
        </div>
      </div>
      {isQuickScenarioEntry && renderPreviewActions()}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(116px, 1fr))', gap: 6 }}>
        {[
          ['TSS', `${preview.loadImpact.tssDelta >= 0 ? '+' : ''}${preview.loadImpact.tssDelta}`],
          ['Dauer', `${preview.loadImpact.durationDeltaMin >= 0 ? '+' : ''}${preview.loadImpact.durationDeltaMin} min`],
          ['Recovery', preview.loadImpact.nextDayRecoveryDate ?? 'kein extra Tag'],
        ].map(([label, value]) => (
          <div key={label} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: 9 }}>
            <div className="label-mono" style={{ fontSize: 8, color: 'var(--text-3)' }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', marginTop: 4 }}>{value}</div>
          </div>
        ))}
        <span
          className="chip"
          data-testid="scenario-garmin-impact"
          style={{
            display: 'grid',
            alignContent: 'center',
            minHeight: 48,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: 9,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: preview.applySupported ? 'var(--accent)' : 'var(--text-3)',
            lineHeight: 1.35,
          }}
        >
          {preview.garminImpact?.summary ?? `Garmin: ${preview.applySupported ? 'nach Apply synchronisierbar' : 'keine Aenderung'}`}
        </span>
      </div>
      {affectedWorkouts.length > 0 && (
        <div style={{ display: 'grid', gap: 7 }}>
          <div className="label-mono" style={{ color: 'var(--accent)' }}>Betroffene Einheiten</div>
          {affectedWorkouts.map(workout => (
            <div
              key={workout.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(72px, auto)',
                gap: 8,
                alignItems: 'center',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${workout.tone}`,
                borderRadius: 4,
                padding: '8px 9px',
                background: 'var(--surface-2)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{workout.title}</div>
                <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4 }}>{workout.detail}</div>
                {workout.fitLine && (
                  <div style={{ marginTop: 5, fontSize: 10.5, color: 'var(--text-2)', lineHeight: 1.4 }}>
                    <span className="label-mono" style={{ color: 'var(--accent)', marginRight: 5 }}>Athlete-Level</span>
                    <span>{workout.fitLine}</span>
                    {workout.fitDetail && (
                      <span style={{ display: 'block', marginTop: 2, color: 'var(--text-3)' }}>{workout.fitDetail}</span>
                    )}
                  </div>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)', textAlign: 'right', lineHeight: 1.55 }}>
                <div>{workout.durationLine}</div>
                <div>{workout.tssLine}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {preview.changedDays.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {preview.changedDays.slice(0, 5).map(day => (
            <div key={day.date} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, border: '1px solid var(--border)', borderRadius: 4, padding: '7px 8px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)' }}>{day.date}</span>
              <span style={{ fontSize: 11, color: 'var(--text)' }}>{day.label}</span>
            </div>
          ))}
        </div>
      )}
      {preview.reasons.length > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.55 }}>
          {preview.reasons.slice(0, 3).map(reason => <div key={reason}>- {reason}</div>)}
        </div>
      )}
      {preview.warnings.map(warning => (
        <div key={warning} style={{ fontSize: 11.5, color: 'var(--amber)', lineHeight: 1.5 }}>
          {warning}
        </div>
      ))}
      {applyError && <InlineFeedback title="Szenario nicht angewendet" message={applyError} />}
      {!isQuickScenarioEntry && renderPreviewActions()}
    </div>
  ) : null;

  return (
    <section id="plan-scenario-preview" tabIndex={-1} className="card evidence-section" data-testid="plan-scenario-preview-card" style={{ borderColor: 'rgba(94,230,207,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 12 }}>
        <div>
          <div className="label-mono" style={{ color: 'var(--accent)', marginBottom: 5 }}>Szenario-Vorschau</div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Erst Auswirkungen prüfen, dann bewusst anwenden. Die Vorschau schreibt nichts in Plan oder Garmin.
          </p>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          Preview-only
        </span>
      </div>

      {entrySource === 'data-load' && (
        <p
          data-testid="plan-scenario-entry-context"
          style={{
            margin: '0 0 10px',
            padding: '8px 10px',
            border: '1px solid rgba(94,230,207,0.24)',
            borderRadius: 5,
            background: 'rgba(94,230,207,0.07)',
            color: 'var(--text-2)',
            fontSize: 11.5,
            lineHeight: 1.45,
          }}
        >
          Aus Data geöffnet: Prüfe hier, ob Readiness, TSB und Plan-/Load-Evidenz eine konkrete Planänderung rechtfertigen.
        </p>
      )}
      {entrySource === 'today-options' && (
        <p
          data-testid="plan-scenario-entry-context"
          style={{
            margin: '0 0 10px',
            padding: '8px 10px',
            border: '1px solid rgba(94,230,207,0.24)',
            borderRadius: 5,
            background: 'rgba(94,230,207,0.07)',
            color: 'var(--text-2)',
            fontSize: 11.5,
            lineHeight: 1.45,
          }}
        >
          Aus TrainNow geöffnet: Prüfe hier zuerst Planlast, Recovery und Garmin-Auswirkung, bevor Pulse die Einheit speichert.
        </p>
      )}
      {entrySource === 'mobile-intent' && (
        <p
          data-testid="plan-scenario-entry-context"
          style={{
            margin: '0 0 10px',
            padding: '8px 10px',
            border: '1px solid rgba(94,230,207,0.24)',
            borderRadius: 5,
            background: 'rgba(94,230,207,0.07)',
            color: 'var(--text-2)',
            fontSize: 11.5,
            lineHeight: 1.45,
          }}
        >
          Mobile Quick Decision: Prüfe hier zuerst Planlast, Recovery und Garmin-Auswirkung. Pulse schreibt erst nach dem Anwenden.
        </p>
      )}

      {isQuickScenarioEntry && previewResult}

      <form onSubmit={handlePreview} style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          {[
            ['tour', 'Eigene Einheit'],
            ['move', 'Verschieben'],
            ['reduce', 'Umfang senken'],
            ['availability', 'Verfügbarkeit'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id as typeof mode);
                setPreview(null);
                setReviewHint(null);
              }}
              style={{
                minHeight: 44,
                minWidth: 44,
                border: `1px solid ${mode === id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                background: mode === id ? 'rgba(94,230,207,0.08)' : 'var(--surface-2)',
                color: mode === id ? 'var(--accent)' : 'var(--text-2)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: 0,
                textTransform: 'uppercase',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {reviewHint && (
          <p
            data-testid="plan-scenario-review-hint"
            style={{
              margin: 0,
              padding: '8px 10px',
              border: '1px solid rgba(245,158,11,0.28)',
              borderRadius: 5,
              background: 'rgba(245,158,11,0.08)',
              color: 'var(--text-2)',
              fontSize: 11.5,
              lineHeight: 1.45,
            }}
          >
            {reviewHint}
          </p>
        )}

        {mode === 'tour' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
              Sportart
              <select value={workoutActivityType} onChange={e => { setWorkoutActivityType(e.target.value as PulseActivityType); setWorkoutArchetypeId(null); }} style={fieldStyle}>
                {CUSTOM_ACTIVITY_TYPES.map(type => (
                  <option key={type} value={type}>{ACTIVITY_LABEL[type] ?? type}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
              Zone
              <select value={String(workoutZone)} onChange={e => { setWorkoutZone(Number(e.target.value)); setWorkoutArchetypeId(null); }} style={fieldStyle}>
                {[1, 2, 3, 4, 5].map(zone => (
                  <option key={zone} value={zone}>Z{zone}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
              Datum
              <input type="date" value={tourDate} onChange={e => setTourDate(e.target.value)} style={fieldStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
              Dauer min
              <input inputMode="numeric" value={workoutDuration} onChange={e => { setWorkoutDuration(e.target.value); setWorkoutArchetypeId(null); }} placeholder="optional" style={fieldStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
              km optional
              <input inputMode="decimal" value={tourDistance} onChange={e => setTourDistance(e.target.value)} style={fieldStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
              km/h optional
              <input inputMode="decimal" value={tourSpeed} onChange={e => setTourSpeed(e.target.value)} style={fieldStyle} />
            </label>
          </div>
        )}

        {mode === 'tour' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
            Notiz
            <textarea value={tourDescription} onChange={e => setTourDescription(e.target.value)} rows={2} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </label>
        )}

        {mode === 'move' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
              {nextWorkout
                ? `${ACTIVITY_LABEL[nextWorkout.activityType] ?? nextWorkout.activityType} · ${nextWorkout.plannedDate} · Z${nextWorkout.zone} · ${nextWorkout.durationMin} min`
                : 'Kein offenes Workout zum Verschieben gefunden.'}
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
              Neues Datum
              <input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} style={fieldStyle} disabled={!nextWorkout} />
            </label>
          </div>
        )}

        {mode === 'reduce' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
            Nicht gesperrte Zukunfts-Workouts auf {reduceFactor}%
            <input type="range" min={50} max={95} step={5} value={reduceFactor} onChange={e => setReduceFactor(Number(e.target.value))} />
          </label>
        )}

        {mode === 'availability' && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Aktuelle Woche: {availableDays.map(day => DAY_SHORT[day]).join('/') || 'keine Tage'}. Diese Vorschau zeigt nur die Annahme; Speichern bleibt im Verfügbarkeitsbereich.
          </p>
        )}

        <button type="submit" disabled={pending || (mode === 'move' && !nextWorkout)} style={{
          minHeight: 44,
          minWidth: 44,
          background: 'var(--surface-2)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)',
          color: 'var(--accent)',
          cursor: pending ? 'wait' : 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          {previewScenario.isPending ? '● Prüfe…' : 'Szenario prüfen'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: 10 }}>
          <InlineFeedback title="Vorschau nicht erstellt" message={error} actionLabel="Erneut versuchen" onAction={() => { void handlePreview(); }} />
        </div>
      )}

      {!isQuickScenarioEntry && previewResult}
    </section>
  );
}

function PlanAdaptationReviewCard({
  signals,
  onReview,
  onKeep,
}: {
  signals: PlanAdaptationSignal[];
  onReview: (mode?: AdaptationScenarioMode) => void;
  onKeep: () => void;
}) {
  if (signals.length === 0) return null;

  return (
    <section
      id="plan-adaptation-review"
      tabIndex={-1}
      className="card evidence-section"
      data-testid="plan-adaptation-review"
      style={{ borderColor: 'rgba(245,158,11,0.22)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
        <span className="label-mono" style={{ color: 'var(--amber)' }}>Adaptions-Check</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          {signals.length} Signal(e)
        </span>
      </div>
      <h2 style={{ fontSize: 15, color: 'var(--text)', margin: '0 0 6px', fontWeight: 600 }}>
        Plan nach Garmin-Ausführung prüfen
      </h2>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
        Pulse hat Abweichungen zwischen Plan und echter Ausführung gefunden. Prüfe erst die Auswirkungen, bevor du den Wochenplan anpasst.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8, marginTop: 12 }}>
        {signals.map(signal => (
          <div key={signal.id} style={{ border: `1px solid ${translucent(signal.color, 32)}`, borderRadius: 5, padding: '9px 10px', background: 'var(--surface)' }}>
            <div className="label-mono" style={{ fontSize: 9, color: signal.color, marginBottom: 6 }}>
              {signal.title}
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45 }}>
              {signal.detail}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <button
          type="button"
          onClick={() => onReview('reduce')}
          style={{
            minHeight: 42,
            minWidth: 44,
            padding: '8px 12px',
            background: 'var(--surface-2)',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--radius)',
            color: 'var(--amber)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: 0,
            textTransform: 'uppercase',
          }}
        >
          Szenario prüfen
        </button>
        <button
          type="button"
          onClick={onKeep}
          style={{
            minHeight: 42,
            minWidth: 44,
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-2)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: 0,
            textTransform: 'uppercase',
          }}
        >
          Plan beibehalten
        </button>
      </div>
    </section>
  );
}

function adaptationEventTone(event: PulseAdaptationEvent): string {
  if (event.severity === 'action') return 'var(--amber)';
  if (event.severity === 'watch') return 'var(--accent)';
  return 'var(--green)';
}

function adaptationEventAction(event: PulseAdaptationEvent): { label: string; target: 'settings' | 'scenario' | 'data' | 'plan' } {
  if (event.recommendation === 'sync_garmin') return { label: 'Garmin öffnen', target: 'settings' };
  if (event.recommendation === 'log_feedback') return { label: 'Feedback öffnen', target: 'data' };
  if (event.recommendation === 'keep_plan') return { label: 'Plan beibehalten', target: 'plan' };
  return { label: 'Szenario prüfen', target: 'scenario' };
}

function PlanAdaptationEventsCard({
  events,
  onReview,
  onNavigate,
}: {
  events: PulseAdaptationEvent[];
  onReview: (mode?: AdaptationScenarioMode) => void;
  onNavigate: (path: string) => void;
}) {
  if (events.length === 0) return null;
  const sorted = [...events].sort((a, b) => {
    const rank = (event: PulseAdaptationEvent) => event.severity === 'action' ? 3 : event.severity === 'watch' ? 2 : 1;
    return rank(b) - rank(a) || b.createdAt.localeCompare(a.createdAt);
  });

  function handleAction(event: PulseAdaptationEvent) {
    const action = adaptationEventAction(event);
    if (action.target === 'settings') {
      onNavigate('/settings?section=garmin');
      return;
    }
    if (action.target === 'data') {
      onNavigate('/data?tab=activities');
      return;
    }
    if (action.target === 'scenario') {
      onReview(event.recommendation === 'move_workout' ? 'move' : 'reduce');
    }
  }

  return (
    <section className="card" data-testid="plan-adaptation-events" style={{ borderColor: 'rgba(94,230,207,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span className="label-mono" style={{ color: 'var(--accent)' }}>Adaptionshinweise</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          {sorted.length} offen
        </span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {sorted.slice(0, 4).map(event => {
          const tone = adaptationEventTone(event);
          const action = adaptationEventAction(event);
          return (
            <div key={event.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center', border: `1px solid ${translucent(tone, 28)}`, borderRadius: 5, padding: '9px 10px', background: 'var(--surface)' }}>
              <div style={{ minWidth: 0 }}>
                <div className="label-mono" style={{ fontSize: 9, color: tone, marginBottom: 5 }}>
                  {event.kind.replaceAll('_', ' ')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, lineHeight: 1.35 }}>
                  {event.summary}
                </div>
                {event.evidence.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45 }}>
                    {event.evidence.slice(0, 2).join(' · ')}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleAction(event)}
                style={{
                  minHeight: 42,
                  minWidth: 44,
                  padding: '8px 10px',
                  background: 'var(--surface-2)',
                  border: `1px solid ${tone}`,
                  borderRadius: 'var(--radius)',
                  color: tone,
                  cursor: action.target === 'plan' ? 'default' : 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: 0,
                  textTransform: 'uppercase',
                }}
              >
                {action.label}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Training Tab ─────────────────────────────────────────────────────────────

function TrainingTab({ entrySource }: { entrySource: string | null }) {
  const acts      = usePulseActivities(14);
  const plan      = usePulsePlan();
  const goals     = usePulseGoals();
  const checkinToday = useCheckinToday();
  const checkinHistory = useCheckinHistory(7);
  const raceCommand = useRaceCommand();
  const seasonStrategy = useSeasonStrategy();
  const goalProjection = useGoalProjection(180);
  const todayOptions = useTodayOptions();
  const fitnessLoad = useFitnessLoad();
  const availability = useWeekAvailability();
  const adaptationEvents = useAdaptationEvents();
  const generate  = useGeneratePlan();
  const navigate  = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [showCustomWorkout, setShowCustomWorkout] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<PlannedWorkout | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [planNotice, setPlanNotice] = useState<PlanMutationNotice | null>(null);
  const [adaptationDismissed, setAdaptationDismissed] = useState(false);
  const [dismissedAdaptationEventIds, setDismissedAdaptationEventIds] = useState<Set<string>>(() => new Set());
  const [scenarioReviewRequest, setScenarioReviewRequest] = useState<{ seq: number; mode: AdaptationScenarioMode }>({ seq: 0, mode: 'reduce' });

  const selectedWeekDate = getMonday(new Date());
  selectedWeekDate.setDate(selectedWeekDate.getDate() + weekOffset * 7);
  const selectedWeekStart = isoDate(selectedWeekDate);
  const traceQuery = usePlanTrace(selectedWeekStart);
  const workouts   = plan.data?.workouts ?? [];
  const activities = acts.data?.activities ?? [];
  const generatedTrace = generate.data?.planTrace ?? null;
  const generatedTraceForSelectedWeek = generatedTrace?.weekStart === selectedWeekStart ? generatedTrace : null;
  const planTrace = generatedTraceForSelectedWeek ?? traceQuery.data?.trace ?? null;
  const planDecision = planTrace?.planDecision
    ?? (generatedTraceForSelectedWeek ? generate.data?.planDecision : undefined);
  const weekAvailability = availability.data?.weeks.find(w => w.weekStart === selectedWeekStart);
  const availableDays = weekAvailability?.availableDays ?? [0, 2, 4, 5];
  const weeklyHours = weekAvailability?.weeklyHours ?? planTrace?.inputSnapshot.weeklyHoursTarget ?? 8;
  const activeGoals = goals.data?.goals.filter(goal => goal.status === 'active') ?? [];
  const today = isoDateLocal(new Date());
  const nextDecisionWorkout = getNextOpenWorkout(workouts, today);
  const decisionWeekStart = nextDecisionWorkout ? weekStartForDate(nextDecisionWorkout.plannedDate) : selectedWeekStart;
  const decisionAvailability = availability.data?.weeks.find(w => w.weekStart === decisionWeekStart);
  const decisionAvailableDays = decisionAvailability?.availableDays
    ?? (decisionWeekStart === selectedWeekStart ? availableDays : []);
  const decisionPlanTrace = decisionWeekStart === selectedWeekStart ? planTrace : null;
  const refreshPreviewQuery = usePlanRefreshPreview(selectedWeekStart);
  const refreshPreview = refreshPreviewQuery.data?.preview ?? null;
  const todayCheckinDate = checkinToday.data?.checkin?.date ?? today;
  const todayMentalCheckin = checkinToday.data?.checkin
    ? checkinHistory.data?.checkins.find(checkin => checkin.date === todayCheckinDate) ?? null
    : null;
  const currentMentalImpact = todayMentalCheckin ? mentalImpact(todayMentalCheckin) : null;
  const mentalPlanImpact = currentMentalImpact && currentMentalImpact.level !== 'stable'
    ? currentMentalImpact.labels.planImpact
    : null;
  const constraintChips = [
    `Verfügbarkeit: ${availableDays.map(day => DAY_SHORT[day]).join('/') || 'keine Tage'}`,
    `Umfang: ${weeklyHours} h`,
    planTrace ? `Phase: ${planTrace.inputSnapshot.phase}` : 'Phase: aus Profil',
    activeGoals.length > 0 ? `Ziele: ${activeGoals.length} aktiv` : 'Ziele: keine aktiven',
    planTrace?.inputSnapshot.riskSignals.length ? `Risiko: ${planTrace.inputSnapshot.riskSignals.length} Signal(e)` : 'Risiko: wird geprüft',
  ];
  const strengthWorkout = workouts.find(w =>
    w.activityType === 'strength'
    && w.status !== 'completed'
    && w.plannedDate >= today,
  ) ?? null;
  const adaptationSignals = adaptationDismissed
    ? []
    : buildPlanAdaptationSignals(workouts, planTrace, today);
  const openAdaptationEvents = (adaptationEvents.data?.events ?? [])
    .filter(event => event.severity !== 'info' && !dismissedAdaptationEventIds.has(event.id));
  const planChangeInbox = buildPlanChangeInbox({
    today,
    workouts,
    adaptationEvents: openAdaptationEvents,
    refreshPreview,
  });

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerateError(null);
    setPlanNotice(null);
    try {
      await generate.mutateAsync();
      setShowConfig(false);
    } catch (err) {
      setGenerateError(errorMessage(err, 'Der Trainingsplan konnte nicht erstellt werden.'));
    }
  }

  function openWorkout(workout: PlannedWorkout) {
    setPlanNotice(null);
    setSelectedWorkout(workout);
  }

  function closeWorkout() {
    setSelectedWorkout(null);
    setPlanNotice(null);
  }

  function reviewAdaptations(mode: AdaptationScenarioMode = 'reduce') {
    setScenarioReviewRequest(request => ({ seq: request.seq + 1, mode }));
    const target = document.querySelector<HTMLElement>('[data-testid="plan-scenario-preview-card"]');
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
  }

  function openRefreshPreview() {
    const target = document.querySelector<HTMLElement>('[data-testid="plan-refresh-preview-card"]');
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
  }

  useEffect(() => {
    if (entrySource !== 'today-change') return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById('next-training-decision');
      if (!target) return;
      target.scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [entrySource, nextDecisionWorkout?.id, todayOptions.data?.todayOptions.state]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <NextTrainingDecisionCard
        nextWorkout={nextDecisionWorkout}
        availableDays={decisionAvailableDays}
        activeGoalsCount={activeGoals.length}
        currentLoad={fitnessLoad.data ?? null}
        planTrace={decisionPlanTrace}
        mentalPlanImpact={mentalPlanImpact}
        todayOptionsState={todayOptions.data?.todayOptions.state ?? null}
        onNavigate={navigate}
        onOpen={openWorkout}
        onOpenCustom={() => setShowCustomWorkout(true)}
        onOpenAvailability={() => setShowAvailability(true)}
        onOpenGenerator={() => setShowConfig(true)}
      />

      <TodayOptionsCard
        variant="full"
        onNavigate={navigate}
        showPlanActionContract={!nextDecisionWorkout && todayOptions.data?.todayOptions.state === 'planned_workout'}
      />

      <PlanChangeInboxCard
        today={today}
        workouts={workouts}
        adaptationEvents={openAdaptationEvents}
        refreshPreview={refreshPreview}
        onOpenRefreshPreview={openRefreshPreview}
        onReviewScenario={reviewAdaptations}
        onNavigate={navigate}
        onKeep={(itemId) => {
          if (itemId.startsWith('adaptation-')) {
            const eventId = itemId.slice('adaptation-'.length);
            setDismissedAdaptationEventIds(previous => {
              const next = new Set(previous);
              next.add(eventId);
              return next;
            });
          }
          setAdaptationDismissed(true);
        }}
      />

      {planChangeInbox.items.length === 0 && (
        <PlanGarminSyncDebtCard workouts={workouts} today={today} onNavigate={navigate} />
      )}

      {planChangeInbox.items.length === 0 && (
        <PlanAdaptationEventsCard
          events={openAdaptationEvents}
          onReview={reviewAdaptations}
          onNavigate={navigate}
        />
      )}

      {/* WeekStrip */}
      <WeekStrip
        workouts={workouts}
        weekOffset={weekOffset}
        onChangeWeek={d => setWeekOffset(o => o + d)}
        onSelectWorkout={openWorkout}
      />

      <PlanRefreshPreviewCard weekStart={selectedWeekStart} />

      <PlanAdaptationReviewCard
        signals={adaptationSignals}
        onReview={reviewAdaptations}
        onKeep={() => setAdaptationDismissed(true)}
      />

      <RaceCommandCard
        command={raceCommand.data?.command ?? null}
        isLoading={raceCommand.isLoading}
      />

      <AdaptiveSeasonContractCard
        strategy={seasonStrategy.data?.strategy ?? planTrace?.inputSnapshot.seasonStrategy ?? null}
        goalProjection={goalProjection.data ?? null}
        isLoading={seasonStrategy.isLoading || goalProjection.isLoading}
      />

      <SeasonStrategyCard
        strategy={seasonStrategy.data?.strategy ?? planTrace?.inputSnapshot.seasonStrategy ?? null}
        isLoading={seasonStrategy.isLoading}
      />

      <PlanLimiterWorkoutSummary
        workouts={workouts}
        goalLimiter={planTrace?.inputSnapshot.goalLimiter ?? null}
      />

      <PlanScenarioPreviewCard
        workouts={workouts}
        nextWorkout={nextDecisionWorkout}
        availableDays={decisionAvailableDays}
        reviewRequest={scenarioReviewRequest}
        entrySource={entrySource}
        onApplied={(workout, notice) => {
          setPlanNotice(notice);
          setSelectedWorkout(null);
          const next = new URLSearchParams();
          next.set('tab', 'execution');
          next.set('source', notice?.tone === 'warning' || !workout ? 'plan-apply-attention' : 'plan-apply');
          navigate({ pathname: '/plan', search: `?${next.toString()}` });
        }}
      />

      {planNotice && !selectedWorkout && (
        <InlineFeedback title={planNotice.title} message={planNotice.message} tone={planNotice.tone} />
      )}

      {/* Availability */}
      <AvailabilityEditor open={showAvailability} onOpenChange={setShowAvailability} />

      {/* Plan-Generator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="label-mono">Trainingsplan</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowCustomWorkout(v => !v)}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: showCustomWorkout ? 'var(--rose)' : 'var(--accent)', cursor: 'pointer',
            }}
          >
            {showCustomWorkout ? 'Abbrechen' : '+ Einheit'}
          </button>
          <button
            onClick={() => setShowConfig(v => !v)}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: showConfig ? 'var(--rose)' : 'var(--text-3)', cursor: 'pointer',
            }}
          >
            {showConfig ? 'Abbrechen' : '+ Plan generieren'}
          </button>
        </div>
      </div>

      {showCustomWorkout && (
        <CustomWorkoutForm
          onCancel={() => setShowCustomWorkout(false)}
          onCreated={(workout, notice) => {
            setShowCustomWorkout(false);
            setPlanNotice(notice);
            setSelectedWorkout(workout);
          }}
        />
      )}

      {showConfig && (
        <div className="card" style={{ borderColor: 'rgba(94,230,207,0.2)' }}>
          <div className="label-mono" style={{ marginBottom: 8, color: 'var(--accent)' }}>Plan generieren</div>
          <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6, margin: '0 0 12px' }}>
            Erstellt einen wissenschaftlich fundierten Wochenplan auf Basis von CTL/ATL/TSB, deiner eingetragenen Verfügbarkeit und aktiven Zielen.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {constraintChips.map(chip => (
              <span key={chip} style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-2)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '4px 7px',
              }}>
                {chip}
              </span>
            ))}
          </div>
          <button onClick={() => void handleGenerate({ preventDefault: () => {} } as React.FormEvent)} disabled={generate.isPending} style={{
            width: '100%', background: 'var(--surface-2)', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius)', padding: '9px', fontFamily: 'var(--font-mono)',
            fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--accent)', cursor: 'pointer',
          }}>
            {generate.isPending ? '● Generiere…' : 'Plan erstellen'}
          </button>
          {generateError && (
            <div style={{ marginTop: 10 }}>
              <InlineFeedback
                title="Plan nicht erstellt"
                message={generateError}
                actionLabel="Erneut versuchen"
                actionPending={generate.isPending}
                onAction={() => { void handleGenerate({ preventDefault: () => {} } as React.FormEvent); }}
              />
            </div>
          )}
        </div>
      )}

      {planDecision && (
        <PlanDecisionCard decision={planDecision} dayLabels={DAY_SHORT} />
      )}

      <PlanTraceCard trace={planTrace} isLoading={traceQuery.isLoading} />

      {plan.isLoading && <Loading />}
      {!plan.isLoading && workouts.length === 0 && !showConfig && (
        <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '4px 0' }}>
          Kein Plan — "Plan generieren" für KI-Vorschlag.
        </p>
      )}

      {workouts.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {workouts.map((w, i) => (
            <WorkoutRow key={w.id} workout={w} index={i} onOpen={() => openWorkout(w)} />
          ))}
        </div>
      )}

      <div className="label-mono" style={{ marginTop: 2 }}>Tools</div>
      <StrengthLogger key={strengthWorkout?.id ?? 'free'} plannedWorkout={strengthWorkout} />

      {/* Activities */}
      <div className="label-mono" style={{ marginTop: 4 }}>Aktivitäten — 14 Tage</div>
      {acts.isLoading && <Loading rows={2} />}
      {!acts.isLoading && activities.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Noch keine Aktivitäten.</p>
      )}
      {activities.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Aktivität','Datum','Dauer','km','TSS'].map(h => (
                  <th key={h} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: 'var(--text-3)', fontWeight: 400, padding: '6px 12px',
                    textAlign: h === 'Aktivität' ? 'left' : 'right',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activities.map((a, i) => (
                <tr key={a.id}
                  style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: 0, fontSize: 12, color: 'var(--text)' }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/plan/activity/${a.id}`)}
                      aria-label={`${a.name ?? a.activityType} Aktivität öffnen`}
                      style={{
                        width: '100%',
                        minHeight: 44,
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        font: 'inherit',
                      }}
                    >
                      {a.name ?? a.activityType}
                    </button>
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textAlign: 'right' }}>
                    {new Date(a.startTime).toLocaleDateString('de')}
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>
                    {a.durationSec ? `${Math.round(a.durationSec / 60)}m` : '–'}
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>
                    {a.distanceM ? (a.distanceM / 1000).toFixed(1) : '–'}
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
                    {a.tss ? fmt(a.tss, 0) : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedWorkout && (
        <WorkoutDetailModal
          workout={selectedWorkout}
          notice={planNotice ?? undefined}
          onClose={closeWorkout}
          onUpdate={updated => setSelectedWorkout(updated)}
        />
      )}
    </div>
  );
}

// ─── Ziele ────────────────────────────────────────────────────────────────────

function ZieleTab() {
  const { data, isLoading } = usePulseGoals();
  const [showForm, setShowForm] = useState(false);
  const goals = data?.goals ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {showForm && <GoalForm onDone={() => setShowForm(false)} />}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: goals.length > 0 ? 4 : 0 }}>
          <span className="label-mono">GOALS</span>
          <button onClick={() => setShowForm(v => !v)} style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
            padding: '3px 8px', border: `1px solid ${showForm ? 'var(--rose)' : 'var(--accent)'}`,
            borderRadius: 3, background: 'transparent',
            color: showForm ? 'var(--rose)' : 'var(--accent)', cursor: 'pointer',
          }}>
            {showForm ? '✕ Schließen' : '+ Neu'}
          </button>
        </div>

        {isLoading && <Loading rows={2} />}
        {!isLoading && goals.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0', margin: 0 }}>Noch keine Ziele. Erstelle dein erstes!</p>
        )}
        {goals.map(g => <GoalCard key={g.id} g={g} />)}
      </div>
    </div>
  );
}

// ─── Review Tab ───────────────────────────────────────────────────────────────

function ReviewTab() {
  const { data, isLoading } = usePulseReview();
  const generate = useGenerateReview();

  // Parse wins + watch from narrative heuristically
  function extractSections(narrative: string): { wins: string[]; watch: string[]; body: string } {
    const wins: string[] = [];
    const watch: string[] = [];
    const body = narrative;

    // Look for markdown-style lists
    const winMatch  = narrative.match(/#+\s*Highlights?[:\s]*([\s\S]*?)(?=#+|$)/i);
    const watchMatch = narrative.match(/#+\s*Watch[:\s]*([\s\S]*?)(?=#+|$)/i);

    if (winMatch?.[1]) {
      wins.push(...winMatch[1].trim().split('\n').filter(l => l.match(/^[-*•]/)).map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean));
    }
    if (watchMatch?.[1]) {
      watch.push(...watchMatch[1].trim().split('\n').filter(l => l.match(/^[-*•]/)).map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean));
    }

    return { wins, watch, body };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => generate.mutate()} disabled={generate.isPending} style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 10,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-2)', cursor: 'pointer',
        }}>
          {generate.isPending ? '● Erstelle…' : 'Neu erstellen'}
        </button>
      </div>

      {isLoading && <Loading rows={2} />}

      {!isLoading && !data && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Kein Wochenreview. "Neu erstellen" für KI-Analyse.
          </p>
        </div>
      )}

      {data && (() => {
        const { wins, watch, body } = extractSections(data.narrative);
        return (
          <>
            {/* Week header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div className="label-mono">{data.weekStart} — {data.weekEnd}</div>
            </div>

            {/* Wins + Watch (if extracted) */}
            {(wins.length > 0 || watch.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {wins.length > 0 && (
                  <div className="card" style={{ borderColor: 'rgba(74,222,128,0.25)' }}>
                    <div className="label-mono" style={{ color: 'var(--green)', marginBottom: 8 }}>Highlights</div>
                    {wins.map((w, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--text-2)', paddingBottom: 4, lineHeight: 1.5 }}>
                        + {w}
                      </div>
                    ))}
                  </div>
                )}
                {watch.length > 0 && (
                  <div className="card" style={{ borderColor: 'rgba(251,191,36,0.25)' }}>
                    <div className="label-mono" style={{ color: 'var(--amber)', marginBottom: 8 }}>Watch</div>
                    {watch.map((w, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--text-2)', paddingBottom: 4, lineHeight: 1.5 }}>
                        · {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Full narrative */}
            <div className="card">
              <div className="label-mono" style={{ marginBottom: 8 }}>Analyse</div>
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {body}
              </p>
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ─── Statistik ────────────────────────────────────────────────────────────────

const ZONE_FILL: Record<number, string> = {
  1: 'var(--blue)', 2: 'var(--accent)', 3: 'var(--green)', 4: 'var(--amber)', 5: 'var(--rose)',
};

function tssColor(tss: number): string {
  if (tss <= 0)   return 'var(--surface-2)';
  if (tss < 50)   return 'var(--blue)';
  if (tss < 100)  return 'var(--green)';
  if (tss < 150)  return 'var(--amber)';
  return 'var(--rose)';
}
function tssOpacity(tss: number): number {
  if (tss <= 0)  return 1;
  if (tss < 50)  return 0.3 + (tss / 50) * 0.5;
  if (tss < 100) return 0.8 + ((tss - 50) / 50) * 0.2;
  return 1;
}

const WEEK_RANGE_OPTS = [
  { value: 8,  label: '8W'  },
  { value: 12, label: '12W' },
  { value: 24, label: '24W' },
];

function RangePicker({ value, onChange, options }: {
  value: number; onChange: (v: number) => void;
  options: { value: number; label: string }[];
}) {
  return <RangeControl value={value} onChange={onChange} options={options} />;
}

function rpeDriftLabel(drift: number | null): string {
  if (drift == null) return 'noch keine Vergleichsbasis';
  if (drift > 1) return `+${drift.toFixed(1)} vs. Vormonat · Ermüdung`;
  if (drift < -1) return `${drift.toFixed(1)} vs. Vormonat · Anpassung`;
  return `${drift > 0 ? '+' : ''}${drift.toFixed(1)} vs. Vormonat · stabil`;
}

function buildStrengthTrendRows(trends: PulseStrengthTrendPoint[]) {
  const grouped = new Map<string, PulseStrengthTrendPoint[]>();
  for (const point of trends) {
    const list = grouped.get(point.exercise) ?? [];
    list.push(point);
    grouped.set(point.exercise, list);
  }

  return Array.from(grouped.entries())
    .map(([exercise, points]) => {
      const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0]?.e1rmKg ?? null;
      const last = sorted[sorted.length - 1]?.e1rmKg ?? null;
      const deltaPct = first != null && first > 0 && last != null ? ((last - first) / first) * 100 : null;
      return { exercise, first, last, deltaPct };
    })
    .filter(row => row.last != null)
    .sort((a, b) => (b.last ?? 0) - (a.last ?? 0))
    .slice(0, 5);
}

function StrengthStatsCard({
  sessions,
  trends,
  loading,
}: {
  sessions: PulseStrengthSession[];
  trends: PulseStrengthTrendPoint[];
  loading: boolean;
}) {
  if (loading) return <Skeleton height={88} />;

  const since = new Date();
  since.setDate(since.getDate() - 28);
  const sinceDate = isoDateLocal(since);
  const recentSessions = sessions.filter(session => session.date >= sinceDate);
  const totalMin = recentSessions.reduce((sum, session) => sum + (session.durationMin ?? 0), 0);
  const rows = buildStrengthTrendRows(trends);

  if (sessions.length === 0 && rows.length === 0) return null;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span className="label-mono">Strength Volumen</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
          letzte 4 Wochen
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: rows.length > 0 ? 12 : 0 }}>
        {[
          { label: 'Einheiten', value: String(recentSessions.length), detail: `${sessions.length} in 90d` },
          { label: 'Volumen', value: `${(totalMin / 60).toFixed(1)}h`, detail: `${totalMin} min` },
          { label: 'Top Lifts', value: String(rows.length), detail: 'e1RM Verlauf' },
        ].map(item => (
          <div key={item.label} style={{ padding: '10px', background: 'var(--surface)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
              {item.label}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--text)', marginTop: 4 }}>
              {item.value}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>
              {item.detail}
            </div>
          </div>
        ))}
      </div>
      {rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {rows.map(row => (
            <div key={row.exercise} style={{ display: 'grid', gridTemplateColumns: '86px 1fr 68px', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{row.exercise}</span>
              <div style={{ height: 7, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.max(8, ((row.last ?? 0) / Math.max(1, rows[0]?.last ?? 1)) * 100))}%`, background: 'var(--accent)' }} />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: row.deltaPct != null && row.deltaPct < 0 ? 'var(--amber)' : 'var(--green)', textAlign: 'right' }}>
                {row.deltaPct == null ? 'neu' : `${row.deltaPct >= 0 ? '+' : ''}${row.deltaPct.toFixed(1)}%`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatistikTab() {
  const [weeks, setWeeks] = useState(12);
  const { data, isLoading } = useTrainingAnalytics(weeks);
  const strength = useStrengthSessions(90);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[80, 120, 80].map((h, i) => <Skeleton key={i} height={h} />)}
      </div>
    );
  }

  const heatmap  = data?.tssHeatmap       ?? [];
  const zones    = data?.zoneDistribution ?? [];
  const vo2maxRaw = data?.vo2maxTrend     ?? [];
  const rpeByZone = data?.rpeByZone;
  const today    = isoDateLocal(new Date());

  // Build heatmap grid: align to Monday of first week
  const gridStart = new Date();
  const dayOfWeek = gridStart.getDay();
  gridStart.setDate(gridStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - (weeks - 1) * 7);
  const heatMap = new Map(heatmap.map(d => [d.date, d.tss]));
  const cells: Array<{ date: string; tss: number; future: boolean }> = [];
  const cur = new Date(gridStart);
  for (let i = 0; i < weeks * 7; i++) {
    const ds = isoDateLocal(cur);
    cells.push({ date: ds, tss: heatMap.get(ds) ?? 0, future: ds > today });
    cur.setDate(cur.getDate() + 1);
  }

  // Max TSS for tooltip display
  const maxTss = Math.max(...heatmap.map(d => d.tss), 1);

  // Zone stacked bars
  const maxZoneH = Math.max(...zones.map(z => z.totalH), 0.1);
  const totalHours = zones.reduce((sum, w) => sum + w.totalH, 0);
  const lowHours = zones.reduce((sum, w) => sum + w.zones.z1 + w.zones.z2, 0);
  const highHours = Math.max(totalHours - lowHours, 0);
  const avgWeeklyHours = zones.length > 0 ? totalHours / zones.length : 0;
  const lowPct = totalHours > 0 ? Math.round((lowHours / totalHours) * 100) : 0;

  // VO2max trend
  const vo2Labels = vo2maxRaw.map(d => d.date);
  const vo2Values = vo2maxRaw.map(d => d.vo2max);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Week range selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <RangePicker value={weeks} onChange={setWeeks} options={WEEK_RANGE_OPTS} />
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span className="label-mono">Trainingsstatistik</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
            {weeks} Wochen
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          {[
            { label: 'Ø / Woche', value: `${avgWeeklyHours.toFixed(1)}h`, detail: `${totalHours.toFixed(1)}h gesamt` },
            { label: 'Low Intensity', value: `${lowPct}%`, detail: `Z1/Z2 ${lowHours.toFixed(1)}h` },
            { label: 'High Intensity', value: `${highHours.toFixed(1)}h`, detail: 'Z3-Z5 gesamt' },
          ].map(item => (
            <div key={item.label} style={{ padding: '10px', background: 'var(--surface)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
                {item.label}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--text)', marginTop: 4 }}>
                {item.value}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>
                {item.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      <TrainingCapabilityCard summary={data?.capabilitySummary} />

      <StrengthStatsCard
        sessions={strength.data?.sessions ?? []}
        trends={strength.data?.trends ?? []}
        loading={strength.isLoading}
      />

      {/* ── TSS Heatmap ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span className="label-mono">TSS Kalender</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
            max {maxTss} TSS
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 10px)', gap: 2, width: 16 }}>
            {['Mo','','Mi','','Fr','','So'].map((l, i) => (
              <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-3)', lineHeight: '10px' }}>{l}</span>
            ))}
          </div>
          {/* Grid */}
          <div style={{
            flex: 1, display: 'grid',
            gridTemplateRows: 'repeat(7, 10px)',
            gridAutoFlow: 'column',
            gridAutoColumns: '1fr',
            gap: 2,
          }}>
            {cells.map(cell => (
              <div
                key={cell.date}
                title={`${cell.date}: TSS ${cell.tss}`}
                style={{
                  borderRadius: 2,
                  background: cell.future ? 'transparent' : tssColor(cell.tss),
                  opacity: cell.future ? 0 : tssOpacity(cell.tss),
                  outline: cell.date === today ? '1px solid var(--accent)' : 'none',
                  outlineOffset: 1,
                }}
              />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
          {[['<50','var(--blue)'],['50-100','var(--green)'],['100-150','var(--amber)'],['150+','var(--rose)']].map(([label, color]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)' }}>{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Zone Distribution ── */}
      {zones.length > 0 && (
        <div className="card">
          <div style={{ marginBottom: 10 }}>
            <span className="label-mono">Intensitätsverteilung</span>
          </div>

          {/* Stacked bars */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
            {zones.map(w => {
              const totalPct = w.totalH / maxZoneH;
              return (
                <div key={w.weekStart} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column-reverse', height: `${totalPct * 100}%`, minHeight: w.totalH > 0 ? 2 : 0 }}>
                    {([5,4,3,2,1] as const).map(z => {
                      const h = w.zones[`z${z}` as 'z1'|'z2'|'z3'|'z4'|'z5'];
                      if (!h) return null;
                      const hPct = (h / w.totalH) * 100;
                      return (
                        <div key={z} style={{
                          height: `${hPct}%`, minHeight: 2,
                          background: ZONE_FILL[z],
                          borderRadius: z === 5 ? '2px 2px 0 0' : 0,
                        }} title={`Z${z}: ${h}h`} />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Week labels */}
          <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
            {zones.map((w, i) => {
              const show = i === 0 || i === zones.length - 1 || i % Math.ceil(zones.length / 4) === 0;
              const parts = w.weekStart.split('-');
              return (
                <div key={w.weekStart} style={{ flex: 1, textAlign: 'center' }}>
                  {show && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-3)' }}>
                      {parts[2]}.{parts[1]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Zone legend */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {([1,2,3,4,5] as const).map(z => (
              <span key={z} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: ZONE_FILL[z], display: 'inline-block' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)' }}>
                  Z{z}
                </span>
              </span>
            ))}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)', marginLeft: 'auto' }}>
              max {maxZoneH.toFixed(1)}h/Woche
            </span>
          </div>
        </div>
      )}

      {rpeByZone && rpeByZone.totalRated >= 10 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span className="label-mono">RPE vs. Zone</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
              letzte 30 Tage · {rpeByZone.totalRated} Einheiten
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rpeByZone.zones.map(row => {
              const pct = row.avgRpe == null ? 0 : Math.max(0.04, row.avgRpe / 10);
              return (
                <div key={row.zone} style={{ display: 'grid', gridTemplateColumns: '34px 72px 1fr 96px', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: ZONE_FILL[row.zone] }}>Z{row.zone}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}>
                    {row.avgRpe == null ? 'RPE –' : `RPE Ø ${row.avgRpe.toFixed(1)}`}
                  </span>
                  <div style={{ height: 8, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct * 100}%`, background: ZONE_FILL[row.zone] }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', textAlign: 'right' }}>
                    {row.count} {row.count === 1 ? 'Einheit' : 'Einheiten'}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-2)' }}>
            {(() => {
              const strongest = rpeByZone.zones
                .filter(z => z.drift != null)
                .sort((a, b) => Math.abs(b.drift ?? 0) - Math.abs(a.drift ?? 0))[0];
              return strongest
                ? `Drift: Z${strongest.zone} ${rpeDriftLabel(strongest.drift)}.`
                : 'Drift: noch keine belastbare Vergleichsbasis.';
            })()}
          </div>
        </div>
      )}

      {/* ── VO2max Trend ── */}
      {vo2maxRaw.length >= 2 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span className="label-mono">VO2max Trend</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>
              {vo2Values[vo2Values.length - 1]?.toFixed(1)}
            </span>
          </div>
          <LineChart values={vo2Values} labels={vo2Labels} height={72} color="var(--green)" fillOpacity={0.1} />
        </div>
      )}

      {heatmap.length === 0 && zones.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>
          Keine Aktivitätsdaten — Garmin sync.
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'training', label: 'Training' },
  { id: 'ausfuehrung', label: 'Ausführung' },
  { id: 'ziele',    label: 'Ziele'    },
  { id: 'review',   label: 'Review'   },
  { id: 'statistik', label: 'Statistik' },
];

function TabPanel({ tab, children }: { tab: Tab; children: React.ReactNode }) {
  return (
    <section role="tabpanel" id={`plan-${tab}-panel`} aria-labelledby={`plan-${tab}-tab`}>
      {children}
    </section>
  );
}

const TAB_QUERY: Record<Tab, string> = {
  training: 'training',
  ausfuehrung: 'execution',
  ziele: 'goals',
  review: 'review',
  statistik: 'stats',
};

const QUERY_TAB: Record<string, Tab> = {
  training: 'training',
  execution: 'ausfuehrung',
  ausfuehrung: 'ausfuehrung',
  goals: 'ziele',
  ziele: 'ziele',
  review: 'review',
  stats: 'statistik',
  statistik: 'statistik',
};

function tabFromQuery(value: string | null): Tab {
  return value ? QUERY_TAB[value] ?? 'training' : 'training';
}

const HASH_TAB: Record<string, Tab> = {
  'plan-scenario-preview': 'training',
  'plan-adaptation-review': 'training',
};

function hashFromLocation(hash: string): string {
  const value = hash.replace(/^#/, '');
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function Plan() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const searchKey = searchParams.toString();
  const tab = tabFromQuery(searchParams.get('tab'));
  const entrySource = searchParams.get('source');

  function setTab(tabId: string) {
    const nextTab = tabId as Tab;
    const next = new URLSearchParams(searchParams);
    next.set('tab', TAB_QUERY[nextTab]);
    setSearchParams(next);
  }

  useEffect(() => {
    const hash = hashFromLocation(location.hash);
    if (!hash) return;

    const targetTab = HASH_TAB[hash];
    if (targetTab && targetTab !== tab) {
      const next = new URLSearchParams(searchKey);
      next.set('tab', TAB_QUERY[targetTab]);
      navigate({
        pathname: location.pathname,
        search: `?${next.toString()}`,
        hash: location.hash,
      }, { replace: true });
      return;
    }

    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(hash);
      if (!target) return;
      target.scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash, location.pathname, navigate, searchKey, tab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="PLAN"
        title="Training, Ziele & Statistik"
        action={<SegmentedControl items={TABS} active={tab} onChange={setTab} ariaLabel="Plan Bereiche" idPrefix="plan" />}
      />
      {tab === 'training' && <TabPanel tab="training"><TrainingTab entrySource={entrySource} /></TabPanel>}
      {tab === 'ausfuehrung' && (
        <TabPanel tab="ausfuehrung">
          {entrySource?.startsWith('plan-apply') && (
            <InlineFeedback
              title={entrySource === 'plan-apply-attention' ? 'Garmin-Ausführung prüfen' : 'Plan angewendet'}
              message={entrySource === 'plan-apply-attention'
                ? 'Pulse hat die Änderung gespeichert, aber Garmin braucht jetzt Readback oder Reparatur.'
                : 'Pulse lädt jetzt den Garmin-Readback, damit Vorlage, Kalender und Wiederholungen sichtbar geprüft werden.'}
              tone={entrySource === 'plan-apply-attention' ? 'warning' : 'info'}
            />
          )}
          <GarminExecutionTrustPanel />
        </TabPanel>
      )}
      {tab === 'ziele'    && <TabPanel tab="ziele"><ZieleTab /></TabPanel>}
      {tab === 'review'   && <TabPanel tab="review"><ReviewTab /></TabPanel>}
      {tab === 'statistik' && <TabPanel tab="statistik"><StatistikTab /></TabPanel>}
    </div>
  );
}
