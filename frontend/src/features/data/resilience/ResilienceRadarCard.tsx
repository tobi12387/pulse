import { useNavigate } from 'react-router-dom';
import type { PulseResilienceRadarResponse } from '@coaching-os/shared/pulse';

function stateColor(state: PulseResilienceRadarResponse['state']): string {
  if (state === 'protect') return 'var(--rose)';
  if (state === 'watch' || state === 'rebuild') return 'var(--amber)';
  if (state === 'steady') return 'var(--green)';
  return 'var(--accent)';
}

function confidenceLabel(confidence: PulseResilienceRadarResponse['evidenceQuality']['confidence']): string {
  if (confidence === 'usable') return 'Evidenz nutzbar';
  if (confidence === 'learning') return 'Evidenz lernt';
  return 'Evidenz knapp';
}

export function ResilienceRadarCard({
  radar,
  isLoading = false,
  isError = false,
}: {
  radar?: PulseResilienceRadarResponse;
  isLoading?: boolean;
  isError?: boolean;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <section className="card" data-testid="resilience-radar-card" aria-label="Resilienz-Radar">
        <div className="label-mono">Resilienz-Radar</div>
        <p style={{ margin: '8px 0 0', color: 'var(--text-2)', fontSize: 12 }}>
          Muster werden geladen.
        </p>
      </section>
    );
  }

  if (isError || !radar) {
    return (
      <section className="card" data-testid="resilience-radar-card" aria-label="Resilienz-Radar">
        <div className="label-mono" style={{ color: 'var(--amber)' }}>Resilienz-Radar</div>
        <p style={{ margin: '8px 0 0', color: 'var(--text-2)', fontSize: 12 }}>
          Der Mehrtages-Blick ist gerade nicht verfügbar. Der Check-in bleibt nutzbar.
        </p>
      </section>
    );
  }

  const tone = stateColor(radar.state);
  const visibleSignals = radar.signals.slice(0, 3);

  return (
    <section
      className="card"
      data-testid="resilience-radar-card"
      aria-label="Resilienz-Radar"
      style={{ borderColor: `color-mix(in srgb, ${tone} 24%, var(--border))` }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(176px, auto)', gap: 14, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div className="label-mono" style={{ color: tone, marginBottom: 6 }}>
            Resilienz-Radar
          </div>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 16, fontWeight: 650, lineHeight: 1.25 }}>
            {radar.title}
          </h3>
          <p style={{ margin: '6px 0 0', color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.5, maxWidth: 720 }}>
            {radar.summary}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <button
            type="button"
            onClick={() => navigate(radar.primaryAction.targetPath)}
            style={{
              minWidth: 44,
              minHeight: 42,
              border: `1px solid ${tone}`,
              borderRadius: 'var(--radius)',
              background: `color-mix(in srgb, ${tone} 10%, transparent)`,
              color: tone,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0,
              padding: '9px 12px',
              textTransform: 'uppercase',
            }}
          >
            {radar.primaryAction.label}
          </button>
          <span style={{ color: 'var(--text-3)', fontSize: 10.5, lineHeight: 1.45 }}>
            {radar.primaryAction.resultPreview}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
        <span style={{ border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px' }}>
          {confidenceLabel(radar.evidenceQuality.confidence)}
        </span>
        <span style={{ border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px' }}>
          {radar.evidenceQuality.checkins} Check-ins
        </span>
        <span style={{ border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px' }}>
          {radar.evidenceQuality.garminDays} Garmin-Tage
        </span>
      </div>

      {visibleSignals.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 12 }}>
          {visibleSignals.map(signal => (
            <div
              key={signal.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 5,
                background: 'var(--surface-2)',
                padding: '9px 10px',
                minWidth: 0,
              }}
            >
              <div className="label-mono" style={{ color: signal.id === 'support_plan' ? tone : 'var(--text-3)', fontSize: 9, marginBottom: 5 }}>
                {signal.label}
              </div>
              <p style={{ margin: 0, color: 'var(--text)', fontSize: 12.5, fontWeight: 600, lineHeight: 1.35 }}>
                {signal.summary}
              </p>
              {signal.evidence.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                  {signal.evidence.slice(0, 2).map(item => (
                    <span
                      key={item}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        color: 'var(--text-3)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        padding: '3px 6px',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
