import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PulsePlannedWorkout, WorkoutStep } from '@coaching-os/shared/pulse';
import { pulseApi } from '@/pulse/api-client';
import { pulseKeys, useFuelingRecoveryGuidance, useGarminExecutionLedger } from '@/pulse/hooks';
import { executionStatusFor, garminConfidenceCopy, type GarminConfidenceTone } from '@/features/plan/plan-utils';
import { InlineFeedback } from '@/components/Feedback';

const ZONE_COLOR: Record<number, string> = {
  1: 'var(--blue)', 2: 'var(--blue)', 3: 'var(--green)', 4: 'var(--amber)', 5: 'var(--rose)',
};

const FIT_META: Record<NonNullable<PulsePlannedWorkout['capabilityFit']>, { label: string; color: string }> = {
  recovery: { label: 'Recovery', color: 'var(--blue)' },
  maintenance: { label: 'Erhaltung', color: 'var(--text-3)' },
  productive: { label: 'Produktiv', color: 'var(--green)' },
  stretch: { label: 'Stretch', color: 'var(--amber)' },
  too_hard_today: { label: 'Zu hart heute', color: 'var(--rose)' },
};

function translucent(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

const ZONE_LABEL: Record<number, string> = {
  1: 'Z1 · Regeneration', 2: 'Z2 · Grundlage', 3: 'Z3 · Tempo',
  4: 'Z4 · Schwelle', 5: 'Z5 · VO2max',
};
const TYPE_LABEL: Record<string, string> = {
  warmup: 'Aufwärmen', interval: 'Intervall', steady: 'Dauerleistung',
  rest: 'Pause', cooldown: 'Ausschwingen',
};
const TYPE_ICON: Record<string, string> = {
  warmup: '↑', interval: '⚡', steady: '→', rest: '◦', cooldown: '↓',
};
const ACTIVITY_LABEL: Record<string, string> = {
  run: 'Laufen', bike: 'Radfahren', swim: 'Schwimmen',
  strength: 'Kraft', hike: 'Wandern', other: 'Sonstiges',
};

const EXECUTION_META: Record<NonNullable<PulsePlannedWorkout['executionStatus']>, { label: string; color: string }> = {
  local_planned:        { label: 'Lokal', color: 'var(--amber)' },
  garmin_template:      { label: 'Garmin', color: 'var(--accent)' },
  garmin_scheduled:     { label: 'Kalender', color: 'var(--green)' },
  completed_matched:    { label: 'Erledigt', color: 'var(--green)' },
  missed:               { label: 'Verpasst', color: 'var(--rose)' },
  replaced_or_off_plan: { label: 'Ersetzt', color: 'var(--amber)' },
};

const CONFIDENCE_TONE_COLOR: Record<GarminConfidenceTone, string> = {
  ok: 'var(--green)',
  watch: 'var(--amber)',
  error: 'var(--rose)',
};

function ExecutionBadge({ workout }: { workout: PulsePlannedWorkout }) {
  const meta = EXECUTION_META[executionStatusFor(workout)];
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em',
      color: meta.color, background: translucent(meta.color, 9),
      padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase',
    }}>
      {meta.label}
    </span>
  );
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function fmtHrTarget(step: WorkoutStep): string | null {
  if (step.targetLabel) return step.targetLabel;
  if (step.targetHrMinBpm != null && step.targetHrMaxBpm != null) return `${step.targetHrMinBpm}-${step.targetHrMaxBpm} bpm`;
  if (step.targetHrMaxBpm != null) return `<${step.targetHrMaxBpm} bpm`;
  if (step.targetHrMinBpm != null) return `>${step.targetHrMinBpm} bpm`;
  return null;
}

function plural(value: number, singular: string, pluralValue: string): string {
  return `${value} ${value === 1 ? singular : pluralValue}`;
}

function StepRow({ step }: { step: WorkoutStep }) {
  const zoneColor = ZONE_COLOR[step.zone] ?? 'var(--text-2)';
  const isInterval = step.type === 'interval';
  const isPause = step.type === 'rest';
  const hrTarget = fmtHrTarget(step);

  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '10px 12px',
      background: isPause ? 'transparent' : 'var(--surface)',
      borderRadius: 4,
      border: `1px solid ${isPause ? 'transparent' : 'var(--border)'}`,
      opacity: isPause ? 0.6 : 1,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 3, flexShrink: 0,
        background: isPause ? 'transparent' : translucent(zoneColor, 13),
        border: `1px solid ${isPause ? 'var(--border)' : zoneColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 11, color: zoneColor,
      }}>
        {TYPE_ICON[step.type] ?? '·'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
            {isInterval && step.reps ? `${step.reps}× ` : ''}{TYPE_LABEL[step.type] ?? step.type}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
            {isInterval && step.reps
              ? `${step.reps}× ${step.durationMin} min${step.restMin ? ` + ${step.restMin} min P` : ''}`
              : fmtDuration(step.durationMin)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
          {!isPause && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em',
              color: zoneColor, background: translucent(zoneColor, 9),
              padding: '1px 5px', borderRadius: 2,
            }}>
              {ZONE_LABEL[step.zone] ?? `Z${step.zone}`}
            </span>
          )}
          {hrTarget && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.06em',
              color: 'var(--rose)', background: translucent('var(--rose)', 9),
              padding: '1px 5px', borderRadius: 2,
              whiteSpace: 'nowrap',
            }}>
              HR {hrTarget}
            </span>
          )}
          {step.description && (
            <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{step.description}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function GuidanceList({ title, items }: { title: string; items: Array<{ id: string; text: string }> }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 5 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map(item => (
          <div key={item.id} style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45 }}>
            {item.text}
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  workout: PulsePlannedWorkout;
  notice?: {
    title: string;
    message: string;
    tone: 'warning' | 'info' | 'error';
  };
  onClose: () => void;
  onUpdate: (updated: PulsePlannedWorkout) => void;
}

export function WorkoutDetailModal({ workout: initial, notice, onClose, onUpdate }: Props) {
  const [workout, setWorkout] = useState(initial);
  const qc = useQueryClient();
  const fuelingGuidance = useFuelingRecoveryGuidance(workout.id);
  const executionLedger = useGarminExecutionLedger(workout.id);

  const generateDetail = useMutation({
    mutationFn: () => pulseApi.plan.generateDetail(workout.id),
    onSuccess: ({ workout: updated }) => {
      setWorkout(updated);
      onUpdate(updated);
      qc.invalidateQueries({ queryKey: pulseKeys.plan });
    },
  });

  const syncGarmin = useMutation({
    mutationFn: () => pulseApi.plan.syncGarmin(workout.id),
    onSuccess: ({ garminWorkoutId, garminScheduledId, workout: syncedWorkout }) => {
      const updated = syncedWorkout ?? { ...workout, garminWorkoutId, garminScheduledId };
      setWorkout(updated);
      onUpdate(updated);
      qc.invalidateQueries({ queryKey: pulseKeys.plan });
      qc.invalidateQueries({ queryKey: pulseKeys.garminExecutionLedger(workout.id) });
    },
  });

  const zoneColor = ZONE_COLOR[workout.zone] ?? 'var(--text-2)';
  const confidence = garminConfidenceCopy(workout);
  const confidenceColor = CONFIDENCE_TONE_COLOR[confidence.tone];
  const totalMin = workout.steps
    ? workout.steps.reduce((acc, s) => {
        if (s.type === 'interval' && s.reps) return acc + s.reps * s.durationMin + (s.restMin ?? 0) * (s.reps - 1);
        return acc + s.durationMin;
      }, 0)
    : null;
  const repeatBlocks = workout.steps?.filter(step => step.type === 'interval' && (step.reps ?? 0) > 1) ?? [];
  const repeatCount = repeatBlocks.reduce((sum, step) => sum + (step.reps ?? 0), 0);
  const hrTargetCount = workout.steps?.filter(step => fmtHrTarget(step) != null).length ?? 0;
  const latestLedger = executionLedger.data?.entries?.[0] ?? null;
  const isStrengthWorkout = workout.activityType === 'strength';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 640,
          background: 'var(--surface)', borderRadius: '10px 10px 0 0',
          border: '1px solid var(--border)', borderBottom: 'none',
          maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em',
                  color: zoneColor, background: translucent(zoneColor, 9),
                  padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase',
                }}>
                  {ZONE_LABEL[workout.zone] ?? `Z${workout.zone}`}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em' }}>
                  {new Date(workout.plannedDate + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()}
                </span>
                <ExecutionBadge workout={workout} />
                {workout.capabilityFit && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em',
                    color: FIT_META[workout.capabilityFit].color,
                    border: `1px solid ${translucent(FIT_META[workout.capabilityFit].color, 45)}`,
                    padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase',
                  }}>
                    {FIT_META[workout.capabilityFit].label}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                {ACTIVITY_LABEL[workout.activityType] ?? workout.activityType}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {fmtDuration(workout.durationMin)}
                {workout.distanceKm ? ` · ${workout.distanceKm.toFixed(1)} km` : ''}
                {workout.targetTss ? ` · TSS ${Math.round(workout.targetTss)}` : ''}
                {workout.difficultyLevel ? ` · L${workout.difficultyLevel.toFixed(1)}` : ''}
              </div>
              {workout.archetypeId && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
                  {workout.archetypeId.replaceAll('_', ' ')}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-3)', fontSize: 18, padding: '0 4px', lineHeight: 1,
              }}
            >×</button>
          </div>
          {workout.description && (
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.5 }}>
              {workout.description}
            </p>
          )}
          {workout.executionNotes && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.45 }}>
              {workout.executionNotes}
            </p>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
          {notice && (
            <div style={{ marginBottom: 12 }}>
              <InlineFeedback title={notice.title} message={notice.message} tone={notice.tone} />
            </div>
          )}
          <div
            data-testid="garmin-sync-confidence"
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              padding: '10px 12px',
              marginBottom: 12,
              background: translucent(confidenceColor, 9),
              border: `1px solid ${translucent(confidenceColor, 35)}`,
              borderLeft: `3px solid ${confidenceColor}`,
              borderRadius: 5,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: confidenceColor,
                flex: '0 0 auto',
                marginTop: 5,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: 12, color: 'var(--text)', lineHeight: 1.35 }}>
                {confidence.title}
              </strong>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45, marginTop: 2 }}>
                {confidence.detail}
              </span>
            </div>
          </div>
          {latestLedger && (
            <div
              data-testid="garmin-execution-ledger"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                padding: '10px 12px',
                marginBottom: 12,
                background: latestLedger.outcome === 'failed' || latestLedger.outcome === 'blocked'
                  ? 'rgba(248,113,113,0.07)'
                  : 'rgba(74,222,128,0.06)',
                border: `1px solid ${latestLedger.outcome === 'failed' || latestLedger.outcome === 'blocked'
                  ? 'rgba(248,113,113,0.28)'
                  : 'rgba(74,222,128,0.22)'}`,
                borderLeft: `3px solid ${latestLedger.outcome === 'failed' || latestLedger.outcome === 'blocked'
                  ? 'var(--rose)'
                  : latestLedger.outcome === 'degraded'
                    ? 'var(--amber)'
                    : 'var(--green)'}`,
                borderRadius: 5,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <strong style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.35 }}>
                  Garmin Ausführung
                </strong>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase' }}>
                  {latestLedger.operation}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45 }}>
                {latestLedger.summary}
              </p>
              {latestLedger.payloadSnapshot && (
                <p style={{ margin: 0, fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.45 }}>
                  {latestLedger.payloadSnapshot.repeatGroupCount} Wiederholungsblock(e), {latestLedger.payloadSnapshot.hrTargetStepCount} HR-Zielschritte, {latestLedger.payloadSnapshot.invalidRepeatCount} Repeat-Fehler.
                </p>
              )}
            </div>
          )}
          {workout.steps && workout.steps.length > 0 && (
            <div
              data-testid="garmin-workout-handoff"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '10px 12px',
                marginBottom: 12,
                background: 'rgba(94,230,207,0.06)',
                border: '1px solid rgba(94,230,207,0.22)',
                borderLeft: '3px solid var(--accent)',
                borderRadius: 5,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <strong style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.35 }}>
                  {isStrengthWorkout ? 'Garmin Notiz/Blockliste' : 'Garmin Workout-Inhalt'}
                </strong>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                  {isStrengthWorkout ? 'notiz' : 'vor Upload'}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {[
                  plural(workout.steps.length, 'Block', 'Blöcke'),
                  totalMin != null ? `~${fmtDuration(totalMin)}` : null,
                  repeatBlocks.length > 0 ? plural(repeatBlocks.length, 'Repeat-Block', 'Repeat-Blöcke') : 'Keine Repeat-Blöcke',
                  repeatCount > 0 ? plural(repeatCount, 'Wiederholung', 'Wiederholungen') : null,
                  hrTargetCount > 0 ? plural(hrTargetCount, 'HR-Ziel', 'HR-Ziele') : 'Keine HR-Ziele',
                ].filter(Boolean).map(item => (
                  <span
                    key={item}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--text-2)',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      padding: '2px 5px',
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45 }}>
                {isStrengthWorkout
                  ? 'Support-Session wird als Notiz/Blockliste behandelt, nicht als Intervallstruktur.'
                  : 'Prüfe hier, was auf Uhr oder Edge landet, bevor du hochlädst.'}
              </div>
            </div>
          )}
          {fuelingGuidance.data?.shouldShow && (
            <div
              data-testid="fueling-recovery-guidance"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '10px 12px',
                marginBottom: 12,
                background: 'rgba(94,230,207,0.06)',
                border: '1px solid rgba(94,230,207,0.22)',
                borderLeft: '3px solid var(--accent)',
                borderRadius: 5,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.35 }}>
                  Fueling & Recovery
                </strong>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)' }}>
                  BEREIT
                </span>
              </div>
              {fuelingGuidance.data.fuelingDebt.hasOpenDebt && (
                <div data-testid="workout-fueling-debt" style={{
                  padding: 8,
                  border: '1px solid rgba(251,191,36,0.34)',
                  borderRadius: 4,
                  background: 'rgba(251,191,36,0.06)',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--amber)', marginBottom: 4 }}>
                    {fuelingGuidance.data.fuelingDebt.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45 }}>
                    {fuelingGuidance.data.fuelingDebt.closureCondition}
                  </div>
                </div>
              )}
              {fuelingGuidance.data.recoveryCautions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {fuelingGuidance.data.recoveryCautions.map((caution, index) => (
                    <div key={index} style={{ fontSize: 11, color: 'var(--amber)', lineHeight: 1.45 }}>
                      {caution}
                    </div>
                  ))}
                </div>
              )}
              <GuidanceList title="Vorher" items={fuelingGuidance.data.before} />
              <GuidanceList title="Während" items={fuelingGuidance.data.during} />
              <GuidanceList title="Danach" items={fuelingGuidance.data.after} />
              {fuelingGuidance.data.evidence.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {fuelingGuidance.data.evidence.map(item => (
                    <span
                      key={`${item.label}:${item.value}`}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        color: item.status === 'caution' ? 'var(--amber)' : 'var(--text-3)',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        padding: '2px 5px',
                      }}
                    >
                      {item.label}: {item.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {workout.steps && workout.steps.length > 0 ? (
            <>
              <div
                data-testid={isStrengthWorkout ? 'support-session-blocks' : undefined}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
                  {isStrengthWorkout ? 'SUPPORT-SESSION' : 'Trainingsplan'}
                </span>
                {totalMin != null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
                    ~{fmtDuration(totalMin)}
                  </span>
                )}
              </div>
              {isStrengthWorkout && (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45 }}>
                  Nicht als Garmin-Intervallstruktur gedacht; Fokus liegt auf sauberer Ausführung.
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {workout.steps.map((step, i) => <StepRow key={i} step={step} />)}
              </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <button
                  onClick={() => generateDetail.mutate()}
                  disabled={generateDetail.isPending || syncGarmin.isPending}
                  style={{
                    flex: 1, padding: '8px',
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 4, cursor: generateDetail.isPending ? 'default' : 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em',
                    color: generateDetail.isPending ? 'var(--text-3)' : 'var(--text-2)',
                    textTransform: 'uppercase',
                  }}
                >
                  {generateDetail.isPending ? '● Generiere…' : '↺ Neu generieren'}
                </button>
                <button
                  onClick={() => syncGarmin.mutate()}
                  disabled={syncGarmin.isPending || generateDetail.isPending}
                  style={{
                    flex: 1, padding: '8px',
                    background: syncGarmin.isSuccess ? translucent('var(--green)', 13) : 'none',
                    border: `1px solid ${syncGarmin.isSuccess ? 'var(--green)' : 'var(--border)'}`,
                    borderRadius: 4, cursor: syncGarmin.isPending ? 'default' : 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em',
                    color: syncGarmin.isPending ? 'var(--text-3)' : syncGarmin.isSuccess ? 'var(--green)' : workout.garminWorkoutId ? 'var(--accent)' : 'var(--text-2)',
                    textTransform: 'uppercase',
                  }}
                >
                  {syncGarmin.isPending
                    ? '● Lade hoch…'
                    : syncGarmin.isSuccess
                      ? '✓ Auf Garmin'
                      : isStrengthWorkout
                        ? '⇪ Als Notiz laden'
                        : workout.garminWorkoutId ? '✓ Erneut laden' : '⇪ Auf Garmin'}
                </button>
              </div>
              {syncGarmin.isError && (
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--rose)', fontFamily: 'var(--font-mono)' }}>
                  {syncGarmin.error instanceof Error ? syncGarmin.error.message : 'Sync fehlgeschlagen'}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>
                Noch keine Trainingsanleitung vorhanden.
              </div>
              <button
                onClick={() => generateDetail.mutate()}
                disabled={generateDetail.isPending}
                style={{
                  padding: '10px 24px',
                  background: generateDetail.isPending ? 'var(--surface-2)' : 'var(--accent)',
                  color: generateDetail.isPending ? 'var(--text-3)' : 'var(--bg)',
                  border: 'none', borderRadius: 4, cursor: generateDetail.isPending ? 'default' : 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em',
                  textTransform: 'uppercase',
                }}
              >
                {generateDetail.isPending ? '● Generiere Anleitung…' : '⚡ Anleitung generieren'}
              </button>
              {generateDetail.isError && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--rose)' }}>
                  {generateDetail.error instanceof Error ? generateDetail.error.message : 'Fehler'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
