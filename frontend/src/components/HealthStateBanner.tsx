import { useHealthStates, useResolveHealthState } from '@/pulse/hooks';
import type { HealthState } from '@/pulse/api-client';

const TYPE_LABEL: Record<HealthState['type'], string> = {
  illness: 'Krank',
  injury:  'Verletzt',
  fatigue: 'Erschöpft',
  travel:  'Reise',
};

const SEVERITY_COLOR: Record<HealthState['severity'], string> = {
  mild:     'var(--amber)',
  moderate: 'var(--orange, #f97316)',
  severe:   'var(--rose)',
};

function formatDateRange(s: HealthState): string {
  const today = new Date().toISOString().split('T')[0]!;
  if (!s.endDate) return 'läuft';
  if (s.endDate < today) return 'abgelaufen';
  const days = Math.ceil((new Date(s.endDate).getTime() - new Date(today).getTime()) / 86_400_000) + 1;
  return `noch ${days} Tag${days === 1 ? '' : 'e'}`;
}

export function HealthStateBanner() {
  const { data } = useHealthStates();
  const resolve  = useResolveHealthState();
  const active = data?.active ?? [];
  if (active.length === 0) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '8px 12px', background: 'var(--surface)',
      border: '1px solid var(--border)', borderLeft: '3px solid var(--rose)',
      borderRadius: 'var(--radius)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
          color: 'var(--rose)', textTransform: 'uppercase',
        }}>Aktiver Gesundheits-Status</span>
      </div>
      {active.map(s => (
        <div key={s.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, fontSize: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              padding: '2px 6px', borderRadius: 3,
              background: 'rgba(239,68,68,0.1)',
              color: SEVERITY_COLOR[s.severity],
              fontFamily: 'var(--font-mono)', fontSize: 10,
              textTransform: 'uppercase', letterSpacing: '.05em',
            }}>
              {TYPE_LABEL[s.type]}/{s.severity}
            </span>
            {s.bodyPart && (
              <span style={{ color: 'var(--text-2)', fontSize: 11 }}>· {s.bodyPart}</span>
            )}
            <span style={{ color: 'var(--text-3)', fontSize: 11 }}>· {formatDateRange(s)}</span>
            {s.notes && (
              <span style={{ color: 'var(--text-3)', fontSize: 11, fontStyle: 'italic' }}>
                — {s.notes.slice(0, 60)}
              </span>
            )}
          </div>
          <button
            onClick={() => resolve.mutate(s.id)}
            disabled={resolve.isPending}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.05em',
              padding: '4px 8px', background: 'transparent',
              color: 'var(--text-2)', border: '1px solid var(--border)',
              borderRadius: 3, cursor: 'pointer',
            }}
          >
            ERLEDIGT
          </button>
        </div>
      ))}
    </div>
  );
}
