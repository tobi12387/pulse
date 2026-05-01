import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  usePulseActivities, usePulsePlan, usePulseGoals,
  useCreateGoal, useUpdateGoal, useDeleteGoal, useUpdateWorkout, usePulseReview, useGenerateReview, useGeneratePlan,
  usePlanTrace, useStrengthSessions, useTrainingAnalytics, useWeekAvailability, useSaveAvailability,
} from '@/pulse/hooks';
import { LineChart } from '@/components/SparkChart';
import { Skeleton } from '@/components/Skeleton';
import { StrengthLogger } from '@/components/StrengthLogger';
import { WorkoutDetailModal } from '@/components/WorkoutDetailModal';
import { PageHeader, RangeControl, SegmentedControl } from '@/components/PulseChrome';
import type { PulsePlanTrace, PulsePlannedWorkout, PulseStrengthSession, PulseStrengthTrendPoint, GoalCategory, RaceDiscipline } from '@coaching-os/shared/pulse';

type Tab = 'training' | 'ziele' | 'review' | 'statistik';

function fmt(v: number | null | undefined, decimals = 1, suffix = ''): string {
  return v == null ? '–' : `${v.toFixed(decimals)}${suffix}`;
}

const ZONE_COLOR: Record<number, string> = {
  1: 'var(--blue)', 2: 'var(--blue)', 3: 'var(--green)', 4: 'var(--amber)', 5: 'var(--rose)',
};

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

// ─── WeekStrip ────────────────────────────────────────────────────────────────

const DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type PlannedWorkout = PulsePlannedWorkout;
type WorkoutUpdate = {
  activityType?: string;
  zone?: number;
  durationMin?: number;
  plannedDate?: string;
  status?: 'planned' | 'skipped';
  description?: string | null;
};

type PlanAlternativeId = 'shorter' | 'easier' | 'move' | 'rest';

function roundToFive(value: number): number {
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

function nextAvailableDateAfter(date: string, availableDays: number[]): string {
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

function weekStartForDate(date: string): string {
  return isoDate(getMonday(new Date(date + 'T12:00:00')));
}

function getNextOpenWorkout(workouts: PlannedWorkout[], today: string): PlannedWorkout | null {
  return [...workouts]
    .filter(w => w.status !== 'completed' && w.status !== 'skipped' && w.plannedDate >= today)
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))[0] ?? null;
}

function buildPlanAlternative(workout: PlannedWorkout, id: PlanAlternativeId, availableDays: number[]): WorkoutUpdate {
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

function WeekStrip({ workouts, weekOffset, onChangeWeek, onSelectWorkout }: {
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
      {/* Week nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => onChangeWeek(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', padding: '2px 6px',
        }}>←</button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {monday.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} –{' '}
          {new Date(monday.getTime() + 6 * 86400000).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
          {weekOffset === 0 ? '  · diese Woche' : weekOffset === 1 ? '  · nächste Woche' : weekOffset === -1 ? '  · letzte Woche' : ''}
        </span>
        <button onClick={() => onChangeWeek(1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', padding: '2px 6px',
        }}>→</button>
      </div>

      {/* Day columns — card per day */}
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
            <div key={date}
              onClick={() => workout && onSelectWorkout(workout)}
              style={{
                padding: '10px 10px 12px',
                background: isToday ? 'var(--surface-2)' : 'var(--surface)',
                border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 5,
                opacity: isPast && !isToday ? 0.65 : 1,
                cursor: workout ? 'pointer' : 'default',
              }}>
              {/* Day name + date number */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  {DAY_SHORT[dayIdx]}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: isToday ? 'var(--accent)' : 'var(--text)' }}>
                  {dayNum}
                </span>
              </div>

              {/* Zone bar */}
              <div style={{
                marginTop: 8, height: 3, borderRadius: 1,
                background: workout && !isSkipped ? zoneColor : 'transparent',
                opacity: isSkipped ? 0.25 : 1,
              }} />

              {/* Activity type */}
              <div style={{ marginTop: 6, fontSize: 10, color: zone === 0 ? 'var(--text-3)' : 'var(--text)', lineHeight: 1.3,
                textDecoration: isSkipped ? 'line-through' : 'none',
              }}>
                {workout ? workout.activityType : <span style={{ color: 'var(--text-3)' }}>–</span>}
              </div>

              {/* Zone + duration */}
              {workout && zone > 0 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--text-3)', marginTop: 2 }}>
                  {isDone ? <span style={{ color: 'var(--green)' }}>✓ </span> : ''}Z{zone} · {workout.durationMin}'
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NextTrainingDecisionCard({
  nextWorkout,
  availableDays,
  activeGoalsCount,
  planTrace,
  onOpen,
}: {
  nextWorkout: PlannedWorkout | null;
  availableDays: number[];
  activeGoalsCount: number;
  planTrace: PulsePlanTrace | null;
  onOpen: (workout: PlannedWorkout) => void;
}) {
  const update = useUpdateWorkout();
  const today = isoDateLocal(new Date());

  if (!nextWorkout) {
    return (
      <div className="card" style={{ borderColor: 'rgba(94,230,207,0.18)' }}>
        <div className="label-mono" style={{ color: 'var(--accent)', marginBottom: 7 }}>
          NÄCHSTE TRAININGSENTSCHEIDUNG
        </div>
        <h2 style={{ fontSize: 16, color: 'var(--text)', margin: '0 0 6px', fontWeight: 600 }}>
          Kein offenes Training geplant
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>
          Prüfe deine Verfügbarkeit oder erstelle einen neuen Wochenplan, wenn du diese Woche trainieren willst.
        </p>
      </div>
    );
  }

  const dateLabel = new Date(nextWorkout.plannedDate + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  const isToday = nextWorkout.plannedDate === today;
  const load = planTrace?.inputSnapshot.load ?? null;
  const riskCount = planTrace?.inputSnapshot.riskSignals.length ?? 0;
  const goalsCount = activeGoalsCount || planTrace?.inputSnapshot.goals.length || 0;
  const sourceChips = [
    load ? `Einbezogen: TSB ${load.tsb.toFixed(1)}` : 'Einbezogen: aktueller Plan',
    `Verfügbarkeit ${availableDays.map(day => DAY_SHORT[day]).join('/') || 'offen'}`,
    goalsCount > 0 ? `Ziele ${goalsCount} aktiv` : 'Ziele keine aktiven',
    riskCount > 0 ? `Risiko ${riskCount} Signal(e)` : 'Risiko unauffällig',
  ];
  const alternatives: Array<{ id: PlanAlternativeId; label: string; detail: string }> = [
    {
      id: 'shorter',
      label: 'Kürzer',
      detail: `${roundToFive(nextWorkout.durationMin * 0.65)} min, Intensität bleibt`,
    },
    {
      id: 'easier',
      label: 'Leichter',
      detail: `Z${Math.max(1, Math.min(2, nextWorkout.zone - 1))}, ${roundToFive(nextWorkout.durationMin * 0.85)} min`,
    },
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

  function applyAlternative(id: PlanAlternativeId) {
    const workout = nextWorkout;
    if (!workout) return;
    void update.mutateAsync({
      id: workout.id,
      data: buildPlanAlternative(workout, id, availableDays),
    });
  }

  return (
    <div className="card" style={{ borderColor: 'rgba(94,230,207,0.24)' }}>
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {sourceChips.map(chip => (
          <span key={chip} style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--text-2)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '3px 6px',
          }}>
            {chip}
          </span>
        ))}
      </div>
      <div className="label-mono" style={{ color: 'var(--accent)', marginBottom: 7 }}>ALTERNATIVEN</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 7, marginBottom: 10 }}>
        {alternatives.map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => applyAlternative(option.id)}
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
            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: option.id === 'rest' ? 'var(--amber)' : 'var(--accent)', textTransform: 'uppercase' }}>
              {option.label}
            </span>
            <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.35 }}>
              {option.detail}
            </span>
          </button>
        ))}
      </div>
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

function getMondays(): string[] {
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

function AvailabilityEditor() {
  const { data, isLoading } = useWeekAvailability();
  const save = useSaveAvailability();
  const weeks = data?.weeks ?? [];
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<Record<string, { availableDays: number[]; weeklyHours: number; notes: string }>>({});

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
    await save.mutateAsync({ weekStart, data: { availableDays: cur.availableDays, weeklyHours: cur.weeklyHours, notes: cur.notes || undefined } });
    setLocal(l => { const n = { ...l }; delete n[weekStart]; return n; });
  }

  const mondayStrs = getMondays();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
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
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, lineHeight: 1 }}>×</button>
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
        </div>
      )}
    </div>
  );
}

// ─── Workout Row ──────────────────────────────────────────────────────────────

const ACTIVITY_TYPES = ['run', 'bike', 'swim', 'strength', 'hike', 'other'] as const;
const ACTIVITY_LABEL: Record<string, string> = {
  run: 'Laufen', bike: 'Radfahren', swim: 'Schwimmen',
  strength: 'Kraft', hike: 'Wandern', other: 'Sonstiges',
};

function WorkoutRow({ workout: w, index: i, onOpen }: { workout: PlannedWorkout; index: number; onOpen: () => void }) {
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
      <div
        onClick={() => !switching && onOpen()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', cursor: switching ? 'default' : 'pointer',
        }}
        onMouseEnter={e => { if (!switching) e.currentTarget.style.background = 'var(--surface-2)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{w.plannedDate}</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
              color: ZONE_COLOR[w.zone] ?? 'var(--text-3)',
              border: `1px solid ${ZONE_COLOR[w.zone] ?? 'var(--border)'}`,
              borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase',
            }}>Z{w.zone}</span>
            {w.status === 'completed' && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--green)' }}>✓</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{ACTIVITY_LABEL[w.activityType] ?? w.activityType}</span>
            <button
              onClick={e => { e.stopPropagation(); setSwitching(v => !v); }}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.08em',
                padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 2,
                background: 'transparent', color: 'var(--text-3)', cursor: 'pointer',
              }}
            >Sportart ändern</button>
          </div>
          {w.description && !switching && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{w.description}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
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
              padding: '4px 10px', border: `1px solid ${t === w.activityType ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 3, background: t === w.activityType ? translucent('var(--accent)', 9) : 'transparent',
              color: t === w.activityType ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer',
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

function TraceInsightBlock({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '9px 10px', background: 'var(--surface)' }}>
      <div className="label-mono" style={{ fontSize: 9, marginBottom: 7, color }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.slice(0, 3).map(item => (
          <span key={item} style={{
            fontSize: 10.5, lineHeight: 1.35, color: 'var(--text-2)',
            border: '1px solid var(--border)', borderRadius: 4,
            padding: '3px 7px', maxWidth: '100%', overflowWrap: 'anywhere',
          }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function PlanTraceCard({ trace, isLoading }: { trace: PulsePlanTrace | null; isLoading: boolean }) {
  if (isLoading && !trace) {
    return (
      <div className="card" style={{ borderColor: 'rgba(94,230,207,0.14)' }}>
        <Skeleton height={10} width="34%" />
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          <Skeleton height={42} />
          <Skeleton height={42} />
          <Skeleton height={42} />
        </div>
      </div>
    );
  }
  if (!trace) return null;

  const sports = Object.entries(trace.sportMix);
  const recentSports = Object.entries(trace.inputSnapshot.recentSportMix);
  const goalNames = trace.inputSnapshot.goals.map(g => g.title);
  const riskTitles = trace.inputSnapshot.riskSignals.map(r => r.title);
  const load = trace.inputSnapshot.load;
  const learning = trace.inputSnapshot.learningSnapshot ?? null;

  return (
    <div className="card" style={{ borderColor: 'rgba(94,230,207,0.18)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <span className="label-mono" style={{ color: 'var(--accent)' }}>Einbezogene Daten</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          Woche {trace.weekStart}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 8, marginBottom: 12 }}>
        {[
          ['CTL', load.ctl.toFixed(1)],
          ['ATL', load.atl.toFixed(1)],
          ['TSB', load.tsb.toFixed(1)],
          ['Phase', trace.inputSnapshot.phase],
          ['Zielstunden', `${trace.inputSnapshot.weeklyHoursTarget}h`],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '8px 10px', background: 'var(--surface)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 14, color: label === 'TSB' && Number(value) < -12 ? 'var(--amber)' : 'var(--text)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {trace.generatedSummary.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          {trace.generatedSummary.map(item => (
            <p key={item} style={{ margin: 0, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>{item}</p>
          ))}
        </div>
      )}

      {learning && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8, marginBottom: 12 }}>
          <TraceInsightBlock title="Gelernt aus letzter Woche" items={learning.learnedFromLastWeek} color="var(--green)" />
          <TraceInsightBlock title="Variation" items={learning.variationComparedToLastWeek} color="var(--accent)" />
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {(goalNames.length > 0 ? goalNames : ['Kein aktives Ziel']).map(goal => (
          <span key={`goal-${goal}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', border: '1px solid rgba(94,230,207,0.35)', borderRadius: 4, padding: '3px 7px' }}>
            Ziel: {goal}
          </span>
        ))}
        {riskTitles.map(title => (
          <span key={`risk-${title}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 4, padding: '3px 7px' }}>
            Risk: {title}
          </span>
        ))}
        {trace.inputSnapshot.healthStates.map(state => (
          <span key={`${state.type}-${state.startDate}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rose)', border: '1px solid rgba(244,63,94,0.35)', borderRadius: 4, padding: '3px 7px' }}>
            Health: {state.type}{state.bodyPart ? ` · ${state.bodyPart}` : ''}
          </span>
        ))}
        {trace.inputSnapshot.recentRpe.length > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 7px' }}>
            RPE: {trace.inputSnapshot.recentRpe.length} jüngste Bewertung(en)
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <div>
          <div className="label-mono" style={{ fontSize: 9, marginBottom: 6 }}>Sportmix Plan</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sports.map(([sport, mix]) => (
              <span key={sport} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 7px' }}>
                {ACTIVITY_LABEL[sport] ?? sport}: {mix.sessions}x · {mix.totalMinutes}m
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="label-mono" style={{ fontSize: 9, marginBottom: 6 }}>Letzte 6 Wochen</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {recentSports.length > 0 ? recentSports.map(([sport, mix]) => (
              <span key={sport} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 7px' }}>
                {ACTIVITY_LABEL[sport] ?? sport}: {mix.sessions}x
              </span>
            )) : (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Keine Aktivitätshistorie.</span>
            )}
          </div>
        </div>
        <div>
          <div className="label-mono" style={{ fontSize: 9, marginBottom: 6 }}>Harte Tage</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {trace.hardDays.length > 0 ? trace.hardDays.map(day => (
              <span key={`${day.date}-${day.activityType}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rose)', border: '1px solid rgba(244,63,94,0.35)', borderRadius: 4, padding: '3px 7px' }}>
                {day.date} · Z{day.zone}
              </span>
            )) : (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Keine Z4/Z5-Reize.</span>
            )}
          </div>
        </div>
      </div>

      {trace.inputSnapshot.dataWarnings.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {trace.inputSnapshot.dataWarnings.map(warning => (
            <p key={warning} style={{ margin: 0, fontSize: 10.5, color: 'var(--amber)', lineHeight: 1.45 }}>{warning}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Training Tab ─────────────────────────────────────────────────────────────

function TrainingTab() {
  const acts      = usePulseActivities(14);
  const plan      = usePulsePlan();
  const goals     = usePulseGoals();
  const availability = useWeekAvailability();
  const generate  = useGeneratePlan();
  const navigate  = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<PlannedWorkout | null>(null);

  const selectedWeekDate = getMonday(new Date());
  selectedWeekDate.setDate(selectedWeekDate.getDate() + weekOffset * 7);
  const selectedWeekStart = isoDate(selectedWeekDate);
  const traceQuery = usePlanTrace(selectedWeekStart);
  const workouts   = plan.data?.workouts ?? [];
  const activities = acts.data?.activities ?? [];
  const generatedTrace = generate.data?.planTrace ?? null;
  const planTrace = traceQuery.data?.trace
    ?? (generatedTrace?.weekStart === selectedWeekStart ? generatedTrace : null);
  const planDecision = planTrace?.planDecision
    ?? (generatedTrace?.weekStart === selectedWeekStart ? generate.data?.planDecision : undefined);
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

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    await generate.mutateAsync();
    setShowConfig(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <NextTrainingDecisionCard
        nextWorkout={nextDecisionWorkout}
        availableDays={decisionAvailableDays}
        activeGoalsCount={activeGoals.length}
        planTrace={decisionPlanTrace}
        onOpen={setSelectedWorkout}
      />

      {/* WeekStrip */}
      <WeekStrip
        workouts={workouts}
        weekOffset={weekOffset}
        onChangeWeek={d => setWeekOffset(o => o + d)}
        onSelectWorkout={setSelectedWorkout}
      />

      {/* Availability */}
      <AvailabilityEditor />

      {/* Plan-Generator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="label-mono">Trainingsplan</div>
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
        </div>
      )}

      {planDecision && (
        <div className="card" style={{ borderColor: 'rgba(94,230,207,0.18)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
            <span className="label-mono" style={{ color: 'var(--accent)' }}>Plan-Entscheidung</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
              {planDecision.targetSessionCount} Einheiten
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {planDecision.selectedDays.map(day => (
              <span key={`sel-${day}`} style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)',
                border: '1px solid rgba(94,230,207,0.35)', borderRadius: 4, padding: '3px 7px',
              }}>
                {DAY_SHORT[day]} Training
              </span>
            ))}
            {planDecision.skippedAvailableDays.map(day => (
              <span key={`skip-${day}`} style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)',
                border: '1px solid var(--border)', borderRadius: 4, padding: '3px 7px',
              }}>
                {DAY_SHORT[day]} frei
              </span>
            ))}
          </div>
          {planDecision.reasons.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {planDecision.reasons.map(reason => (
                <p key={reason} style={{ margin: 0, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
                  {reason}
                </p>
              ))}
            </div>
          )}
        </div>
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
            <WorkoutRow key={w.id} workout={w} index={i} onOpen={() => setSelectedWorkout(w)} />
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
                  onClick={() => navigate(`/activity/${a.id}`)}
                  style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text)' }}>
                    {a.name ?? a.activityType}
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
          onClose={() => setSelectedWorkout(null)}
          onUpdate={updated => setSelectedWorkout(updated)}
        />
      )}
    </div>
  );
}

// ─── Ziele ────────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active:    'var(--green)',
  completed: 'var(--blue)',
  paused:    'var(--amber)',
  abandoned: 'var(--rose)',
};

const GOAL_CATEGORIES: { id: GoalCategory; label: string; color: string }[] = [
  { id: 'race',   label: 'Wettkampf', color: 'var(--rose)' },
  { id: 'weight', label: 'Gewicht',   color: 'var(--blue)' },
  { id: 'ftp',    label: 'FTP',       color: 'var(--amber)' },
  { id: 'vo2max', label: 'VO2max',    color: 'var(--green)' },
  { id: 'volume', label: 'Volumen',   color: 'var(--accent)' },
];

const RACE_TYPES = [
  { id: 'ironman',     label: 'Ironman (226km)',           discipline: 'triathlon_140_6',   distanceKm: 226 },
  { id: 'half',        label: '70.3 Half Ironman',          discipline: 'triathlon_70_3',    distanceKm: 113 },
  { id: 'olympic',     label: 'Olympische Distanz',         discipline: 'triathlon_olympic', distanceKm: 51.5 },
  { id: 'sprint',      label: 'Sprint Triathlon',           discipline: 'triathlon_sprint',  distanceKm: 25.75 },
  { id: 'marathon',    label: 'Marathon',                   discipline: 'run',               distanceKm: 42.2 },
  { id: 'half_marathon', label: 'Halbmarathon',             discipline: 'run',               distanceKm: 21.1 },
  { id: '10k',         label: '10 km Lauf',                 discipline: 'run',               distanceKm: 10 },
  { id: '5k',          label: '5 km Lauf',                  discipline: 'run',               distanceKm: 5 },
  { id: 'century',     label: 'Century Ride (160km)',       discipline: 'bike',              distanceKm: 160 },
  { id: 'custom',      label: 'Sonstiges',                  discipline: 'other',             distanceKm: null as number | null },
] as const;

function parseHmsToSec(hms: string): number | undefined {
  const t = hms.trim();
  if (!t) return undefined;
  const parts = t.split(':').map(p => Number(p));
  if (parts.some(p => isNaN(p))) return undefined;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 1) return parts[0]!;
  return undefined;
}

const CATEGORY_COLOR: Record<GoalCategory, string> = {
  race: 'var(--rose)', weight: 'var(--blue)', ftp: 'var(--amber)', vo2max: 'var(--green)', volume: 'var(--accent)',
};

type GoalFields = {
  category: GoalCategory; targetDate: string;
  raceType?: string; targetKg?: string; targetFtp?: string; targetVo2max?: string; targetHours?: string; notes?: string;
  racePriority?: 'A'|'B'|'C';
  raceTargetTime?: string;     // H:MM:SS or MM:SS
  raceLocation?: string;
};

function buildGoalPayload(fields: GoalFields): {
  title: string; description?: string; targetDate?: string;
  category: GoalCategory; metrics: Record<string, unknown>;
  raceDiscipline?: RaceDiscipline; raceDistanceKm?: number; raceTargetTimeSec?: number;
  racePriority?: 'A'|'B'|'C'; raceLocation?: string; raceNotes?: string;
} {
  const { category, targetDate } = fields;
  const metrics: Record<string, unknown> = {};
  let title = '';
  let description: string | undefined;

  if (category === 'race') {
    const race = RACE_TYPES.find(r => r.id === fields.raceType) ?? RACE_TYPES[RACE_TYPES.length - 1]!;
    title = race.label;
    if (fields.notes) description = fields.notes;
    metrics.raceType = fields.raceType;
    const targetSec = fields.raceTargetTime ? parseHmsToSec(fields.raceTargetTime) : undefined;
    return {
      title, description, targetDate: targetDate || undefined, category, metrics,
      raceDiscipline: race.discipline as RaceDiscipline,
      ...(race.distanceKm != null ? { raceDistanceKm: race.distanceKm } : {}),
      ...(targetSec != null     ? { raceTargetTimeSec: targetSec } : {}),
      racePriority: fields.racePriority ?? 'A',
      ...(fields.raceLocation ? { raceLocation: fields.raceLocation } : {}),
      ...(fields.notes        ? { raceNotes: fields.notes } : {}),
    };
  } else if (category === 'weight') {
    title = `Gewicht: ${fields.targetKg} kg`;
    metrics.targetKg = Number(fields.targetKg);
  } else if (category === 'ftp') {
    title = `FTP: ${fields.targetFtp} W`;
    metrics.targetFtp = Number(fields.targetFtp);
  } else if (category === 'vo2max') {
    title = `VO2max: ${fields.targetVo2max} ml/kg/min`;
    metrics.targetVo2max = Number(fields.targetVo2max);
  } else if (category === 'volume') {
    title = `Volumen: ${fields.targetHours} h/Woche`;
    metrics.targetHours = Number(fields.targetHours);
  }

  return { title, description, targetDate: targetDate || undefined, category, metrics };
}

const inputStyle = {
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '7px 10px',
  fontSize: 12, color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' as const,
};
const labelStyle = { fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' };

function GoalForm({ onDone }: { onDone: () => void }) {
  const create = useCreateGoal();
  const [category, setCategory] = useState<GoalCategory>('race');
  const [fields, setFields] = useState<GoalFields>({ category: 'race', targetDate: '', raceType: 'ironman' });

  function set(k: keyof GoalFields, v: string) {
    setFields(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync(buildGoalPayload({ ...fields, category }));
    onDone();
  }

  return (
    <div className="card">
      <div className="label-mono" style={{ marginBottom: 12 }}>Neues Ziel</div>
      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Category picker */}
        <div>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Kategorie</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {GOAL_CATEGORIES.map(cat => (
              <button key={cat.id} type="button" onClick={() => { setCategory(cat.id); setFields(f => ({ ...f, category: cat.id })); }} style={{
                padding: '6px 12px', border: `1px solid ${category === cat.id ? cat.color : 'var(--border)'}`,
                borderRadius: 4, background: category === cat.id ? translucent(cat.color, 9) : 'var(--surface)',
                color: category === cat.id ? cat.color : 'var(--text-2)',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', cursor: 'pointer',
              }}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category-specific fields */}
        {category === 'race' && (
          <>
            <div>
              <div style={{ ...labelStyle, marginBottom: 4 }}>Rennen</div>
              <select value={fields.raceType ?? 'ironman'} onChange={e => set('raceType', e.target.value)} style={inputStyle}>
                {RACE_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ ...labelStyle, marginBottom: 6 }}>Priorität</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['A','B','C'] as const).map(p => {
                  const desc = p === 'A' ? 'Saisonhöhepunkt · 2w Taper' : p === 'B' ? 'wichtig · 1w Taper' : 'Mitnahme · kein Taper';
                  const active = (fields.racePriority ?? 'A') === p;
                  return (
                    <button key={p} type="button" onClick={() => setFields(f => ({ ...f, racePriority: p }))} title={desc} style={{
                      flex: 1, padding: '6px', border: `1px solid ${active ? 'var(--rose)' : 'var(--border)'}`,
                      borderRadius: 4, background: active ? 'rgba(239,68,68,0.12)' : 'var(--surface)',
                      color: active ? 'var(--rose)' : 'var(--text-2)',
                      fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.1em', cursor: 'pointer',
                    }}>{p}</button>
                  );
                })}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                A: 2w Taper · B: 1w Taper · C: kein Taper
              </div>
            </div>
            <div>
              <div style={{ ...labelStyle, marginBottom: 4 }}>Zielzeit (h:mm:ss, optional)</div>
              <input type="text" value={fields.raceTargetTime ?? ''} onChange={e => set('raceTargetTime', e.target.value)} placeholder="5:15:00 oder 45:00" style={inputStyle} />
            </div>
            <div>
              <div style={{ ...labelStyle, marginBottom: 4 }}>Ort (optional)</div>
              <input type="text" value={fields.raceLocation ?? ''} onChange={e => set('raceLocation', e.target.value)} placeholder="z.B. Frankfurt am Main" style={inputStyle} />
            </div>
            <div>
              <div style={{ ...labelStyle, marginBottom: 4 }}>Notiz</div>
              <input type="text" value={fields.notes ?? ''} onChange={e => set('notes', e.target.value)} placeholder="Logistik, Pacing-Plan…" style={inputStyle} />
            </div>
          </>
        )}
        {category === 'weight' && (
          <div>
            <div style={{ ...labelStyle, marginBottom: 4 }}>Zielgewicht (kg)</div>
            <input type="number" min={30} max={200} step={0.1} required value={fields.targetKg ?? ''} onChange={e => set('targetKg', e.target.value)} style={inputStyle} />
          </div>
        )}
        {category === 'ftp' && (
          <div>
            <div style={{ ...labelStyle, marginBottom: 4 }}>Ziel-FTP (Watt)</div>
            <input type="number" min={50} max={600} required value={fields.targetFtp ?? ''} onChange={e => set('targetFtp', e.target.value)} style={inputStyle} />
          </div>
        )}
        {category === 'vo2max' && (
          <div>
            <div style={{ ...labelStyle, marginBottom: 4 }}>Ziel-VO2max (ml/kg/min)</div>
            <input type="number" min={20} max={90} step={0.1} required value={fields.targetVo2max ?? ''} onChange={e => set('targetVo2max', e.target.value)} style={inputStyle} />
          </div>
        )}
        {category === 'volume' && (
          <div>
            <div style={{ ...labelStyle, marginBottom: 4 }}>Ziel-Wochenstunden</div>
            <input type="number" min={1} max={40} step={0.5} required value={fields.targetHours ?? ''} onChange={e => set('targetHours', e.target.value)} style={inputStyle} />
          </div>
        )}

        {/* Date */}
        <div>
          <div style={{ ...labelStyle, marginBottom: 4 }}>Zieldatum</div>
          <input type="date" value={fields.targetDate} onChange={e => set('targetDate', e.target.value)} style={inputStyle} />
        </div>

        <button type="submit" disabled={create.isPending} style={{
          background: 'var(--surface-2)', border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)', padding: '9px',
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--accent)', cursor: 'pointer',
        }}>
          {create.isPending ? 'Speichern…' : 'Erstellen'}
        </button>
      </form>
    </div>
  );
}

function goalToFields(g: { category: string | null; metrics: Record<string, unknown>; targetDate: string | null; description: string | null }): GoalFields {
  const cat = (g.category ?? 'race') as GoalCategory;
  const m = g.metrics ?? {};
  return {
    category: cat,
    targetDate: g.targetDate ?? '',
    raceType:     cat === 'race'   ? String(m.raceType ?? 'ironman') : undefined,
    notes:        cat === 'race'   ? (g.description ?? undefined)    : undefined,
    targetKg:     cat === 'weight' ? String(m.targetKg ?? '')        : undefined,
    targetFtp:    cat === 'ftp'    ? String(m.targetFtp ?? '')       : undefined,
    targetVo2max: cat === 'vo2max' ? String(m.targetVo2max ?? '')    : undefined,
    targetHours:  cat === 'volume' ? String(m.targetHours ?? '')     : undefined,
  };
}

function GoalEditForm({ goal, onDone }: { goal: { id: string; category: string | null; metrics: Record<string, unknown>; targetDate: string | null; description: string | null; status: string }; onDone: () => void }) {
  const update = useUpdateGoal();
  const init = goalToFields(goal);
  const [category, setCategory] = useState<GoalCategory>(init.category);
  const [fields, setFields] = useState<GoalFields>(init);
  const [status, setStatus] = useState(goal.status);

  function set(k: keyof GoalFields, v: string) { setFields(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildGoalPayload({ ...fields, category });
    await update.mutateAsync({ id: goal.id, data: { ...payload, status } });
    onDone();
  }

  return (
    <div className="card" style={{ border: `1px solid ${translucent('var(--accent)', 20)}` }}>
      <div className="label-mono" style={{ marginBottom: 12 }}>Ziel bearbeiten</div>
      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Kategorie</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {GOAL_CATEGORIES.map(cat => (
              <button key={cat.id} type="button" onClick={() => { setCategory(cat.id); setFields(f => ({ ...f, category: cat.id })); }} style={{
                padding: '6px 12px', border: `1px solid ${category === cat.id ? cat.color : 'var(--border)'}`,
                borderRadius: 4, background: category === cat.id ? translucent(cat.color, 9) : 'var(--surface)',
                color: category === cat.id ? cat.color : 'var(--text-2)',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', cursor: 'pointer',
              }}>{cat.label}</button>
            ))}
          </div>
        </div>

        {category === 'race' && (<>
          <div><div style={{ ...labelStyle, marginBottom: 4 }}>Rennen</div>
            <select value={fields.raceType ?? 'ironman'} onChange={e => set('raceType', e.target.value)} style={inputStyle}>
              {RACE_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div><div style={{ ...labelStyle, marginBottom: 4 }}>Notiz (Zielzeit, Ort…)</div>
            <input type="text" value={fields.notes ?? ''} onChange={e => set('notes', e.target.value)} style={inputStyle} />
          </div>
        </>)}
        {category === 'weight' && <div><div style={{ ...labelStyle, marginBottom: 4 }}>Zielgewicht (kg)</div><input type="number" min={30} max={200} step={0.1} required value={fields.targetKg ?? ''} onChange={e => set('targetKg', e.target.value)} style={inputStyle} /></div>}
        {category === 'ftp'    && <div><div style={{ ...labelStyle, marginBottom: 4 }}>Ziel-FTP (Watt)</div><input type="number" min={50} max={600} required value={fields.targetFtp ?? ''} onChange={e => set('targetFtp', e.target.value)} style={inputStyle} /></div>}
        {category === 'vo2max' && <div><div style={{ ...labelStyle, marginBottom: 4 }}>Ziel-VO2max</div><input type="number" min={20} max={90} step={0.1} required value={fields.targetVo2max ?? ''} onChange={e => set('targetVo2max', e.target.value)} style={inputStyle} /></div>}
        {category === 'volume' && <div><div style={{ ...labelStyle, marginBottom: 4 }}>Ziel-Wochenstunden</div><input type="number" min={1} max={40} step={0.5} required value={fields.targetHours ?? ''} onChange={e => set('targetHours', e.target.value)} style={inputStyle} /></div>}

        <div><div style={{ ...labelStyle, marginBottom: 4 }}>Zieldatum</div>
          <input type="date" value={fields.targetDate} onChange={e => set('targetDate', e.target.value)} style={inputStyle} />
        </div>

        <div>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Status</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['active','paused','completed','abandoned'] as const).map(s => (
              <button key={s} type="button" onClick={() => setStatus(s)} style={{
                padding: '5px 10px', border: `1px solid ${status === s ? (STATUS_COLOR[s] ?? 'var(--border)') : 'var(--border)'}`,
                borderRadius: 4, background: status === s ? translucent(STATUS_COLOR[s] ?? 'var(--surface)', 13) : 'var(--surface)',
                color: status === s ? (STATUS_COLOR[s] ?? 'var(--text)') : 'var(--text-3)',
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer',
              }}>{s}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={update.isPending} style={{
            flex: 1, background: 'var(--surface-2)', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius)', padding: '9px',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--accent)', cursor: 'pointer',
          }}>{update.isPending ? 'Speichern…' : 'Speichern'}</button>
          <button type="button" onClick={onDone} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '9px 14px',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--text-3)', cursor: 'pointer',
          }}>Abbrechen</button>
        </div>
      </form>
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
  padding: '3px 8px', borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text-3)',
};

function GoalCard({ g }: { g: { id: string; title: string; description: string | null; targetDate: string | null; status: string; progress: number; category: string | null; metrics: Record<string, unknown> } }) {
  const deleteGoal = useDeleteGoal();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const cat = g.category as GoalCategory | null;
  const catColor = cat ? (CATEGORY_COLOR[cat] ?? 'var(--text-3)') : 'var(--text-3)';
  const statusColor = STATUS_COLOR[g.status] ?? 'var(--text-3)';

  if (editing) return <GoalEditForm goal={g} onDone={() => setEditing(false)} />;

  return (
    <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            {cat && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', color: catColor, background: translucent(catColor, 9), padding: '1px 5px', borderRadius: 2, textTransform: 'uppercase' }}>
                {GOAL_CATEGORIES.find(c => c.id === cat)?.label}
              </span>
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: statusColor }}>● {g.status}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>{g.title}</div>
          {g.description && <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>{g.description}</div>}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 12 }}>
          <button style={actionBtn} onClick={() => setEditing(true)}>Bearbeiten</button>
          {!confirmDelete
            ? <button style={{ ...actionBtn, color: 'var(--rose)', borderColor: translucent('var(--rose)', 20) }} onClick={() => setConfirmDelete(true)}>Löschen</button>
            : <>
                <button
                  style={{ ...actionBtn, color: 'var(--rose)', borderColor: 'var(--rose)', background: translucent('var(--rose)', 7) }}
                  onClick={() => {
                    setDeleteError(null);
                    deleteGoal.mutate(g.id, {
                      onError: (err) => setDeleteError(err instanceof Error ? err.message : 'Fehler'),
                    });
                  }}
                  disabled={deleteGoal.isPending}
                >
                  {deleteGoal.isPending ? '…' : 'Ja, löschen'}
                </button>
                <button style={actionBtn} onClick={() => setConfirmDelete(false)}>Nein</button>
              </>
          }
        </div>
      </div>
      {deleteError && <div style={{ fontSize: 10, color: 'var(--rose)', marginTop: 2 }}>{deleteError}</div>}

      <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, width: `${(g.progress ?? 0) * 100}%`, background: catColor }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
        <span>{Math.round((g.progress ?? 0) * 100)}% abgeschlossen</span>
        {g.targetDate && <span>bis {new Date(g.targetDate + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
      </div>
    </div>
  );
}

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

function isoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
  { id: 'ziele',    label: 'Ziele'    },
  { id: 'review',   label: 'Review'   },
  { id: 'statistik', label: 'Statistik' },
];

export default function Plan() {
  const [tab, setTab] = useState<Tab>('training');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="PLAN"
        title="Training, Ziele & Statistik"
        action={<SegmentedControl items={TABS} active={tab} onChange={id => setTab(id as Tab)} />}
      />
      {tab === 'training' && <TrainingTab />}
      {tab === 'ziele'    && <ZieleTab />}
      {tab === 'review'   && <ReviewTab />}
      {tab === 'statistik' && <StatistikTab />}
    </div>
  );
}
