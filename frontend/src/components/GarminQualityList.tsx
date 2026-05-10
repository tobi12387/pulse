import type {
  PulseGarminCoverageDomainState,
  PulseGarminCoverageRepairAction,
  PulseGarminCoverageStatus,
} from '@coaching-os/shared/pulse';

const STATUS_UI: Record<PulseGarminCoverageStatus, { label: string; color: string }> = {
  fresh: { label: 'FRISCH', color: 'var(--green)' },
  partial: { label: 'TEIL', color: 'var(--amber)' },
  missing: { label: 'FEHLT', color: 'var(--rose)' },
  stale: { label: 'ALT', color: 'var(--amber)' },
  blocked: { label: 'BLOCKIERT', color: 'var(--rose)' },
};

export function GarminQualityPill({ status }: { status: PulseGarminCoverageStatus }) {
  const item = STATUS_UI[status];
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      color: item.color,
      border: `1px solid ${item.color}`,
      borderRadius: 4,
      padding: '2px 6px',
      whiteSpace: 'nowrap',
    }}>
      {item.label}
    </span>
  );
}

function repairButtonLabel(action: PulseGarminCoverageRepairAction): string {
  if (action.type === 'calendar_sync') return 'Sync';
  if (action.type === 'plan') return 'Plan';
  return 'Öffnen';
}

export function GarminQualityList({
  domains,
  limit,
  showActions = false,
  onRepairAction,
}: {
  domains: PulseGarminCoverageDomainState[];
  limit?: number;
  showActions?: boolean;
  onRepairAction?: (action: PulseGarminCoverageRepairAction) => void;
}) {
  const rows = limit ? domains.slice(0, limit) : domains;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(domain => (
        <div
          key={domain.domain}
          data-testid={`garmin-quality-${domain.domain}`}
          style={{
            display: 'grid',
            gridTemplateColumns: showActions ? 'minmax(96px, 1fr) auto auto' : 'minmax(96px, 1fr) auto',
            alignItems: 'start',
            gap: 8,
            borderTop: '1px solid var(--border)',
            paddingTop: 8,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{domain.label}</span>
              {domain.lastFreshDate && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--text-3)' }}>
                  {domain.lastFreshDate}
                </span>
              )}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
              {domain.reason}
              {domain.repairableDays > 0 ? ` · ${domain.repairableDays} reparierbar` : ''}
            </div>
          </div>
          <GarminQualityPill status={domain.status} />
          {showActions && (
            domain.repairAction ? (
              <button
                type="button"
                aria-label={domain.repairAction.label}
                onClick={() => onRepairAction?.(domain.repairAction!)}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  padding: '3px 7px',
                  textTransform: 'uppercase',
                }}
              >
                {repairButtonLabel(domain.repairAction)}
              </button>
            ) : (
              <span style={{ width: 48 }} />
            )
          )}
        </div>
      ))}
    </div>
  );
}
