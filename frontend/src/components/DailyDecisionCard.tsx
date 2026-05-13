import { useState } from 'react';
import type { DailyDecision, DailyDecisionEvidence, DailyDecisionStep, DailyDecisionStepStatus } from '@/pulse/daily-decision';

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

function stepStatusLabel(status: DailyDecisionStepStatus): string {
  if (status === 'done') return 'Erledigt';
  if (status === 'open') return 'Noch offen';
  return 'Heute beachten';
}

function stepStatusColor(status: DailyDecisionStepStatus, actionColor: string): string {
  if (status === 'done') return 'var(--green)';
  if (status === 'open') return actionColor;
  return 'var(--text-3)';
}

function resultPreview(decision: DailyDecision): string {
  return decision.resultPreview ?? decision.emptyState ?? decision.completionCriterion;
}

function visibleStepSummary(decision: DailyDecision, openSteps: DailyDecisionStep[]) {
  if (openSteps[0]) {
    return {
      label: 'Nächster Schritt',
      title: openSteps[0].label,
      detail: openSteps[0].detail,
    };
  }

  if (decision.steps?.length) {
    const firstDone = decision.steps.find(step => step.status === 'done');
    return {
      label: decision.emptyState ? 'Heute fertig' : 'Aktueller Stand',
      title: decision.emptyState ? 'Alles Relevante ist erledigt' : firstDone?.label ?? decision.cta,
      detail: decision.emptyState ?? firstDone?.detail ?? decision.completionCriterion,
    };
  }

  return {
    label: 'Nächster Schritt',
    title: decision.cta,
    detail: decision.completionCriterion,
  };
}

function evidenceItems({
  evidence,
  onActivate,
}: {
  evidence: DailyDecisionEvidence[];
  onActivate?: (path: string) => void;
}) {
  if (evidence.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {evidence.slice(0, 4).map(item => {
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
  );
}

export function DailyDecisionCard({
  decision,
  labelCase = 'upper',
  density = 'default',
  framed = true,
  inlineActions = false,
  onActivate,
  onPrompt,
}: {
  decision: DailyDecision;
  labelCase?: LabelCase;
  density?: Density;
  framed?: boolean;
  inlineActions?: boolean;
  onActivate?: (path: string) => void;
  onPrompt?: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const color = priorityColor(decision.priority);
  const promptIsPrimary = Boolean(onActivate && onPrompt && decision.targetPath.startsWith('/coach'));
  const compact = density === 'compact';
  const guidanceItems = [decision.boundary, decision.alternative, decision.completionCriterion];
  const stepGroups = (['done', 'open', 'note'] as DailyDecisionStepStatus[])
    .map(status => ({
      status,
      steps: decision.steps?.filter(step => step.status === status) ?? [],
    }))
    .filter(group => group.steps.length > 0);
  const hasStructuredSteps = !compact && stepGroups.length > 0;
  const openSteps = decision.steps?.filter(step => step.status === 'open') ?? [];
  const primarySummary = visibleStepSummary(decision, openSteps);
  const primaryAction = promptIsPrimary ? onPrompt : onActivate ? () => onActivate(decision.targetPath) : undefined;
  const showPromptAction = Boolean(onPrompt && !promptIsPrimary && !(decision.supportCta && onActivate));
  const showSupportAction = Boolean(decision.supportCta && decision.supportPath && onActivate);
  const actionColumns = primaryAction && (showPromptAction || showSupportAction) && !compact ? '1fr 1fr' : '1fr';

  const renderActions = (marginTop: number) => (
    <div style={{ display: 'grid', gridTemplateColumns: actionColumns, gap: 8, marginTop }}>
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
      {showSupportAction && (
        <button
          type="button"
          onClick={() => {
            if (decision.supportPath?.startsWith('/coach') && onPrompt) {
              onPrompt();
              return;
            }
            onActivate?.(decision.supportPath!);
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
  );

  const renderStructuredSteps = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {decision.emptyState && openSteps.length === 0 && (
        <p style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45, margin: 0, overflowWrap: 'anywhere' }}>
          {decision.emptyState}
        </p>
      )}
      {stepGroups.map(group => {
        const groupColor = stepStatusColor(group.status, color);
        return (
          <section key={group.status} aria-label={stepStatusLabel(group.status)} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: groupColor, letterSpacing: '.08em' }}>
              {stepStatusLabel(group.status)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {group.steps.map(step => {
                const canActivateStep = Boolean(step.status === 'open' && step.targetPath && onActivate);
                const rowStyle = {
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: canActivateStep ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
                  gap: 8,
                  alignItems: 'center',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  padding: '8px 9px',
                  background: step.status === 'open' ? 'var(--surface)' : 'transparent',
                  textAlign: 'left' as const,
                };
                const content = (
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                      {step.label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                      {step.detail}
                    </span>
                  </span>
                );

                if (canActivateStep) {
                  return (
                    <button
                      key={`${group.status}-${step.label}`}
                      type="button"
                      onClick={() => onActivate?.(step.targetPath!)}
                      style={{
                        ...rowStyle,
                        minHeight: 44,
                        cursor: 'pointer',
                        color: 'inherit',
                      }}
                    >
                      {content}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: groupColor, whiteSpace: 'nowrap' }}>
                        {step.cta ?? 'Öffnen'}
                      </span>
                    </button>
                  );
                }

                return (
                  <div key={`${group.status}-${step.label}`} style={rowStyle}>
                    {content}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );

  const renderGuidance = () => (
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
  );

  return (
    <div
      data-testid="daily-decision-card"
      style={{
        padding: framed ? (compact ? '10px 12px' : '14px 16px') : 0,
        background: framed ? 'var(--surface)' : 'transparent',
        border: framed ? '1px solid var(--border)' : 'none',
        borderRadius: framed ? 6 : 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: compact ? 7 : 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '.14em' }}>
          {label('Tagesentscheidung', labelCase)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color }}>
          {decision.priority === 'critical' ? 'KRITISCH' : decision.priority === 'high' ? 'WICHTIG' : 'HEUTE'}
        </span>
      </div>

      <h2 style={{ fontSize: compact ? 14 : 16, color: 'var(--text)', margin: '0 0 7px', fontWeight: 600, lineHeight: 1.3 }}>
        {decision.title}
      </h2>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: labelCase === 'upper' ? 'uppercase' : 'none', marginBottom: 4 }}>
        {label(compact ? 'Warum' : 'Warum jetzt', labelCase)}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: compact ? '0' : '0 0 12px' }}>
        {decision.reason}
      </p>

      {!compact && (
        <div data-testid="daily-decision-next-steps" style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '10px 11px', background: 'var(--surface-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 9 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color, letterSpacing: '.1em', textTransform: labelCase === 'upper' ? 'uppercase' : 'none', marginBottom: 5 }}>
                {label(primarySummary.label, labelCase)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                {primarySummary.title}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45, marginTop: 3, overflowWrap: 'anywhere' }}>
                {primarySummary.detail}
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 9 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: labelCase === 'upper' ? 'uppercase' : 'none', marginBottom: 5 }}>
                {label('Nach dem Klick', labelCase)}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                {resultPreview(decision)}
              </div>
            </div>
          </div>

          {inlineActions && renderActions(10)}

          <button
            type="button"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen(open => !open)}
            style={{
              width: '100%',
              minHeight: 44,
              marginTop: 10,
              padding: '8px 9px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: detailsOpen ? 'var(--accent)' : 'var(--text-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: 0,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Details & Evidenz {detailsOpen ? 'ausblenden' : 'anzeigen'}
          </button>

          {detailsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: labelCase === 'upper' ? 'uppercase' : 'none', marginBottom: 7 }}>
                  {label(hasStructuredSteps ? 'Was jetzt?' : 'Grenzen & Alternativen', labelCase)}
                </div>
                {hasStructuredSteps ? renderStructuredSteps() : renderGuidance()}
              </div>
              {decision.evidence.length > 0 && (
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: labelCase === 'upper' ? 'uppercase' : 'none', marginBottom: 7 }}>
                    {label('Evidenz', labelCase)}
                  </div>
                  {evidenceItems({ evidence: decision.evidence, onActivate })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!inlineActions && renderActions(compact ? 10 : 12)}
    </div>
  );
}
