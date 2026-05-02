import { useState, type FormEvent } from 'react';
import { Skeleton } from '@/components/Skeleton';
import { RangeControl } from '@/components/PulseChrome';
import { ThemeTimeline } from '@/components/ThemeTimeline';
import { useCheckinGuidance, useCheckinHistory, useCheckinToday, usePulseCheckin } from '@/pulse/hooks';
import { GarminDomainHint } from '@/features/data/coverage/coverage-components';

const RANGE_OPTS = [
  { value: 7, label: '7T' },
  { value: 30, label: '30T' },
  { value: 90, label: '90T' },
];

function SegmentedBar({ label, value, onChange, color = 'var(--accent)' }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color?: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color }}>{value}/10</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            onClick={() => onChange(i + 1)}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 1,
              cursor: 'pointer',
              background: i < value ? color : 'var(--bg)',
              border: '1px solid var(--border)',
              transition: 'background 0.1s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function MentalTab() {
  const [days, setDays] = useState(30);
  const { data: today } = useCheckinToday();
  const { data: guidance } = useCheckinGuidance();
  const checkin = usePulseCheckin();
  const { data: histData, isLoading: histLoading } = useCheckinHistory(days);
  const [form, setForm] = useState({ mood: 7, energy: 7, stress: 3, motivation: 7, notes: '' });
  const [submitted, setSubmitted] = useState(false);

  function appendNote(label: string) {
    setForm(f => {
      const next = f.notes.trim().length > 0 ? `${f.notes.trim()}\n${label}` : label;
      return { ...f, notes: next };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await checkin.mutateAsync({ ...form, notes: form.notes || undefined });
    setSubmitted(true);
  }

  const alreadyDone = today?.checkin != null;
  const checkins = histData?.checkins ?? [];
  const guidedQuestions = guidance?.questions.length
    ? guidance.questions
    : [
        {
          id: 'fallback-stability',
          label: 'Was brauchst du mental, damit heute stabil bleibt?',
          rationale: 'Basisfrage für einen freien Check-in.',
        },
        {
          id: 'fallback-smaller',
          label: 'Was darf heute bewusst kleiner bleiben?',
          rationale: 'Hilft, den Tagesanspruch realistisch zu setzen.',
        },
        {
          id: 'fallback-closure',
          label: 'Welcher kleine Abschluss würde sich heute gut anfühlen?',
          rationale: 'Macht den Tag bewusst abschließbar.',
        },
      ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <GarminDomainHint domains={['daily_metrics', 'hrv', 'sleep']} />

      {alreadyDone || submitted ? (
        <div className="card" style={{ borderColor: 'rgba(74,222,128,0.3)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', letterSpacing: '0.12em' }}>
            CHECK-IN HEUTE ERLEDIGT ✓
          </span>
        </div>
      ) : (
        <div className="card">
          <div style={{ marginBottom: 14 }}>
            <div className="label-mono" style={{ marginBottom: 6 }}>Geführter Daily Check-in</div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
              Kurzer Lageabgleich für Körper und Kopf. Die Werte bleiben kompakt, die Notiz hält fest, was mental wirklich zählt.
            </p>
          </div>
          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>Wie ist dein Kopf gerade?</p>
                <SegmentedBar label="Stimmung" value={form.mood} onChange={(v) => setForm(f => ({ ...f, mood: v }))} color="var(--accent)" />
              </div>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>Wie viel Energie ist verfügbar?</p>
                <SegmentedBar label="Energie" value={form.energy} onChange={(v) => setForm(f => ({ ...f, energy: v }))} color="var(--green)" />
              </div>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>Was zieht gerade mentale Energie?</p>
                <SegmentedBar label="Stress" value={form.stress} onChange={(v) => setForm(f => ({ ...f, stress: v }))} color="var(--amber)" />
              </div>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>Was wäre heute genug?</p>
                <SegmentedBar label="Motivation" value={form.motivation} onChange={(v) => setForm(f => ({ ...f, motivation: v }))} color="var(--blue)" />
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 8,
              padding: '10px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
            }}>
              {guidedQuestions.map(question => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => appendNote(question.label)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-2)',
                    fontSize: 12,
                    lineHeight: 1.4,
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <span style={{ display: 'block', color: 'var(--text)' }}>{question.label}</span>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 10.5, color: 'var(--text-3)' }}>
                    {question.rationale}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Mental: ruhig', 'Mental: angespannt', 'Mental: überladen', 'Fokus: klar', 'Fokus: zerstreut', 'Schutz: aktiv einplanen', 'Heute genug: klein halten'].map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => appendNote(tag)}
                  style={{
                    padding: '5px 8px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--text-2)',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={4}
              placeholder="Was ist mental gerade wichtig? Was belastet, was schützt dich heute, und was wäre ein guter kleiner Abschluss?"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--text)',
                resize: 'none',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={checkin.isPending}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius)',
                padding: '9px 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                cursor: 'pointer',
              }}
            >
              {checkin.isPending ? 'Speichern…' : 'Check-in senden'}
            </button>
          </form>
        </div>
      )}

      <ThemeTimeline />

      {checkins.length >= 3 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="label-mono">Mental Trend</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                <span style={{ color: 'var(--accent)' }}>━</span>{' '}
                <span style={{ color: 'var(--text-2)' }}>Mood</span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                <span style={{ color: 'var(--green)' }}>━</span>{' '}
                <span style={{ color: 'var(--text-2)' }}>Energy</span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                <span style={{ color: 'var(--amber)' }}>━</span>{' '}
                <span style={{ color: 'var(--text-2)' }}>Stress</span>
              </span>
            </div>
            <RangeControl value={days} onChange={setDays} options={RANGE_OPTS} />
          </div>
          {histLoading ? <Skeleton height={100} /> : (() => {
            const N = checkins.length;
            const W = 400;
            const H = 100;
            const P = 10;
            const yMin = 0;
            const yMax = 10;
            const xs = (i: number) => P + (i / (N - 1)) * (W - P * 2);
            const ys = (v: number) => H - P - ((v - yMin) / (yMax - yMin)) * (H - P * 2);
            const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i)} ${ys(v)}`).join(' ');
            return (
              <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 100 }}>
                {[2, 4, 6, 8].map(t => (
                  <line key={t} x1={P} x2={W - P} y1={ys(t)} y2={ys(t)} stroke="var(--border)" strokeWidth={0.5} />
                ))}
                <path d={path(checkins.map(c => c.mood))} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
                <path d={path(checkins.map(c => c.energy))} fill="none" stroke="var(--green)" strokeWidth={1.6} />
                <path d={path(checkins.map(c => c.stress))} fill="none" stroke="var(--amber)" strokeWidth={1.4} opacity={0.85} />
              </svg>
            );
          })()}
        </div>
      )}
    </div>
  );
}
