import type { ReactNode } from 'react';
import type { PulseActivity, PulseFitnessLoad, PulseHomeScreenData, PulsePlannedWorkout, PulseReadiness } from '@coaching-os/shared/pulse';
import { DailyDecisionCard } from '@/components/DailyDecisionCard';
import { FCard, FPill, StageStrip, WorkoutProfileBars } from '@/components/ui/focus';
import { activityLabel } from '@/pulse/activity-labels';
import type { DailyDecision } from '@/pulse/daily-decision';

type DecisionHeroProps = {
  date: string;
  decision: DailyDecision;
  readiness: PulseReadiness;
  fitnessLoad: PulseFitnessLoad;
  recovery: PulseHomeScreenData['recovery'];
  todayWorkout: PulsePlannedWorkout | null;
  nextWorkout: PulsePlannedWorkout | null;
  todayActivities: PulseActivity[];
  recentActivities: PulseActivity[];
  readinessLabel: ReactNode;
  onActivate: (path: string) => void;
  onPrompt: () => void;
};

function signed(value: number, decimals = 1) {
  return `${value < 0 ? '' : '+'}${value.toFixed(decimals)}`;
}

function formatDateLabel(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).toUpperCase();
}

function todayPlannedWorkout(date: string, todayWorkout: PulsePlannedWorkout | null, nextWorkout: PulsePlannedWorkout | null) {
  if (todayWorkout?.plannedDate === date) return todayWorkout;
  if (nextWorkout?.plannedDate === date) return nextWorkout;
  return null;
}

function completedTodayActivity(date: string, todayActivities: PulseActivity[], recentActivities: PulseActivity[]) {
  const candidates = todayActivities.length > 0
    ? todayActivities
    : recentActivities.filter(activity => activity.startTime.slice(0, 10) === date);
  return candidates.find(activity => (activity.durationSec ?? 0) >= 10 * 60) ?? null;
}

function workoutProfile(workout: PulsePlannedWorkout | null) {
  if (!workout) return [{ z: 0, minutes: 1 }];
  if (workout.steps?.length) {
    return workout.steps.map(step => ({
      z: step.zone,
      minutes: Math.max(1, step.durationMin * (step.reps ?? 1)),
    }));
  }
  return [
    { z: 1, minutes: Math.max(5, Math.round(workout.durationMin * 0.2)) },
    { z: workout.zone, minutes: Math.max(10, Math.round(workout.durationMin * 0.6)) },
    { z: 1, minutes: Math.max(5, Math.round(workout.durationMin * 0.2)) },
  ];
}

function stageFor(decision: DailyDecision, workout: PulsePlannedWorkout | null, activity: PulseActivity | null): 'DECIDE' | 'EXECUTE' | 'REVIEW' {
  if (decision.title.toLowerCase().includes('erledigt') || activity || workout?.status === 'completed') return 'REVIEW';
  if (workout) return 'DECIDE';
  return 'DECIDE';
}

function readinessTone(readiness: PulseReadiness): 'green' | 'amber' | 'rose' | 'accent' {
  if (readiness.score < 55) return 'rose';
  if (readiness.score < 70) return 'amber';
  if (readiness.score >= 85) return 'accent';
  return 'green';
}

function factorTone(value: number, warningAt: number, reverse = false): 'green' | 'amber' | 'rose' | 'muted' {
  const warn = reverse ? value <= warningAt : value >= warningAt;
  if (!warn) return 'green';
  return reverse ? 'amber' : value >= warningAt * 1.75 ? 'rose' : 'amber';
}

export function DecisionHero({
  date,
  decision,
  readiness,
  fitnessLoad,
  recovery,
  todayWorkout,
  nextWorkout,
  todayActivities,
  recentActivities,
  readinessLabel,
  onActivate,
  onPrompt,
}: DecisionHeroProps) {
  const workout = todayPlannedWorkout(date, todayWorkout, nextWorkout);
  const completedActivity = completedTodayActivity(date, todayActivities, recentActivities);
  const showWorkoutSnapshot = Boolean(workout || completedActivity);
  const stage = stageFor(decision, workout, completedActivity);
  const tone = readinessTone(readiness);
  const snapshotTitle = workout
    ? `${activityLabel(workout.activityType)} · Z${workout.zone} · ${workout.durationMin} min`
    : completedActivity
      ? `${completedActivity.name?.trim() || activityLabel(completedActivity.activityType)} · erledigt`
      : 'Heute frei · kein Pflichttraining';
  const snapshotMeta = workout
    ? `${workout.targetTss ?? '–'} TSS · ${workout.executionStatus === 'garmin_scheduled' ? 'Garmin geplant' : 'Pulse geplant'}`
    : completedActivity
      ? `${Math.round((completedActivity.durationSec ?? 0) / 60)} min · TSS ${completedActivity.tss ?? '–'}`
      : 'Erholung, Check-in und Planruhe zählen';
  return (
    <FCard pad="0" testId="focus-decision-hero" style={{ overflow: 'hidden' }}>
      <StageStrip active={stage} />
      <div className="focus-decision-body">
        <div style={{ minWidth: 0 }}>
          <div className="label-mono" style={{ color: 'var(--accent)', marginBottom: 12 }}>
            TAGESFOKUS · {formatDateLabel(date)}
          </div>
          <DailyDecisionCard
            decision={decision}
            labelCase="upper"
            framed={false}
            inlineActions
            onActivate={onActivate}
            onPrompt={onPrompt}
          />

          {showWorkoutSnapshot && (
            <div style={{ marginTop: 22, padding: '14px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
                <span className="label-mono" style={{ fontSize: 9 }}>
                  WORKOUT · HEUTE
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                  {snapshotTitle}
                </span>
              </div>
              <WorkoutProfileBars profile={workoutProfile(workout)} />
              <div style={{ marginTop: 9, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', lineHeight: 1.45 }}>
                {snapshotMeta}
              </div>
            </div>
          )}
        </div>

        <aside className="focus-recovery-panel" aria-label="Readiness und Recovery">
          <div className="label-mono" style={{ fontSize: 9, marginBottom: 14 }}>
            {readinessLabel} · GRUNDLAGE
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 54, fontWeight: 500, color: 'var(--accent)', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>
              {readiness.score}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>/100</span>
          </div>
          <FPill tone={tone} filled>
            {readiness.shortLabel} · {readiness.score < 55 ? 'REST' : 'TRAIN'}
          </FPill>

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 11 }}>
            <FactorRow
              label="Schlafdefizit"
              value={recovery ? `${recovery.sleepDebt7d.hours.toFixed(1)}h` : '–'}
              tone={recovery ? factorTone(recovery.sleepDebt7d.hours, 1.5) : 'muted'}
              pill={recovery?.sleepDebt7d.status ?? 'OFFEN'}
            />
            <FactorRow
              label="HRV-Δ 7d"
              value={recovery ? `${signed(recovery.hrvDeviation7d.pct, 1)}%` : '–'}
              tone={recovery ? factorTone(recovery.hrvDeviation7d.pct, -4, true) : 'muted'}
              pill={recovery?.hrvDeviation7d.status ?? 'OFFEN'}
            />
            <FactorRow
              label="RHR-Drift"
              value={recovery ? `${signed(recovery.rhrDrift7d.bpmAboveBaseline, 0)} bpm` : '–'}
              tone={recovery ? factorTone(recovery.rhrDrift7d.bpmAboveBaseline, 4) : 'muted'}
              pill={recovery?.rhrDrift7d.status ?? 'OFFEN'}
            />
            <FactorRow
              label="TSB"
              value={signed(fitnessLoad.tsb, 1)}
              tone={fitnessLoad.tsb < -12 ? 'amber' : fitnessLoad.tsb > 8 ? 'green' : 'muted'}
              pill={fitnessLoad.tsb < -12 ? 'MÜDE' : fitnessLoad.tsb > 8 ? 'FRISCH' : 'NEUTRAL'}
            />
          </div>
        </aside>
      </div>
    </FCard>
  );
}

function FactorRow({ label, value, tone, pill }: { label: string; value: string; tone: 'green' | 'amber' | 'rose' | 'muted'; pill: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        <FPill tone={tone}>{pill}</FPill>
      </span>
    </div>
  );
}
