import { useState } from 'react';
import {
  usePulseActivities, usePulsePlan, usePulseGoals,
  useCreateGoal, usePulseReview, useGenerateReview,
} from '@/pulse/hooks';

type Tab = 'training' | 'ziele' | 'review';

function fmt(v: number | null | undefined, decimals = 1, suffix = ''): string {
  return v == null ? '–' : `${v.toFixed(decimals)}${suffix}`;
}

const ZONE_COLOR: Record<number, string> = {
  1: 'var(--blue)',
  2: 'var(--blue)',
  3: 'var(--green)',
  4: 'var(--amber)',
  5: 'var(--rose)',
};

function TabBar({ tabs, active, onChange }: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border)' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            paddingBottom: 10,
            color: active === t.id ? 'var(--text)' : 'var(--text-3)',
            background: 'none',
            border: 'none',
            borderBottom: active === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em' }}
      className="py-10 text-center uppercase">
      Loading…
    </div>
  );
}

// ─── Training ─────────────────────────────────────────────────────────────────

function TrainingTab() {
  const acts = usePulseActivities(14);
  const plan = usePulsePlan();

  const workouts   = plan.data?.workouts ?? [];
  const activities = acts.data?.activities ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Plan */}
      <section>
        <div className="label-mono" style={{ marginBottom: 10 }}>Trainingsplan</div>
        {plan.isLoading && <Loading />}
        {!plan.isLoading && workouts.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>Kein Plan vorhanden.</p>
        )}
        {workouts.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {workouts.map((w, i) => (
              <div
                key={w.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{w.plannedDate}</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
                        color: ZONE_COLOR[w.zone] ?? 'var(--text-3)',
                        border: `1px solid ${ZONE_COLOR[w.zone] ?? 'var(--border)'}`,
                        borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase',
                      }}
                    >
                      Z{w.zone}
                    </span>
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
      </section>

      {/* Activities */}
      <section>
        <div className="label-mono" style={{ marginBottom: 10 }}>Aktivitäten — 14 Tage</div>
        {acts.isLoading && <Loading />}
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
                  <tr key={a.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
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
      </section>
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
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: showForm ? 'var(--rose)' : 'var(--accent)', cursor: 'pointer',
          }}
        >
          {showForm ? 'Abbrechen' : '+ Ziel'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="label-mono" style={{ marginBottom: 12 }}>Neues Ziel</div>
          <form onSubmit={(e) => void handleCreate(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { id: 'g-title', label: 'Titel *', key: 'title', type: 'text', required: true },
              { id: 'g-desc',  label: 'Beschreibung', key: 'description', type: 'text', required: false },
            ].map(field => (
              <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor={field.id} style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  {field.label}
                </label>
                <input
                  id={field.id}
                  type={field.type}
                  required={field.required}
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
              <input
                id="g-date" type="date" value={form.targetDate}
                onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '7px 12px',
                  fontSize: 12, color: 'var(--text)', outline: 'none',
                }}
              />
            </div>
            <button
              type="submit" disabled={create.isPending}
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--accent)',
                borderRadius: 'var(--radius)', padding: '9px', fontFamily: 'var(--font-mono)',
                fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'var(--accent)', cursor: 'pointer',
              }}
            >
              {create.isPending ? 'Speichern…' : 'Erstellen'}
            </button>
          </form>
        </div>
      )}

      {isLoading && <Loading />}

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
              {/* Progress bar */}
              <div style={{ marginTop: 8, height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${(g.progress ?? 0) * 100}%`,
                  background: STATUS_COLOR[g.status] ?? 'var(--text-3)',
                }} />
              </div>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: STATUS_COLOR[g.status] ?? 'var(--text-3)',
                border: `1px solid ${STATUS_COLOR[g.status] ?? 'var(--border)'}`,
                borderRadius: 3, padding: '2px 6px', flexShrink: 0,
              }}
            >
              {g.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Review ───────────────────────────────────────────────────────────────────

function ReviewTab() {
  const { data, isLoading } = usePulseReview();
  const generate = useGenerateReview();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-2)', cursor: 'pointer',
          }}
        >
          {generate.isPending ? 'Erstelle…' : 'Neu erstellen'}
        </button>
      </div>

      {isLoading && <Loading />}

      {!isLoading && !data && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Kein Wochenreview vorhanden. "Neu erstellen" für KI-Analyse der letzten Woche.
          </p>
        </div>
      )}

      {data && (
        <div className="card">
          <div className="label-mono" style={{ marginBottom: 8 }}>
            {data.weekStart} — {data.weekEnd}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {data.narrative}
          </p>
        </div>
      )}
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
