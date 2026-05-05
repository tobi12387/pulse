import type { DailyDecision, DailyDecisionEvidence } from '@/pulse/daily-decision';

type LabelCase = 'upper' | 'title';
type Density = 'default' | 'compact';

function priorityColor(priority: DailyDecision['priority']): string {
  if (priority === 'critical') return 'var(--rose)';
  if (priority === 'high') return 'var(--amber)';
  return 'var(--accent)';
}

function label(text: string, labelCase: LabelCase): string {
  return labelCase === 'upper' ? text.toUpperCase() : text;
}

function evidenceLabel(item: DailyDecisionEvidence): string {
  return typeof item === 'string' ? item : item.label;
}

function evidenceTarget(item: DailyDecisionEvidence): string | null {
  return typeof item === 'string' ? null : item.targetPath;
}

export function DailyDecisionCard({
  decision,
  labelCase = 'upper',
  density = 'default',
  onActivate,
  onPrompt,
}: {
  decision: DailyDecision;
  labelCase?: LabelCase;
  density?: Density;
  onActivate?: (path: string) => void;
  onPrompt?: () => void;
}) {
  const color = priorityColor(decision.priority);
  const promptIsPrimary = Boolean(onActivate && onPrompt && decision.targetPath.startsWith('/coach'));
  const primaryAction = promptIsPrimary ? onPrompt : onActivate ? () => onActivate(decision.targetPath) : undefined;
  const showPromptAction = Boolean(onPrompt && !promptIsPrimary && !(decision.supportCta && onActivate));
  const compact = density === 'compact';
  const guidanceItems = [decision.boundary, decision.alternative, decision.completionCriterion];

  return (
    <div data-testid="daily-decision-card" style={{ padding: compact ? '10px 12px' : '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: compact ? 7 : 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '.14em' }}>
          {label('Tagesentscheidung', labelCase)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color }}>
          {decision.priority === 'critical' ? 'KRITISCH' : decision.priority === 'high' ? 'WICHTIG' : 'HEUTE'}
        </span>
      </div>

      <div>
        <h2 style={{ fontSize: compact ? 14 : 16, color: 'var(--text)', margin: '0 0 7px', fontWeight: 600, lineHeight: 1.3 }}>
          {decision.title}
        </h2>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: labelCase === 'upper' ? 'uppercase' : 'none', marginBottom: 4 }}>
          {label('Warum', labelCase)}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: compact ? '0' : '0 0 12px' }}>
          {decision.reason}
        </p>
        {!compact && (
          <div data-testid="daily-decision-next-steps" style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '10px 11px', background: 'var(--surface-2)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: labelCase === 'upper' ? 'uppercase' : 'none', marginBottom: 7 }}>
              {label('Was jetzt?', labelCase)}
            </div>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none', padding: 0, margin: 0 }}>
              {guidanceItems.map((value, index) => (
                <li key={`${index}-${value}`} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: 7, alignItems: 'start' }}>
                  <span aria-hidden="true" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color, lineHeight: 1.45 }}>
                    {index + 1}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                    {value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!compact && decision.evidence.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {decision.evidence.slice(0, 4).map(item => {
            const target = evidenceTarget(item);
            const text = evidenceLabel(item);
            const key = target ? `${target}:${text}` : text;
            const baseStyle = {
              maxWidth: '100%',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: target ? 'var(--text-2)' : 'var(--text-3)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: target ? '8px 9px' : '3px 6px',
              overflowWrap: 'anywhere' as const,
            };
            if (target && onActivate) {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onActivate(target)}
                  style={{
                    ...baseStyle,
                    minWidth: 44,
                    minHeight: 44,
                    background: 'var(--surface-2)',
                    cursor: 'pointer',
                    letterSpacing: 0,
                  }}
                >
                  {text}
                </button>
              );
            }
            return (
              <span key={key} style={baseStyle}>
                {text}
              </span>
            );
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: (primaryAction && (showPromptAction || decision.supportCta) && !compact) ? '1fr 1fr' : '1fr', gap: 8, marginTop: compact ? 10 : 12 }}>
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction}
            style={{
              minHeight: 44,
              padding: compact ? '8px 10px' : '9px 10px',
              background: 'var(--surface-2)',
              border: `1px solid ${color}`,
              borderRadius: 5,
              color,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: 0,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {decision.cta}
          </button>
        )}
        {showPromptAction && (
          <button
            type="button"
            onClick={onPrompt}
            style={{
              minHeight: 44,
              padding: compact ? '8px 10px' : '9px 10px',
              background: 'var(--surface-2)',
              border: '1px solid var(--accent)',
              borderRadius: 5,
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: 0,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Gespräch damit starten
          </button>
        )}
        {decision.supportCta && decision.supportPath && onActivate && (
          <button
            type="button"
            onClick={() => {
              if (decision.supportPath?.startsWith('/coach') && onPrompt) {
                onPrompt();
                return;
              }
              onActivate(decision.supportPath!);
            }}
            style={{
              minHeight: 44,
              padding: compact ? '8px 10px' : '9px 10px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--text-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: 0,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {decision.supportCta}
          </button>
        )}
      </div>
    </div>
  );
}
