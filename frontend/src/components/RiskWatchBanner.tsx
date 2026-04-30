import { useState } from 'react';
import { useResolveRiskSignal, useRiskSignals, useSnoozeRiskSignal } from '@/pulse/hooks';
import type { PulseRiskSignal } from '@coaching-os/shared/pulse';

function severityColor(severity: PulseRiskSignal['severity']): string {
  if (severity === 'critical') return 'var(--rose)';
  if (severity === 'warn') return 'var(--amber)';
  return 'var(--text-3)';
}

function severityLabel(severity: PulseRiskSignal['severity']): string {
  if (severity === 'critical') return 'critical';
  if (severity === 'warn') return 'warn';
  return 'info';
}

export function RiskWatchBanner() {
  const { data, isLoading } = useRiskSignals();
  const snooze = useSnoozeRiskSignal();
  const resolve = useResolveRiskSignal();
  const visible = (data?.signals ?? []).filter(s => s.severity === 'warn' || s.severity === 'critical');
  const [expanded, setExpanded] = useState(false);

  if (isLoading || visible.length === 0) return null;

  const canCollapse = visible.length >= 3;
  const shown = !canCollapse || expanded ? visible : visible.slice(0, 2);
  const highest = visible.some(s => s.severity === 'critical') ? 'critical' : 'warn';

  return (
    <div style={{
      border: `1px solid ${severityColor(highest)}`,
      background: highest === 'critical' ? 'rgba(244, 63, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 12px',
          background: 'transparent',
          border: 'none',
          cursor: canCollapse ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: severityColor(highest) }}>
          Risiko-Signale ({visible.length})
        </span>
        {canCollapse && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{expanded ? '–' : '+'}</span>
        )}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {shown.map(signal => (
          <div key={signal.id} style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{signal.title}</div>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: severityColor(signal.severity),
                letterSpacing: '.08em',
                textTransform: 'uppercase',
              }}>
                {severityLabel(signal.severity)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 4 }}>
              {signal.description}
            </div>
            <div style={{ fontSize: 11, color: severityColor(signal.severity), lineHeight: 1.5, marginTop: 4 }}>
              → {signal.recommendation}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              {signal.severity === 'info' && (
                <button onClick={() => resolve.mutate(signal.id)} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em',
                  color: 'var(--text-3)', background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 3, padding: '4px 8px', cursor: 'pointer', textTransform: 'uppercase',
                }}>
                  Ok
                </button>
              )}
              <button onClick={() => snooze.mutate({ id: signal.id, hours: 24 })} style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em',
                color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 3, padding: '4px 8px', cursor: 'pointer', textTransform: 'uppercase',
              }}>
                Snooze 24h
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
