import { AlertTriangle } from 'lucide-react';
import { useTodayProposal, useAcceptTodayAdjustment } from '@/pulse/hooks';
import type { AdjustProposal } from '@/pulse/api-client';

const REASON_LABEL: Record<AdjustProposal['reason'], string> = {
  low_readiness: 'Tagesform niedrig',
  illness:       'Krankheit',
  injury:        'Verletzung',
  fatigue:       'Erschöpfung',
  travel:        'Reise',
};

const SPORT_LABEL: Record<string, string> = {
  bike:     'Bike',
  run:      'Run',
  swim:     'Swim',
  strength: 'Strength',
  hike:     'Hike',
};

function workoutLine(w: { activityType: string; zone: number; durationMin: number }): string {
  if (w.durationMin === 0) return 'Ruhetag';
  return `${SPORT_LABEL[w.activityType] ?? w.activityType} · Z${w.zone} · ${w.durationMin}min`;
}

export function AdjustTodayCard() {
  const { data, isLoading } = useTodayProposal();
  const accept = useAcceptTodayAdjustment();

  if (isLoading || !data?.proposal) return null;
  const p = data.proposal;

  return (
    <div className="card" style={{
      padding: 0, overflow: 'hidden',
      borderColor: 'rgba(245,158,11,0.4)',
      boxShadow: '0 0 0 1px rgba(245,158,11,0.15)',
    }}>
      <div style={{
        padding: '8px 12px', background: 'rgba(245,158,11,0.08)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
          color: 'var(--amber)', textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <AlertTriangle size={13} strokeWidth={1.8} aria-hidden="true" />
          Heute anpassen?
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)',
        }}>
          Readiness {p.readinessScore}/100
        </span>
      </div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Geplant
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', textDecoration: 'line-through', textDecorationColor: 'var(--text-3)' }}>
              {workoutLine(p.original)}
            </div>
          </div>
          <span style={{ color: 'var(--text-3)', fontSize: 16 }}>→</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Vorschlag
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
              {workoutLine(p.proposed)}
            </div>
          </div>
        </div>

        <div style={{
          fontSize: 11, color: 'var(--text-3)',
          padding: '6px 8px', background: 'var(--surface-2)',
          borderRadius: 'var(--radius)',
        }}>
          <span style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.05em' }}>
            {REASON_LABEL[p.reason]}
          </span>
          {p.rationale && <span> · {p.rationale}</span>}
        </div>

        {p.proposed.description && (
          <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
            {p.proposed.description}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => accept.mutate(p.workoutId)}
            disabled={accept.isPending}
            style={{
              flex: 1, padding: '8px 12px',
              background: 'var(--amber)', color: '#0a0a0a',
              border: 'none', borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: accept.isPending ? 'wait' : 'pointer',
              opacity: accept.isPending ? 0.5 : 1,
            }}
          >
            {accept.isPending ? '…' : 'Anpassen'}
          </button>
          <button
            disabled={accept.isPending}
            onClick={() => {
              // Just dismiss visually — refresh on next refetchInterval
              const el = document.querySelector('[data-adjust-card]') as HTMLElement | null;
              if (el) el.style.display = 'none';
            }}
            data-adjust-card
            style={{
              flex: 1, padding: '8px 12px',
              background: 'transparent', color: 'var(--text-2)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-mono)', fontSize: 10,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Beibehalten
          </button>
        </div>
      </div>
    </div>
  );
}
