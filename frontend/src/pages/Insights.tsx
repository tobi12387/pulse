import { useState } from 'react';
import { useDeepInsight, useRefreshInsight } from '@/pulse/hooks';
import { MentalLoadOverlay } from '@/components/MentalLoadOverlay';

type Domain = 'overall' | 'sleep' | 'hrv' | 'load' | 'weight' | 'mental';

const DOMAINS: { key: Domain; label: string; emoji: string; color: string }[] = [
  { key: 'overall',  label: 'Gesamt',    emoji: '⚡', color: 'var(--accent)' },
  { key: 'sleep',    label: 'Schlaf',    emoji: '🌙', color: 'var(--blue)'   },
  { key: 'hrv',      label: 'HRV',       emoji: '💓', color: 'var(--green)'  },
  { key: 'load',     label: 'Belastung', emoji: '🏋️', color: 'var(--amber)'  },
  { key: 'weight',   label: 'Gewicht',   emoji: '⚖️', color: 'var(--text-2)' },
  { key: 'mental',   label: 'Mental',    emoji: '🧠', color: 'var(--rose)'   },
];

const DAYS_OPTIONS = [7, 30, 90];

function InsightCard({ domain, days }: { domain: Domain; days: number }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, isFetching, error, refetch } = useDeepInsight(domain, days, expanded);
  const refresh = useRefreshInsight(domain, days);
  const meta = DOMAINS.find(d => d.key === domain)!;
  const isBusy = isLoading || isFetching || refresh.isPending;

  return (
    <div
      className="card"
      style={{ padding: 0, overflow: 'hidden', borderColor: expanded ? meta.color + '44' : 'var(--border)' }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-3"
        style={{ padding: '12px 14px', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-2.5">
          <span style={{ fontSize: 16, lineHeight: 1 }}>{meta.emoji}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: meta.color, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {meta.label}
          </span>
          {data?.cached === false && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--accent)', letterSpacing: '0.1em' }}>LIVE</span>
          )}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Body */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }}>
          {isBusy ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[70, 90, 55].map((w, i) => (
                <div key={i} style={{ height: 10, borderRadius: 4, background: 'var(--surface-2)', width: `${w}%`, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  Analyse konnte gerade nicht geladen werden.
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
                  Deine Daten bleiben sichtbar. Versuche es gleich erneut oder wechsle auf einen anderen Zeitraum.
                </p>
              </div>
              <button
                onClick={() => refetch()}
                style={{
                  alignSelf: 'flex-start',
                  fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text)',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  padding: '5px 9px', border: '1px solid var(--border)', borderRadius: 4,
                  background: 'var(--surface-2)', cursor: 'pointer',
                }}
              >
                Erneut versuchen
              </button>
            </div>
          ) : data ? (
            <>
              {/* Stats chips */}
              {Object.keys(data.stats).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {Object.entries(data.stats).map(([k, v]) => v != null && (
                    <span key={k} style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 7px',
                      borderRadius: 4, background: 'var(--surface-2)', color: 'var(--text-2)',
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}>
                      {k}: {typeof v === 'number' ? v : v}
                    </span>
                  ))}
                </div>
              )}

              {/* Analysis text */}
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
                {data.analysis}
              </p>

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
                  {data.date}
                </span>
                <button
                  onClick={() => refresh.mutate()}
                  disabled={refresh.isPending}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 4,
                    background: 'transparent', cursor: 'pointer',
                  }}
                >
                  {refresh.isPending ? '…' : 'Neu'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function Insights() {
  const [days, setDays] = useState(30);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>Insights</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {DAYS_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 10px',
                borderRadius: 4, letterSpacing: '0.1em',
                background: days === d ? 'var(--surface-2)' : 'transparent',
                color: days === d ? 'var(--text)' : 'var(--text-3)',
                border: '1px solid ' + (days === d ? 'var(--border)' : 'transparent'),
                cursor: 'pointer',
              }}
            >
              {d}T
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
        KI-Analyse deiner Gesundheits- und Trainingsdaten. Öffne eine Karte, um die Analyse gezielt zu laden.
      </p>

      <MentalLoadOverlay />

      {/* Domain cards */}
      {DOMAINS.map(d => (
        <InsightCard key={d.key} domain={d.key} days={days} />
      ))}
    </div>
  );
}
