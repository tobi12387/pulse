import type { PlanWeeklyDecisionContract, PlanWeeklyDecisionTone } from './weekly-decision-contract';

type Props = {
  contract: PlanWeeklyDecisionContract;
  variant?: 'card' | 'embedded';
};

function toneColor(tone: PlanWeeklyDecisionTone): string {
  if (tone === 'attention') return 'var(--amber)';
  if (tone === 'watch') return 'var(--accent)';
  return 'var(--green)';
}

export function PlanWeeklyDecisionContractPanel({ contract, variant = 'embedded' }: Props) {
  const tone = toneColor(contract.tone);
  const Wrapper = variant === 'card' ? 'section' : 'div';

  return (
    <Wrapper
      id="plan-weekly-decision"
      className={variant === 'card' ? 'card' : undefined}
      data-testid="plan-weekly-decision-contract"
      tabIndex={-1}
      style={{
        borderColor: variant === 'card' ? `color-mix(in srgb, ${tone} 26%, var(--border))` : undefined,
        background: variant === 'card' && contract.tone === 'attention' ? 'rgba(251,191,36,0.045)' : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <span className="label-mono" style={{ color: tone }}>Wochenentscheidung</span>
        <span style={{ color: tone, fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase' }}>
          {contract.primaryOption === 'adapt_week' ? 'Vorschau zuerst' : 'Ausfuehren'}
        </span>
      </div>
      <h2 style={{ margin: '0 0 6px', color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>
        {contract.title}
      </h2>
      <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 12, lineHeight: 1.5 }}>
        {contract.summary}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 12 }}>
        {contract.sections.map(section => (
          <div
            key={section.id}
            data-testid={`plan-weekly-decision-section-${section.id}`}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 5,
              background: 'var(--surface-2)',
              padding: '9px 10px',
              minWidth: 0,
            }}
          >
            <div className="label-mono" style={{ color: 'var(--text-3)', fontSize: 8.5, marginBottom: 5 }}>
              {section.label}
            </div>
            <div style={{ color: 'var(--text)', fontSize: 12, fontWeight: 600, lineHeight: 1.35, marginBottom: 4 }}>
              {section.title}
            </div>
            <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 11.2, lineHeight: 1.45 }}>
              {section.body}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginTop: 10 }}>
        {contract.options.map(option => {
          const active = option.kind === contract.primaryOption;
          return (
            <div
              key={option.kind}
              data-testid={`plan-weekly-decision-option-${option.kind}`}
              style={{
                border: `1px solid ${active ? tone : 'var(--border)'}`,
                borderRadius: 5,
                background: active ? `color-mix(in srgb, ${tone} 7%, transparent)` : 'transparent',
                padding: '9px 10px',
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', marginBottom: 5 }}>
                <span className="label-mono" style={{ color: active ? tone : 'var(--text-3)', fontSize: 8.5 }}>
                  {option.label}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--text-3)' }}>
                  Preview-only
                </span>
              </div>
              <div style={{ color: 'var(--text)', fontSize: 12, fontWeight: 600, lineHeight: 1.35, marginBottom: 4 }}>
                {option.title}
              </div>
              <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 11.2, lineHeight: 1.45 }}>
                {option.weekImpact}
              </p>
              <p style={{ margin: '5px 0 0', color: 'var(--text-3)', fontSize: 10.8, lineHeight: 1.45 }}>
                Nach dem Klick: {option.resultPreview}
              </p>
            </div>
          );
        })}
      </div>
    </Wrapper>
  );
}
