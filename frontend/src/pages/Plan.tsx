import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  usePulseActivities, usePulsePlan, usePulseGoals,
  useCreateGoal, usePulseReview, useGenerateReview, useGeneratePlan,
} from '@/pulse/hooks';
import { Skeleton } from '@/components/Skeleton';

type Tab = 'training' | 'ziele' | 'review';

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
    <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border)' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
          textTransform: 'uppercase', paddingBottom: 10,
          color: active === t.id ? 'var(--text)' : 'var(--text-3)',
          background: 'none', border: 'none',
          borderBottom: active === t.id ? '2px solid var(--accent)' : '2px solid transparent',
          cursor: 'pointer', transition: 'color 0.15s',
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
  return d.toISOString().split('T')[0]!;
}

interface PlannedWorkout {
  id: string;
  plannedDate: string;
  activityType: string;
  zone: number;
  durationMin: number;
  distanceKm: number | null;
  status: string;
  description: string | null;
}

function WeekStrip({ workouts, weekOffset, onChangeWeek }: {
  workouts: PlannedWorkout[];
  weekOffset: number;
  onChangeWeek: (delta: number) => void;
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
    <div className="card" style={{ padding: '12px 14px' }}>
      {/* Week nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
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

      {/* Day columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {days.map(({ date, dayNum, dayIdx }) => {
          const workout = workouts.find(w => w.plannedDate === date);
          const isToday = date === today;
          const isPast  = date < today;
          const isDone  = workout?.status === 'completed';
          const isSkipped = workout?.status === 'skipped';
          const zoneColor = workout ? (ZONE_COLOR[workout.zone] ?? 'var(--text-3)') : 'transparent';

          return (
            <div key={date} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              {/* Day label */}
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
                color: isToday ? 'var(--accent)' : 'var(--text-3)',
                textTransform: 'uppercase',
              }}>
                {DAY_SHORT[dayIdx]}
              </span>

              {/* Day number + indicator */}
              <div style={{
                width: 28, height: 28, borderRadius: 'var(--radius)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: isToday ? 'var(--surface-2)' : 'transparent',
                border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
                position: 'relative',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: isToday ? 600 : 400,
                  color: isToday ? 'var(--accent)' : isPast ? 'var(--text-3)' : 'var(--text-2)',
                }}>
                  {dayNum}
                </span>
              </div>

              {/* Zone bar */}
              {workout ? (
                <div style={{
                  width: '100%', height: 4, borderRadius: 2,
                  background: isDone ? zoneColor : isSkipped ? 'var(--border)' : zoneColor,
                  opacity: isDone ? 1 : isSkipped ? 0.3 : isPast ? 0.5 : 1,
                }} />
              ) : (
                <div style={{ width: '100%', height: 4 }} />
              )}

              {/* Activity type abbrev */}
              {workout && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.08em',
                  color: isDone ? zoneColor : isSkipped ? 'var(--text-3)' : 'var(--text-3)',
                  textTransform: 'uppercase',
                  textDecoration: isSkipped ? 'line-through' : 'none',
                }}>
                  {workout.activityType.slice(0, 3)}
                </span>
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
            <div key={w.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              borderTop: i > 0 ? '1px solid var(--border)' : undefined,
              opacity: w.status === 'skipped' ? 0.45 : 1,
            }}>
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', flexShrink: 0, marginLeft: 8 }}>
                {w.durationMin}m{w.distanceKm ? ` · ${w.distanceKm.toFixed(1)}km` : ''}
              </span>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'training', label: 'Training' },
  { id: 'ziele',    label: 'Ziele'    },
  { id: 'review',   label: 'Review'   },
];

export default function Plan() {
  const [tab, setTab] = useState<Tab>('training');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>Plan</h1>
      <TabBar tabs={TABS} active={tab} onChange={id => setTab(id as Tab)} />
      {tab === 'training' && <TrainingTab />}
      {tab === 'ziele'    && <ZieleTab />}
      {tab === 'review'   && <ReviewTab />}
    </div>
  );
}
