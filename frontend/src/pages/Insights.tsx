import { useState } from 'react';
import { Activity, Brain, ChevronDown, ChevronUp, Dumbbell, HeartPulse, Moon, Scale } from 'lucide-react';
import { useDeepInsight, useRefreshInsight } from '@/pulse/hooks';
import { MentalLoadOverlay } from '@/components/MentalLoadOverlay';
import { IconBadge, PageHeader, RangeControl } from '@/components/PulseChrome';
import type { LucideIcon } from 'lucide-react';

type Domain = 'overall' | 'sleep' | 'hrv' | 'load' | 'weight' | 'mental';

const DOMAINS: { key: Domain; label: string; icon: LucideIcon; color: string }[] = [
  { key: 'overall',  label: 'Gesamt',    icon: Activity,   color: 'var(--accent)' },
  { key: 'sleep',    label: 'Schlaf',    icon: Moon,       color: 'var(--blue)'   },
  { key: 'hrv',      label: 'HRV',       icon: HeartPulse, color: 'var(--green)'  },
  { key: 'load',     label: 'Belastung', icon: Dumbbell,   color: 'var(--amber)'  },
  { key: 'weight',   label: 'Gewicht',   icon: Scale,      color: 'var(--text-2)' },
  { key: 'mental',   label: 'Mental',    icon: Brain,      color: 'var(--rose)'   },
];

const DAYS_OPTIONS = [7, 30, 90];
const RANGE_OPTIONS = DAYS_OPTIONS.map(d => ({ value: d, label: `${d}T` }));

function InsightCard({ domain, days }: { domain: Domain; days: number }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, isFetching, error, refetch } = useDeepInsight(domain, days, expanded);
  const refresh = useRefreshInsight(domain, days);
  const meta = DOMAINS.find(d => d.key === domain)!;
  const isBusy = isLoading || isFetching || refresh.isPending;
  const contentId = `insight-${domain}-content`;

  return (
    <div
      className="card"
      style={{ padding: 0, overflow: 'hidden', borderColor: expanded ? `color-mix(in srgb, ${meta.color} 28%, transparent)` : 'var(--border)' }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="w-full flex items-center justify-between gap-3"
        style={{ padding: '12px 14px', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-2.5">
          <IconBadge icon={meta.icon} color={meta.color} label={meta.label} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: meta.color, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {meta.label}
          </span>
          {data?.cached === false && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--accent)', letterSpacing: '0.1em' }}>LIVE</span>
          )}
        </div>
        <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      {/* Body */}
      {expanded && (
        <div id={contentId} style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }}>
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
      <PageHeader
        eyebrow="INSIGHTS"
        title="Insights"
        description="Öffne eine Karte, um die Analyse gezielt zu laden."
        action={<RangeControl value={days} onChange={setDays} options={RANGE_OPTIONS} />}
      />

      <MentalLoadOverlay />

      {/* Domain cards */}
      {DOMAINS.map(d => (
        <InsightCard key={d.key} domain={d.key} days={days} />
      ))}
    </div>
  );
}
