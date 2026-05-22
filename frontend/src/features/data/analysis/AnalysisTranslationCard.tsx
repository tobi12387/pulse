import type {
  PulseDailyDecisionQualityResponse,
  PulseFuelingOutcomeBaseline,
  PulseGoalProjectionResponse,
  PulsePersonalResponseResponse,
  PulsePlanTrace,
  PulseTrainingAnalyticsResponse,
} from '@coaching-os/shared/pulse';
import { useNavigate } from 'react-router-dom';
import { buildAnalysisTranslation, type AnalysisTranslationSignal, type AnalysisTranslationTone } from './analysis-translation-model';

type Props = {
  decisionQuality: PulseDailyDecisionQualityResponse | null | undefined;
  fuelingOutcomeBaseline?: PulseFuelingOutcomeBaseline | null | undefined;
  goalProjection: PulseGoalProjectionResponse | null | undefined;
  personalResponse: PulsePersonalResponseResponse | null | undefined;
  planTrace: PulsePlanTrace | null | undefined;
  trainingAnalytics: PulseTrainingAnalyticsResponse | null | undefined;
  loading?: boolean;
};

function toneColor(tone: AnalysisTranslationTone): string {
  if (tone === 'green') return 'var(--green)';
  if (tone === 'amber') return 'var(--amber)';
  if (tone === 'rose') return 'var(--rose)';
  return 'var(--text-3)';
}

function SignalBlock({
  signal,
  label,
  onNavigate,
}: {
  signal: AnalysisTranslationSignal;
  label: string;
  onNavigate: (path: string) => void;
}) {
  const color = toneColor(signal.tone);
  const targetPath = signal.actionLabel ? signal.targetPath : undefined;
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 9, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
          {signal.label}
        </span>
      </div>
      <h3 style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--text)', fontWeight: 650, lineHeight: 1.35 }}>
        {signal.title}
      </h3>
      <p style={{ margin: '5px 0 0', fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.55 }}>
        {signal.summary}
      </p>
      <div
        data-testid={`analysis-translation-effect-${signal.effect}`}
        style={{
          marginTop: 7,
          border: '1px solid var(--border)',
          borderRadius: 5,
          background: 'var(--surface-2)',
          padding: '6px 8px',
          display: 'grid',
          gap: 3,
        }}
      >
        <div className="label-mono" style={{ color, fontSize: 8 }}>
          Wirkung: {signal.effectLabel}
        </div>
        <p style={{ margin: 0, fontSize: 10.8, color: 'var(--text-3)', lineHeight: 1.4 }}>
          {signal.effectSummary}
        </p>
      </div>
      {targetPath ? (
        <div
          style={{
            marginTop: 8,
            border: '1px solid rgba(47,102,208,0.22)',
            borderRadius: 5,
            padding: '8px 9px',
            background: 'rgba(47,102,208,0.05)',
            display: 'grid',
            gap: 7,
          }}
        >
          <div>
            <div className="label-mono" style={{ color: 'var(--accent)', fontSize: 8 }}>Nach dem Klick</div>
            <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45 }}>
              {signal.resultPreview ?? 'Öffnet die nächste explizite Entscheidung; diese Analyse schreibt nichts automatisch.'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(targetPath)}
            style={{
              minHeight: 44,
              minWidth: 44,
              justifySelf: 'start',
              padding: '8px 12px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: 'var(--accent-contrast)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 650,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {signal.actionLabel}
          </button>
        </div>
      ) : signal.actionLabel ? (
        <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Nächste explizite Aktion: {signal.actionLabel}
        </p>
      ) : null}
    </div>
  );
}

function TrainingRiskBlock({
  signal,
  onNavigate,
}: {
  signal: AnalysisTranslationSignal;
  onNavigate: (path: string) => void;
}) {
  const color = toneColor(signal.tone);
  const targetPath = signal.actionLabel ? signal.targetPath : undefined;
  const ctaLabel = targetPath?.startsWith('/plan')
    ? 'Risiko einordnen'
    : targetPath?.includes('#data-power-quality')
      ? 'Messgrundlage prüfen'
      : targetPath
        ? 'Watch-Evidenz prüfen'
        : signal.actionLabel;

  return (
    <div
      data-testid="analysis-training-risk-contract"
      style={{
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 5,
        background: 'var(--surface-2)',
        padding: '8px 9px',
        display: 'grid',
        gap: 7,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="label-mono" style={{ color }}>
          Trainingsrisiko
        </span>
        <span className="label-mono" style={{ color: 'var(--text-3)' }}>
          Wirkung: {signal.effectLabel}
        </span>
      </div>
      <div>
        <h3 style={{ margin: 0, fontSize: 13, color: 'var(--text)', fontWeight: 650, lineHeight: 1.35 }}>
          {signal.title}
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
          {signal.summary}
        </p>
      </div>
      {signal.evidence.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {signal.evidence.map(item => (
            <span
              key={item}
              data-testid="analysis-training-risk-driver"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--text-3)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '3px 6px',
                overflowWrap: 'anywhere',
              }}
            >
              {item}
            </span>
          ))}
        </div>
      )}
      {targetPath ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <p style={{ flex: '1 1 260px', margin: 0, fontSize: 10.8, color: 'var(--text-3)', lineHeight: 1.4 }}>
            {signal.resultPreview}
          </p>
          <button
            type="button"
            onClick={() => onNavigate(targetPath)}
            style={{
              minHeight: 40,
              minWidth: 44,
              padding: '7px 10px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 650,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {ctaLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AnalysisTranslationCard({
  decisionQuality,
  fuelingOutcomeBaseline,
  goalProjection,
  personalResponse,
  planTrace,
  trainingAnalytics,
  loading = false,
}: Props) {
  const navigate = useNavigate();
  const translation = buildAnalysisTranslation({
    decisionQuality,
    fuelingOutcomeBaseline,
    goalProjection,
    personalResponse,
    planTrace,
    trainingAnalytics,
  });

  return (
    <section
      className="card"
      data-testid="analysis-translation-card"
      aria-label="Analyse Tageswirkung"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: 'rgba(47,102,208,0.22)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Analyse -&gt; Tageswirkung
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: loading ? 'var(--amber)' : 'var(--text-3)' }}>
          {loading ? 'liest Evidenz' : 'Read-only'}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
        Pulse übersetzt die tiefen Analyseblöcke zuerst in Entscheidungswirkung. Details bleiben darunter, aber diese Karte sagt, welcher Befund heute handeln sollte und welcher nur beobachtet wird.
      </p>

      <TrainingRiskBlock signal={translation.trainingRisk} onNavigate={navigate} />
      <SignalBlock signal={translation.learning} label="Lernkalibrierung" onNavigate={navigate} />
      <SignalBlock signal={translation.primary} label="Handlungsrelevant" onNavigate={navigate} />
      <SignalBlock signal={translation.watch} label="Interessant, aber noch nicht entscheidend" onNavigate={navigate} />

      {translation.supportEvidence.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {translation.supportEvidence.map(item => (
            <span
              key={item}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--text-3)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '3px 6px',
                overflowWrap: 'anywhere',
              }}
            >
              {item}
            </span>
          ))}
        </div>
      )}
      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.45 }}>
        Kein Plan-, Garmin- oder Coach-Write entsteht aus dieser Analyse. Eine Änderung bleibt ein separater, expliziter Schritt.
      </p>
    </section>
  );
}
