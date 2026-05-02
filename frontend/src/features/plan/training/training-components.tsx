import { useState } from 'react';
import { useUpdateWorkout } from '@/pulse/hooks';
import type { PulsePlannedWorkout } from '@coaching-os/shared/pulse';
import { executionStatusFor, getMonday, isoDate } from '../plan-utils';

type PlannedWorkout = PulsePlannedWorkout;

export const DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const ACTIVITY_LABEL: Record<string, string> = {
  run: 'Laufen', bike: 'Radfahren', swim: 'Schwimmen',
  strength: 'Kraft', hike: 'Wandern', other: 'Sonstiges',
};

const ACTIVITY_TYPES = ['run', 'bike', 'swim', 'strength', 'hike', 'other'] as const;

const ZONE_COLOR: Record<number, string> = {
  1: 'var(--blue)', 2: 'var(--blue)', 3: 'var(--green)', 4: 'var(--amber)', 5: 'var(--rose)',
};

const EXECUTION_META: Record<NonNullable<PlannedWorkout['executionStatus']>, { label: string; color: string }> = {
  local_planned:        { label: 'Lokal', color: 'var(--amber)' },
  garmin_template:      { label: 'Garmin', color: 'var(--accent)' },
  garmin_scheduled:     { label: 'Kalender', color: 'var(--green)' },
  completed_matched:    { label: 'Erledigt', color: 'var(--green)' },
  missed:               { label: 'Verpasst', color: 'var(--rose)' },
  replaced_or_off_plan: { label: 'Ersetzt', color: 'var(--amber)' },
};

function translucent(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

function ExecutionBadge({ workout }: { workout: PlannedWorkout }) {
  const meta = EXECUTION_META[executionStatusFor(workout)];
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      color: meta.color,
      border: `1px solid ${meta.color}`,
      borderRadius: 3,
      padding: '1px 5px',
      textTransform: 'uppercase',
    }}>
      {meta.label}
    </span>
  );
}

export function WeekStrip({ workouts, weekOffset, onChangeWeek, onSelectWorkout }: {
  workouts: PlannedWorkout[];
  weekOffset: number;
  onChangeWeek: (delta: number) => void;
  onSelectWorkout: (w: PlannedWorkout) => void;
}) {
  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: isoDate(d), dayNum: d.getDate(), dayIdx: i };
  });

  const today = isoDate(new Date());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" aria-label="Vorherige Woche" onClick={() => onChangeWeek(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-3)', padding: '0 10px',
          minWidth: 40, minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>←</button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {monday.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} –{' '}
          {new Date(monday.getTime() + 6 * 86400000).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
          {weekOffset === 0 ? '  · diese Woche' : weekOffset === 1 ? '  · nächste Woche' : weekOffset === -1 ? '  · letzte Woche' : ''}
        </span>
        <button type="button" aria-label="Nächste Woche" onClick={() => onChangeWeek(1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-3)', padding: '0 10px',
          minWidth: 40, minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>→</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {days.map(({ date, dayNum, dayIdx }) => {
          const workout = workouts.find(w => w.plannedDate === date);
          const isToday = date === today;
          const isPast  = date < today;
          const isDone  = workout?.status === 'completed';
          const isSkipped = workout?.status === 'skipped';
          const zone = workout?.zone ?? 0;
          const zoneColor = zone > 0 ? (ZONE_COLOR[zone] ?? 'var(--text-3)') : 'transparent';

          return (
            <button key={date}
              type="button"
              disabled={!workout}
              aria-label={workout ? `${DAY_SHORT[dayIdx]} ${dayNum}: ${ACTIVITY_LABEL[workout.activityType] ?? workout.activityType} öffnen` : `${DAY_SHORT[dayIdx]} ${dayNum}: kein Training`}
              onClick={() => workout && onSelectWorkout(workout)}
              style={{
                appearance: 'none',
                textAlign: 'left',
                width: '100%',
                padding: '10px 10px 12px',
                background: isToday ? 'var(--surface-2)' : 'var(--surface)',
                border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 5,
                opacity: isPast && !isToday ? 0.65 : 1,
                cursor: workout ? 'pointer' : 'default',
                color: 'inherit',
                font: 'inherit',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  {DAY_SHORT[dayIdx]}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: isToday ? 'var(--accent)' : 'var(--text)' }}>
                  {dayNum}
                </span>
              </div>

              <div style={{
                marginTop: 8, height: 3, borderRadius: 1,
                background: workout && !isSkipped ? zoneColor : 'transparent',
                opacity: isSkipped ? 0.25 : 1,
              }} />

              <div style={{ marginTop: 6, fontSize: 10, color: zone === 0 ? 'var(--text-3)' : 'var(--text)', lineHeight: 1.3,
                textDecoration: isSkipped ? 'line-through' : 'none',
              }}>
                {workout ? workout.activityType : <span style={{ color: 'var(--text-3)' }}>–</span>}
              </div>

              {workout && zone > 0 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--text-3)', marginTop: 2 }}>
                  {isDone ? <span style={{ color: 'var(--green)' }}>✓ </span> : ''}Z{zone} · {workout.durationMin}'
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorkoutRow({ workout: w, index: i, onOpen }: { workout: PlannedWorkout; index: number; onOpen: () => void }) {
  const update = useUpdateWorkout();
  const [switching, setSwitching] = useState(false);

  function handleTypeChange(type: string) {
    void update.mutateAsync({ id: w.id, data: { activityType: type } });
    setSwitching(false);
  }

  return (
    <div style={{
      borderTop: i > 0 ? '1px solid var(--border)' : undefined,
      opacity: w.status === 'skipped' ? 0.45 : 1,
    }}>
      <div style={{
        display: 'flex', alignItems: 'stretch', justifyContent: 'space-between',
      }}>
        <button
          type="button"
          tabIndex={switching ? -1 : 0}
          aria-disabled={switching}
          aria-label={`${w.plannedDate} ${ACTIVITY_LABEL[w.activityType] ?? w.activityType} öffnen`}
          onClick={() => { if (!switching) onOpen(); }}
          style={{
            flex: '1 1 auto', minWidth: 0, textAlign: 'left',
            padding: '10px 0 10px 14px', cursor: switching ? 'default' : 'pointer',
            background: 'transparent', border: 0, color: 'inherit',
          }}
          onMouseEnter={e => { if (!switching) e.currentTarget.style.background = 'var(--surface-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{w.plannedDate}</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
              color: ZONE_COLOR[w.zone] ?? 'var(--text-3)',
              border: `1px solid ${ZONE_COLOR[w.zone] ?? 'var(--border)'}`,
              borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase',
            }}>Z{w.zone}</span>
            <ExecutionBadge workout={w} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{ACTIVITY_LABEL[w.activityType] ?? w.activityType}</span>
          </div>
          {w.description && !switching && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{w.description}</div>
          )}
        </button>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          marginLeft: 8, padding: '10px 14px 10px 0',
        }}>
            <button
              type="button"
              aria-expanded={switching}
              onClick={() => setSwitching(v => !v)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.08em',
                minHeight: 40, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 3,
                background: 'transparent', color: 'var(--text-3)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >Sportart ändern</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
            {w.durationMin}m{w.distanceKm ? ` · ${w.distanceKm.toFixed(1)}km` : ''}
          </span>
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>›</span>
        </div>
      </div>

      {switching && (
        <div style={{ padding: '0 14px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ flexBasis: '100%', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
            Sportart auswählen
          </div>
          {ACTIVITY_TYPES.map(t => (
            <button key={t} onClick={() => handleTypeChange(t)} disabled={update.isPending} style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase',
              minHeight: 40, padding: '8px 12px', border: `1px solid ${t === w.activityType ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 3, background: t === w.activityType ? translucent('var(--accent)', 9) : 'transparent',
              color: t === w.activityType ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{ACTIVITY_LABEL[t]}</button>
          ))}
        </div>
      )}

      {w.status === 'completed' && w.workoutFeedback && (
        <div style={{
          margin: '0 10px 10px', padding: '10px 12px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', borderLeft: '2px solid var(--green)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--green)', letterSpacing: '.1em' }}>COACH-FEEDBACK</span>
            {w.complianceScore != null && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: w.complianceScore >= 0.8 ? 'var(--green)' : w.complianceScore >= 0.6 ? 'var(--amber)' : 'var(--rose)',
              }}>
                {Math.round(w.complianceScore * 100)}% Compliance
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>{w.workoutFeedback}</p>
        </div>
      )}

      {w.status === 'completed' && !w.workoutFeedback && (
        <div style={{ margin: '0 10px 10px', padding: '6px 12px', background: 'var(--surface)', borderRadius: 'var(--radius)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>Feedback wird generiert…</span>
        </div>
      )}
    </div>
  );
}
