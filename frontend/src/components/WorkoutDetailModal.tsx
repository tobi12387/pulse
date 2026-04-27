import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PulsePlannedWorkout, WorkoutStep } from '@coaching-os/shared/pulse';
import { pulseApi } from '@/pulse/api-client';
import { pulseKeys } from '@/pulse/hooks';

const ZONE_COLOR: Record<number, string> = {
  1: 'var(--blue)', 2: 'var(--blue)', 3: 'var(--green)', 4: 'var(--amber)', 5: 'var(--rose)',
};
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

function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function StepRow({ step }: { step: WorkoutStep }) {
  const zoneColor = ZONE_COLOR[step.zone] ?? 'var(--text-2)';
  const isInterval = step.type === 'interval';
  const isPause = step.type === 'rest';

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
        background: isPause ? 'transparent' : zoneColor + '22',
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
              color: zoneColor, background: zoneColor + '18',
              padding: '1px 5px', borderRadius: 2,
            }}>
              {ZONE_LABEL[step.zone] ?? `Z${step.zone}`}
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

interface Props {
  workout: PulsePlannedWorkout;
  onClose: () => void;
  onUpdate: (updated: PulsePlannedWorkout) => void;
}

export function WorkoutDetailModal({ workout: initial, onClose, onUpdate }: Props) {
  const [workout, setWorkout] = useState(initial);
  const qc = useQueryClient();

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
    onSuccess: ({ garminWorkoutId }) => {
      const updated = { ...workout, garminWorkoutId };
      setWorkout(updated);
      onUpdate(updated);
      qc.invalidateQueries({ queryKey: pulseKeys.plan });
    },
  });

  const zoneColor = ZONE_COLOR[workout.zone] ?? 'var(--text-2)';
  const totalMin = workout.steps
    ? workout.steps.reduce((acc, s) => {
        if (s.type === 'interval' && s.reps) return acc + s.reps * s.durationMin + (s.restMin ?? 0) * (s.reps - 1);
        return acc + s.durationMin;
      }, 0)
    : null;

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
                  color: zoneColor, background: zoneColor + '18',
                  padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase',
                }}>
                  {ZONE_LABEL[workout.zone] ?? `Z${workout.zone}`}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em' }}>
                  {new Date(workout.plannedDate + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()}
                </span>
                {workout.garminWorkoutId && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em',
                    color: 'var(--green)', background: 'var(--green)18',
                    padding: '2px 5px', borderRadius: 2,
                  }}>✓ Garmin</span>
                )}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                {ACTIVITY_LABEL[workout.activityType] ?? workout.activityType}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {fmtDuration(workout.durationMin)}
                {workout.distanceKm ? ` · ${workout.distanceKm.toFixed(1)} km` : ''}
                {workout.targetTss ? ` · TSS ${Math.round(workout.targetTss)}` : ''}
              </div>
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
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
          {workout.steps && workout.steps.length > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
                  Trainingsplan
                </span>
                {totalMin != null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
                    ~{fmtDuration(totalMin)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {workout.steps.map((step, i) => <StepRow key={i} step={step} />)}
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
                    background: syncGarmin.isSuccess ? 'var(--green)' + '22' : 'none',
                    border: `1px solid ${syncGarmin.isSuccess ? 'var(--green)' : 'var(--border)'}`,
                    borderRadius: 4, cursor: syncGarmin.isPending ? 'default' : 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em',
                    color: syncGarmin.isPending ? 'var(--text-3)' : syncGarmin.isSuccess ? 'var(--green)' : workout.garminWorkoutId ? 'var(--accent)' : 'var(--text-2)',
                    textTransform: 'uppercase',
                  }}
                >
                  {syncGarmin.isPending ? '● Lade hoch…' : syncGarmin.isSuccess ? '✓ Auf Garmin' : workout.garminWorkoutId ? '✓ Erneut laden' : '⇪ Auf Garmin'}
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
