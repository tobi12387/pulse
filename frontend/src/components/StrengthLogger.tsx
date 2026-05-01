import { useMemo, useState, type FormEvent } from 'react';
import type { PulsePlannedWorkout, PulseStrengthSession, PulseStrengthTrendPoint } from '@coaching-os/shared/pulse';
import { LineChart } from '@/components/SparkChart';
import { RpeBar } from '@/components/RpeBar';
import { rpeColor } from '@/lib/rpe';
import { useCreateStrengthSession, useDeleteStrengthSession, useStrengthSessions } from '@/pulse/hooks';

const EXERCISES = ['Squat', 'Deadlift', 'Bench', 'OHP', 'Pullup', 'Lunges', 'RDL', 'Hip Thrust', 'Calf Raise', 'Plank'];

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type DraftSet = {
  exercise: string;
  reps: string;
  weightKg: string;
  rpe: number;
};

function emptySet(exercise = EXERCISES[0]!): DraftSet {
  return { exercise, reps: '8', weightKg: '', rpe: 7 };
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function bestSets(session: PulseStrengthSession) {
  const bestByExercise = new Map<string, { reps: number; weightKg: number | null; rpe: number | null; e1rmKg: number | null }>();
  for (const set of session.sets) {
    const prev = bestByExercise.get(set.exercise);
    if ((set.e1rmKg ?? 0) > (prev?.e1rmKg ?? 0)) {
      bestByExercise.set(set.exercise, {
        reps: set.reps,
        weightKg: set.weightKg,
        rpe: set.rpe,
        e1rmKg: set.e1rmKg,
      });
    }
  }
  return Array.from(bestByExercise.entries()).slice(0, 4);
}

function buildTrendSummaries(trends: PulseStrengthTrendPoint[]) {
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
      return {
        exercise,
        labels: sorted.map(point => point.date),
        values: sorted.map(point => point.e1rmKg),
        last,
        deltaPct,
      };
    })
    .sort((a, b) => (b.last ?? 0) - (a.last ?? 0))
    .slice(0, 4);
}

export function StrengthLogger({ plannedWorkout }: {
  plannedWorkout: PulsePlannedWorkout | null;
}) {
  const sessionsQuery = useStrengthSessions(90);
  const create = useCreateStrengthSession();
  const remove = useDeleteStrengthSession();
  const [date, setDate] = useState(plannedWorkout?.plannedDate ?? todayLocal());
  const [durationMin, setDurationMin] = useState(String(plannedWorkout?.durationMin ?? 45));
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState<DraftSet>(() => emptySet());
  const [sets, setSets] = useState<DraftSet[]>([]);
  const [error, setError] = useState<string | null>(null);

  const trends = useMemo(() => buildTrendSummaries(sessionsQuery.data?.trends ?? []), [sessionsQuery.data?.trends]);
  const recent = sessionsQuery.data?.sessions.slice(0, 3) ?? [];

  function addSet(next: DraftSet = draft) {
    const reps = parseNumber(next.reps);
    if (reps == null || reps < 1) {
      setError('Reps fehlen.');
      return;
    }
    setError(null);
    setSets(current => [...current, next]);
    setDraft(f => ({ ...f, reps: next.reps, weightKg: next.weightKg, rpe: next.rpe }));
  }

  function repeatLast() {
    const last = sets[sets.length - 1];
    if (last) addSet(last);
  }

  function bumpWeight(delta: number) {
    const current = parseNumber(draft.weightKg) ?? 0;
    setDraft(f => ({ ...f, weightKg: String(Math.max(0, current + delta)) }));
  }

  function bumpRep(delta: number) {
    const current = parseNumber(draft.reps) ?? 0;
    setDraft(f => ({ ...f, reps: String(Math.max(1, current + delta)) }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (sets.length === 0) {
      setError('Mindestens ein Satz fehlt.');
      return;
    }

    const setNumberByExercise = new Map<string, number>();
    try {
      await create.mutateAsync({
        date,
        plannedWorkoutId: plannedWorkout?.id ?? null,
        durationMin: parseNumber(durationMin),
        notes: notes.trim() ? notes.trim() : null,
        sets: sets.map(set => {
          const setNumber = (setNumberByExercise.get(set.exercise) ?? 0) + 1;
          setNumberByExercise.set(set.exercise, setNumber);
          return {
            exercise: set.exercise,
            setNumber,
            reps: parseNumber(set.reps) ?? 1,
            weightKg: parseNumber(set.weightKg),
            rpe: set.rpe,
          };
        }),
      });
      setSets([]);
      setNotes('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Krafteinheit konnte nicht gespeichert werden.');
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <div>
          <span className="label-mono" style={{ color: 'var(--accent)' }}>Kraft-Logger</span>
          {plannedWorkout && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              verbunden mit Plan: {plannedWorkout.description ?? 'Krafteinheit'}
            </div>
          )}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          {sets.length} Satz{sets.length === 1 ? '' : 'e'}
        </span>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 8 }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          <input
            type="number"
            min={1}
            max={360}
            value={durationMin}
            onChange={e => setDurationMin(e.target.value)}
            placeholder="Min"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 74px 86px', gap: 8 }}>
          <select value={draft.exercise} onChange={e => setDraft(f => ({ ...f, exercise: e.target.value }))} style={inputStyle}>
            {EXERCISES.map(exercise => <option key={exercise} value={exercise}>{exercise}</option>)}
          </select>
          <input
            type="number"
            min={1}
            value={draft.reps}
            onChange={e => setDraft(f => ({ ...f, reps: e.target.value }))}
            placeholder="Reps"
            style={inputStyle}
          />
          <input
            type="number"
            min={0}
            step={0.5}
            value={draft.weightKg}
            onChange={e => setDraft(f => ({ ...f, weightKg: e.target.value }))}
            placeholder="kg"
            style={inputStyle}
          />
        </div>

        <RpeBar value={draft.rpe} onChange={rpe => setDraft(f => ({ ...f, rpe }))} />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => addSet()} style={smallButtonStyle}>+ Satz</button>
          <button type="button" onClick={repeatLast} disabled={sets.length === 0} style={smallButtonStyle}>Wiederholen</button>
          <button type="button" onClick={() => bumpWeight(5)} style={smallButtonStyle}>+5 kg</button>
          <button type="button" onClick={() => bumpRep(1)} style={smallButtonStyle}>+1 Rep</button>
        </div>

        {sets.length > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
            {sets.map((set, index) => (
              <div
                key={`${set.exercise}-${index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 8,
                  alignItems: 'center',
                  padding: '7px 9px',
                  borderTop: index > 0 ? '1px solid var(--border)' : undefined,
                  background: 'var(--surface)',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{set.exercise}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
                  {set.reps} x {set.weightKg || 'BW'} @ RPE {set.rpe}
                </span>
                <button
                  type="button"
                  onClick={() => setSets(current => current.filter((_, i) => i !== index))}
                  style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                  aria-label="Satz entfernen"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value.slice(0, 1000))}
          placeholder="Notiz optional"
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />

        {error && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rose)' }}>{error}</div>}

        <button type="submit" disabled={create.isPending || sets.length === 0} style={submitStyle}>
          {create.isPending ? 'Speichert...' : 'Krafteinheit speichern'}
        </button>
      </form>

      {(trends.length > 0 || recent.length > 0) && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 14 }}>
          {trends.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
              {trends.map(trend => (
                <div key={trend.exercise} style={{ border: '1px solid var(--border)', borderRadius: 5, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{trend.exercise}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: trend.deltaPct != null && trend.deltaPct < 0 ? 'var(--amber)' : 'var(--green)' }}>
                      {trend.deltaPct == null ? 'neu' : `${trend.deltaPct >= 0 ? '+' : ''}${trend.deltaPct.toFixed(1)}%`}
                    </span>
                  </div>
                  <LineChart values={trend.values} labels={trend.labels} height={52} color="var(--accent)" fillOpacity={0.08} />
                </div>
              ))}
            </div>
          )}

          {recent.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="label-mono">Letzte Einheiten</div>
              {recent.map(session => (
                <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 7 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>
                      {session.date} · {session.durationMin ?? '–'} min
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {bestSets(session).map(([exercise, best]) => (
                        <span key={exercise} style={{ fontSize: 11, color: rpeColor(best.rpe ?? 5) }}>
                          {exercise} {best.e1rmKg ? `${best.e1rmKg.toFixed(1)} e1RM` : `${best.reps} reps`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove.mutate(session.id)}
                    disabled={remove.isPending}
                    style={{ ...smallButtonStyle, alignSelf: 'flex-start' }}
                  >
                    Löschen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '7px 9px',
  color: 'var(--text)',
  fontSize: 12,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
} as const;

const smallButtonStyle = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '5px 9px',
  color: 'var(--text-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
} as const;

const submitStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius)',
  padding: '10px',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--accent)',
  cursor: 'pointer',
} as const;
