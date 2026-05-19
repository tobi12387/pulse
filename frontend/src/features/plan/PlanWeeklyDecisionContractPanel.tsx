import { useEffect, useMemo, useState } from 'react';
import {
  buildPlanWeeklyDecisionReceipt,
  planWeeklyDecisionContractSignature,
  type PlanWeeklyDecisionContract,
  type PlanWeeklyDecisionReceipt,
  type PlanWeeklyDecisionTone,
} from './weekly-decision-contract';

type Props = {
  contract: PlanWeeklyDecisionContract;
  variant?: 'card' | 'embedded';
};

function toneColor(tone: PlanWeeklyDecisionTone): string {
  if (tone === 'attention') return 'var(--amber)';
  if (tone === 'watch') return 'var(--accent)';
  return 'var(--green)';
}

function hashFromTargetPath(targetPath: string | null): string | null {
  if (!targetPath) return null;
  const hashIndex = targetPath.indexOf('#');
  const hash = hashIndex >= 0 ? targetPath.slice(hashIndex + 1) : targetPath.replace(/^#/, '');
  return hash.length > 0 ? hash : null;
}

const WEEKLY_DECISION_RECEIPT_STORAGE_KEY = 'pulse.plan.weeklyDecisionReceipt.v1';

function isReceipt(value: unknown): value is PlanWeeklyDecisionReceipt {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PlanWeeklyDecisionReceipt>;
  return typeof candidate.contractSignature === 'string'
    && typeof candidate.optionKind === 'string'
    && typeof candidate.optionLabel === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.decision === 'string'
    && typeof candidate.weekImpact === 'string'
    && typeof candidate.nextConsequence === 'string'
    && typeof candidate.mutationBoundary === 'string'
    && typeof candidate.createdAt === 'string';
}

function readStoredReceipt(contractSignature: string): PlanWeeklyDecisionReceipt | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WEEKLY_DECISION_RECEIPT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isReceipt(parsed)) return null;
    return parsed.contractSignature === contractSignature ? parsed : null;
  } catch {
    return null;
  }
}

function storeReceipt(receipt: PlanWeeklyDecisionReceipt) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WEEKLY_DECISION_RECEIPT_STORAGE_KEY, JSON.stringify(receipt));
  } catch {
    // Keep the in-memory receipt visible even if the browser blocks persistence.
  }
}

export function PlanWeeklyDecisionContractPanel({ contract, variant = 'embedded' }: Props) {
  const tone = toneColor(contract.tone);
  const Wrapper = variant === 'card' ? 'section' : 'div';
  const contractSignature = useMemo(() => planWeeklyDecisionContractSignature(contract), [contract]);
  const [selectedKind, setSelectedKind] = useState(contract.primaryOption);
  const [receipt, setReceipt] = useState<PlanWeeklyDecisionReceipt | null>(() => readStoredReceipt(contractSignature));
  const selectedOption = useMemo(
    () => contract.options.find(option => option.kind === selectedKind)
      ?? contract.options.find(option => option.kind === contract.primaryOption)
      ?? contract.options[0],
    [contract.options, contract.primaryOption, selectedKind],
  );

  useEffect(() => {
    const storedReceipt = readStoredReceipt(contractSignature);
    setReceipt(storedReceipt);
    setSelectedKind(storedReceipt?.optionKind ?? contract.primaryOption);
  }, [contract.primaryOption, contractSignature]);

  function activateTargetPath(targetPath: string | null) {
    const hash = hashFromTargetPath(targetPath);
    if (!hash) return;

    window.location.hash = hash;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(hash);
      target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      target?.focus({ preventScroll: true });
    });
  }

  function chooseOption(option: PlanWeeklyDecisionContract['options'][number]) {
    setSelectedKind(option.kind);
    activateTargetPath(option.targetPath);
  }

  function rememberDecision() {
    if (!selectedOption) return;
    const nextReceipt = buildPlanWeeklyDecisionReceipt(contract, selectedOption.kind, new Date().toISOString());
    setReceipt(nextReceipt);
    storeReceipt(nextReceipt);
  }

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
          const active = option.kind === selectedKind;
          return (
            <button
              type="button"
              key={option.kind}
              data-testid={`plan-weekly-decision-option-${option.kind}`}
              aria-pressed={active}
              onClick={() => chooseOption(option)}
              style={{
                border: `1px solid ${active ? tone : 'var(--border)'}`,
                borderRadius: 5,
                background: active ? `color-mix(in srgb, ${tone} 7%, transparent)` : 'transparent',
                padding: '9px 10px',
                minWidth: 0,
                color: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
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
            </button>
          );
        })}
      </div>

      {selectedOption && (
        <div
          data-testid="plan-weekly-decision-active-preview"
          style={{
            marginTop: 10,
            border: `1px solid color-mix(in srgb, ${tone} 22%, var(--border))`,
            borderRadius: 5,
            background: 'var(--surface-2)',
            padding: '9px 10px',
          }}
        >
          <div className="label-mono" style={{ color: tone, fontSize: 8.5, marginBottom: 5 }}>
            Aktive Vorschau
          </div>
          <div style={{ color: 'var(--text)', fontSize: 12, fontWeight: 600, lineHeight: 1.35, marginBottom: 4 }}>
            {selectedOption.title}
          </div>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 11.2, lineHeight: 1.45 }}>
            {selectedOption.weekImpact}
          </p>
          <p style={{ margin: '5px 0 0', color: 'var(--text-3)', fontSize: 10.8, lineHeight: 1.45 }}>
            Nach dem Klick: {selectedOption.resultPreview}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, marginTop: 9 }}>
            <button
              type="button"
              data-testid="plan-weekly-decision-remember"
              onClick={rememberDecision}
              style={{
                minHeight: 40,
                border: `1px solid ${tone}`,
                borderRadius: 5,
                background: `color-mix(in srgb, ${tone} 8%, transparent)`,
                color: tone,
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0,
                textTransform: 'uppercase',
              }}
            >
              Entscheidung merken
            </button>
            <span style={{ color: 'var(--text-3)', fontSize: 10.5, lineHeight: 1.4 }}>
              Speichert nur einen lokalen Entscheidungsbeleg; Plan und Garmin bleiben unverändert.
            </span>
          </div>
        </div>
      )}

      {receipt && (
        <div
          data-testid="plan-weekly-decision-receipt"
          style={{
            marginTop: 10,
            border: '1px solid color-mix(in srgb, var(--green) 24%, var(--border))',
            borderRadius: 5,
            background: 'rgba(74,222,128,0.045)',
            padding: '9px 10px',
          }}
        >
          <div className="label-mono" style={{ color: 'var(--green)', fontSize: 8.5, marginBottom: 5 }}>
            Gemerkte Wochenentscheidung
          </div>
          <div style={{ color: 'var(--text)', fontSize: 12, fontWeight: 600, lineHeight: 1.35, marginBottom: 4 }}>
            {receipt.title}
          </div>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 11.2, lineHeight: 1.45 }}>
            {receipt.decision}. {receipt.weekImpact}
          </p>
          <p style={{ margin: '5px 0 0', color: 'var(--text-2)', fontSize: 11.2, lineHeight: 1.45 }}>
            {receipt.nextConsequence}
          </p>
          <p style={{ margin: '5px 0 0', color: 'var(--text-3)', fontSize: 10.8, lineHeight: 1.45 }}>
            {receipt.mutationBoundary}
          </p>
          {receipt.targetPath && (
            <button
              type="button"
              onClick={() => activateTargetPath(receipt.targetPath)}
              style={{
                minHeight: 38,
                marginTop: 8,
                border: '1px solid var(--border)',
                borderRadius: 5,
                background: 'transparent',
                color: 'var(--text-2)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: 0,
                textTransform: 'uppercase',
              }}
            >
              Nächsten Schritt öffnen
            </button>
          )}
        </div>
      )}
    </Wrapper>
  );
}
