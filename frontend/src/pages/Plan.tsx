import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  usePulseActivities, usePulsePlan, usePulseGoals,
  useCreateGoal, usePulseReview, useGenerateReview, useGeneratePlan,
  useTrainingAnalytics,
} from '@/pulse/hooks';
import { LineChart } from '@/components/SparkChart';
import { Skeleton } from '@/components/Skeleton';
import { WorkoutDetailModal } from '@/components/WorkoutDetailModal';
import type { PulsePlannedWorkout } from '@coaching-os/shared/pulse';

type Tab = 'training' | 'ziele' | 'review' | 'analyse';

function fmt(v: number | null | undefined, decimals = 1, suffix = ''): string {
  return v == null ? '–' : `${v.toFixed(decimals)}${suffix}`;
}

const ZONE_COLOR: Record<number, string> = {
  1: 'var(--blue)', 2: 'var(--blue)', 3: 'var(--green)', 4: 'var(--amber)', 5: 'var(--rose)',
};

// ─── Shared ───────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 1, padding: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, alignSelf: 'flex-start' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.1em',
          background: active === t.id ? 'var(--surface-2)' : 'transparent',
          color: active === t.id ? 'var(--accent)' : 'var(--text-2)',
          borderRadius: 3, textTransform: 'uppercase', border: 'none', cursor: 'pointer',
          transition: 'background 0.12s, color 0.12s',
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

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

// ─── Training Tab ─────────────────────────────────────────────────────────────

function TrainingTab() {
  const acts      = usePulseActivities(14);
  const plan      = usePulsePlan();
  const generate  = useGeneratePlan();
  const navigate  = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [hoursPerWeek, setHoursPerWeek] = useState('8');
  const [selectedWorkout, setSelectedWorkout] = useState<PlannedWorkout | null>(null);

  const workouts   = plan.data?.workouts ?? [];
  const activities = acts.data?.activities ?? [];

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    await generate.mutateAsync();
    setShowConfig(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* WeekStrip */}
      <WeekStrip
        workouts={workouts}
        weekOffset={weekOffset}
        onChangeWeek={d => setWeekOffset(o => o + d)}
        onSelectWorkout={setSelectedWorkout}
      />

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
          <div className="label-mono" style={{ marginBottom: 12, color: 'var(--accent)' }}>Plan generieren</div>
          <form onSubmit={(e) => void handleGenerate(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                Stunden / Woche
              </label>
              <input
                type="number" min="2" max="30" step="0.5" value={hoursPerWeek}
                onChange={e => setHoursPerWeek(e.target.value)}
                style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '7px 12px',
                  fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', outline: 'none',
                }}
              />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
              Generiert einen 7-Tage-Trainingsplan basierend auf aktuellem CTL/ATL/TSB und deinen Zielen.
            </p>
            <button type="submit" disabled={generate.isPending} style={{
              background: 'var(--surface-2)', border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)', padding: '9px', fontFamily: 'var(--font-mono)',
              fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--accent)', cursor: 'pointer',
            }}>
              {generate.isPending ? '● Generiere…' : 'Plan erstellen'}
            </button>
          </form>
        </div>
      )}

      {plan.isLoading && <Loading />}
      {!plan.isLoading && workouts.length === 0 && !showConfig && (
        <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '4px 0' }}>
          Kein Plan — "Plan generieren" für KI-Vorschlag.
        </p>
      )}

      {workouts.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {workouts.map((w, i) => (
            <div key={w.id}
              onClick={() => setSelectedWorkout(w)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px',
                borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                opacity: w.status === 'skipped' ? 0.45 : 1,
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
                    {w.plannedDate}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
                    color: ZONE_COLOR[w.zone] ?? 'var(--text-3)',
                    border: `1px solid ${ZONE_COLOR[w.zone] ?? 'var(--border)'}`,
                    borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase',
                  }}>Z{w.zone}</span>
                  {w.status === 'completed' && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--green)' }}>✓</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)' }}>{w.activityType}</div>
                {w.description && (
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
          ))}
        </div>
      )}

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

function ZieleTab() {
  const { data, isLoading } = usePulseGoals();
  const create   = useCreateGoal();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', targetDate: '' });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      title: form.title,
      description: form.description || undefined,
      targetDate: form.targetDate || undefined,
    });
    setForm({ title: '', description: '', targetDate: '' });
    setShowForm(false);
  }

  const goals = data?.goals ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowForm(v => !v)} style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 10,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: showForm ? 'var(--rose)' : 'var(--accent)', cursor: 'pointer',
        }}>
          {showForm ? 'Abbrechen' : '+ Ziel'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="label-mono" style={{ marginBottom: 12 }}>Neues Ziel</div>
          <form onSubmit={(e) => void handleCreate(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { id: 'g-title', label: 'Titel *', key: 'title', required: true },
              { id: 'g-desc',  label: 'Beschreibung', key: 'description', required: false },
            ].map(field => (
              <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor={field.id} style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  {field.label}
                </label>
                <input id={field.id} type="text" required={field.required}
                  value={form[field.key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '7px 12px',
                    fontSize: 12, color: 'var(--text)', outline: 'none',
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="g-date" style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                Zieldatum
              </label>
              <input id="g-date" type="date" value={form.targetDate}
                onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '7px 12px',
                  fontSize: 12, color: 'var(--text)', outline: 'none',
                }}
              />
            </div>
            <button type="submit" disabled={create.isPending} style={{
              background: 'var(--surface-2)', border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)', padding: '9px', fontFamily: 'var(--font-mono)',
              fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--accent)', cursor: 'pointer',
            }}>
              {create.isPending ? 'Speichern…' : 'Erstellen'}
            </button>
          </form>
        </div>
      )}

      {isLoading && <Loading rows={2} />}
      {!isLoading && goals.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>
          Noch keine Ziele. Erstelle dein erstes!
        </p>
      )}

      {goals.map(g => (
        <div key={g.id} className="card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{g.title}</div>
              {g.description && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>{g.description}</div>
              )}
              {g.targetDate && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
                  Bis {g.targetDate}
                </div>
              )}
              <div style={{ marginTop: 8, height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${(g.progress ?? 0) * 100}%`,
                  background: STATUS_COLOR[g.status] ?? 'var(--text-3)',
                }} />
              </div>
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: STATUS_COLOR[g.status] ?? 'var(--text-3)',
              border: `1px solid ${STATUS_COLOR[g.status] ?? 'var(--border)'}`,
              borderRadius: 3, padding: '2px 6px', flexShrink: 0,
            }}>
              {g.status}
            </span>
          </div>
        </div>
      ))}
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
    let body = narrative;

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

// ─── Analyse ──────────────────────────────────────────────────────────────────

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
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 10px', borderRadius: 4, letterSpacing: '0.1em',
          background: value === o.value ? 'var(--surface-2)' : 'transparent',
          color: value === o.value ? 'var(--text)' : 'var(--text-3)',
          border: '1px solid ' + (value === o.value ? 'var(--border)' : 'transparent'),
          cursor: 'pointer',
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function AnalyseTab() {
  const [weeks, setWeeks] = useState(12);
  const { data, isLoading } = useTrainingAnalytics(weeks);

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

  // VO2max trend
  const vo2Labels = vo2maxRaw.map(d => d.date);
  const vo2Values = vo2maxRaw.map(d => d.vo2max);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Week range selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <RangePicker value={weeks} onChange={setWeeks} options={WEEK_RANGE_OPTS} />
      </div>

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
  { id: 'analyse',  label: 'Analyse'  },
];

export default function Plan() {
  const [tab, setTab] = useState<Tab>('training');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '.18em', marginBottom: 3 }}>PLAN</div>
          <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Training, Ziele & Review</h1>
        </div>
        <TabBar tabs={TABS} active={tab} onChange={id => setTab(id as Tab)} />
      </div>
      {tab === 'training' && <TrainingTab />}
      {tab === 'ziele'    && <ZieleTab />}
      {tab === 'review'   && <ReviewTab />}
      {tab === 'analyse'  && <AnalyseTab />}
    </div>
  );
}
