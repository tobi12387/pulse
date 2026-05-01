import type { DailyDecision } from '@/pulse/daily-decision';

type LabelCase = 'upper' | 'title';

function priorityColor(priority: DailyDecision['priority']): string {
  if (priority === 'critical') return 'var(--rose)';
  if (priority === 'high') return 'var(--amber)';
  return 'var(--accent)';
}

function label(text: string, labelCase: LabelCase): string {
  return labelCase === 'upper' ? text.toUpperCase() : text;
}

export function DailyDecisionCard({
  decision,
  labelCase = 'upper',
  onActivate,
  onPrompt,
}: {
  decision: DailyDecision;
  labelCase?: LabelCase;
  onActivate?: () => void;
  onPrompt?: () => void;
}) {
  const color = priorityColor(decision.priority);
  const isButton = Boolean(onActivate);
  const Wrapper = isButton ? 'button' : 'div';

  return (
    <div style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '.14em' }}>
          {label('Tagesentscheidung', labelCase)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color }}>
          {decision.priority === 'critical' ? 'KRITISCH' : decision.priority === 'high' ? 'WICHTIG' : 'HEUTE'}
        </span>
      </div>

      <Wrapper
        type={isButton ? 'button' : undefined}
        onClick={onActivate}
        style={{
          width: '100%',
          padding: 0,
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: isButton ? 'pointer' : 'default',
          color: 'inherit',
          font: 'inherit',
        }}
      >
        <h2 style={{ fontSize: 16, color: 'var(--text)', margin: '0 0 7px', fontWeight: 600, lineHeight: 1.3 }}>
          {decision.title}
        </h2>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: labelCase === 'upper' ? 'uppercase' : 'none', marginBottom: 4 }}>
          {label('Warum', labelCase)}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: '0 0 12px' }}>
          {decision.reason}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
          {[
            ['Grenze', decision.boundary],
            ['Alternative', decision.alternative],
            ['Abschluss', decision.completionCriterion],
          ].map(([key, value]) => (
            <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '8px 9px', background: 'var(--surface-2)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: labelCase === 'upper' ? 'uppercase' : 'none' }}>
                {label(key, labelCase)}
              </div>
              <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.4 }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </Wrapper>

      {decision.evidence.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {decision.evidence.slice(0, 4).map(item => (
            <span key={item} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-3)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '3px 6px',
            }}>
              {item}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: onPrompt ? '1fr 1fr' : '1fr', gap: 8, marginTop: 12 }}>
        {onActivate && (
          <button
            type="button"
            onClick={onActivate}
            style={{
              padding: '9px 10px',
              background: 'var(--surface-2)',
              border: `1px solid ${color}`,
              borderRadius: 5,
              color,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {decision.cta}
          </button>
        )}
        {onPrompt && (
          <button
            type="button"
            onClick={onPrompt}
            style={{
              padding: '9px 10px',
              background: 'var(--surface-2)',
              border: '1px solid var(--accent)',
              borderRadius: 5,
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Gespräch damit starten
          </button>
        )}
      </div>
    </div>
  );
}
