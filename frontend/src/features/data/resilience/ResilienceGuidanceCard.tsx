import { useNavigate } from 'react-router-dom';
import { buildResilienceGuidance, type ResilienceCheckinInput, type ResilienceGuidance, type ResilienceHomeInput } from './resilience-guidance-model';

function toneColor(tone: ResilienceGuidance['tone']): string {
  if (tone === 'green') return 'var(--green)';
  if (tone === 'amber') return 'var(--amber)';
  if (tone === 'rose') return 'var(--rose)';
  return 'var(--accent)';
}

export function ResilienceGuidanceCard({
  home,
  checkin,
}: {
  home: ResilienceHomeInput;
  checkin: ResilienceCheckinInput;
}) {
  const navigate = useNavigate();
  const guidance = buildResilienceGuidance({ home, checkin });
  const tone = toneColor(guidance.tone);

  function handlePrimaryAction() {
    if (guidance.primaryAction.kind === 'check_in') {
      const target = document.getElementById('mental-checkin-form');
      target?.scrollIntoView({ block: 'start' });
      target?.focus({ preventScroll: true });
      return;
    }
    if (guidance.primaryAction.targetPath) {
      navigate(guidance.primaryAction.targetPath);
    }
  }

  return (
    <section
      className="card"
      data-testid="resilience-guidance-card"
      aria-label="Resilienz heute"
      style={{
        borderColor: `color-mix(in srgb, ${tone} 24%, var(--border))`,
        background: guidance.state === 'protect' ? 'rgba(244,113,116,0.035)' : 'var(--surface)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(178px, auto)', gap: 14, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div className="label-mono" style={{ color: tone, marginBottom: 6 }}>
            Resilienz heute
          </div>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 16, fontWeight: 650, lineHeight: 1.25 }}>
            {guidance.title}
          </h3>
          <p style={{ margin: '6px 0 0', color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.5, maxWidth: 720 }}>
            {guidance.summary}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <button
            type="button"
            onClick={handlePrimaryAction}
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
            {guidance.primaryAction.label}
          </button>
          <span style={{ color: 'var(--text-3)', fontSize: 10.5, lineHeight: 1.45 }}>
            {guidance.primaryAction.resultPreview}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginTop: 13 }}>
        {guidance.lanes.map(lane => (
          <div
            key={lane.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 5,
              background: 'var(--surface-2)',
              padding: '9px 10px',
              minWidth: 0,
            }}
          >
            <div className="label-mono" style={{ color: lane.id === 'boundary' ? tone : 'var(--text-3)', fontSize: 9, marginBottom: 5 }}>
              {lane.label}
            </div>
            <div style={{ color: 'var(--text)', fontSize: 12.5, fontWeight: 600, lineHeight: 1.35 }}>
              {lane.title}
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--text-2)', fontSize: 11.5, lineHeight: 1.45 }}>
              {lane.body}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
        {guidance.evidence.map(item => (
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
    </section>
  );
}
