import type { PulseFuelingLearningCompletionCandidate, PulseFuelingOutcomeBaseline } from '@coaching-os/shared/pulse';
import {
  fuelingCompletionCandidateTargetPath,
  fuelingLearningActionTargetPath,
  fuelingTrendSummaryForDisplay,
  isFuelingTrendReady,
  requiredComparableFuelingLogs,
} from '../pulse/fueling-learning';

function chip(label: string, value: string | number | null | undefined): string | null {
  if (value == null || value === '') return null;
  return `${label}: ${value}`;
}

const fuelingLearningContext = 'Sodium, Hitze und Schweißrate nur notieren, wenn du sie wirklich gemessen hast.';

function hydrationGapText(baseline: PulseFuelingOutcomeBaseline): string | null {
  const gaps = baseline.hydrationEvidenceGaps?.filter(Boolean) ?? [];
  if (gaps.length === 0) return null;
  return `Kontextlücken: ${gaps.join(' · ')}`;
}

function hydrationLearningContext(baseline: PulseFuelingOutcomeBaseline): string {
  const measuredContext = baseline.hydrationContextSummary?.trim();
  if (measuredContext) return measuredContext.replace(/[.\s]+$/u, '.');
  return fuelingLearningContext;
}

export function fuelingBaselineTrendEvidenceValue(baseline: PulseFuelingOutcomeBaseline): string | null {
  const readiness = baseline.learningReadiness ?? null;
  if (!readiness) return null;
  return `${readiness.comparableCompleteLogs}/${requiredComparableFuelingLogs(baseline)}`;
}

export function fuelingBaselineReadinessGap(baseline: PulseFuelingOutcomeBaseline): string | null {
  const readiness = baseline.learningReadiness ?? null;
  if (!readiness || isFuelingTrendReady(baseline)) return null;
  return readiness.missingEvidence[0] ?? null;
}

export function fuelingBaselineNextLearningLogText(baseline: PulseFuelingOutcomeBaseline): string | null {
  const readiness = baseline.learningReadiness ?? null;
  if (!readiness || isFuelingTrendReady(baseline)) return null;

  const nextAction = readiness.nextAction ?? null;
  if (nextAction && nextAction.kind !== 'log_next_long_session') {
    return `Nächste Evidence: ${nextAction.label}. ${nextAction.detail}`;
  }

  const target = baseline.targetCarbsPerHour
    ? `${baseline.targetCarbsPerHour.min}-${baseline.targetCarbsPerHour.max} g/h kontrolliert testen; `
    : '';

  return `Nächster Lernlog: ${target}Dauer, Carbs und GI-Komfort zusammen erfassen. Flaschen/Pulver mitschreiben; ${hydrationLearningContext(baseline)}`;
}

export function FuelingOutcomeBaselineBlock({
  baseline,
  hidePrimaryNextAction = false,
  onOpenNextAction,
  testId = 'fueling-outcome-baseline',
}: {
  baseline?: PulseFuelingOutcomeBaseline | null;
  hidePrimaryNextAction?: boolean;
  onOpenNextAction?: (targetPath: string) => void;
  testId?: string;
}) {
  if (!baseline) return null;
  const readiness = baseline.learningReadiness ?? null;
  if (baseline.status === 'insufficient_data' && !readiness) return null;
  const tone = baseline.status === 'stable' ? 'var(--green)' : baseline.status === 'learning' ? 'var(--amber)' : 'var(--text-3)';
  const target = baseline.targetCarbsPerHour
    ? `${baseline.targetCarbsPerHour.min}-${baseline.targetCarbsPerHour.max} g/h`
    : null;
  const chips = [
    chip('Ist', baseline.observedCarbsPerHour != null ? `${baseline.observedCarbsPerHour} g/h` : null),
    chip('Ziel', target),
    chip('Flaschen', baseline.bottles750Ml != null ? `${baseline.bottles750Ml}x750 ml` : null),
    chip('Pulver', baseline.powderG != null ? `${Math.round(baseline.powderG)}g` : null),
    chip('Fluid', baseline.fluidMlPerHour != null ? `${baseline.fluidMlPerHour} ml/h` : null),
    chip('Sodium', baseline.sodiumMgPerHour != null ? `${baseline.sodiumMgPerHour} mg/h` : 'offen'),
    chip('Trend-Evidenz', fuelingBaselineTrendEvidenceValue(baseline)),
  ].filter((item): item is string => item != null);
  const readinessGap = fuelingBaselineReadinessGap(baseline);
  const hydrationGap = hydrationGapText(baseline);
  const nextLearningLog = fuelingBaselineNextLearningLogText(baseline);
  const nextLearningAction = baseline.learningReadiness?.nextAction ?? null;
  const nextLearningActionTargetPath = fuelingLearningActionTargetPath(baseline);
  const completionTargets: Array<{ candidate: PulseFuelingLearningCompletionCandidate; targetPath: string }> = (readiness?.completionCandidates ?? [])
    .map(candidate => ({ candidate, targetPath: fuelingCompletionCandidateTargetPath(candidate) }))
    .filter((item): item is { candidate: PulseFuelingLearningCompletionCandidate; targetPath: string } =>
      item.targetPath != null,
    );
  const trendSummary = fuelingTrendSummaryForDisplay(baseline);

  return (
    <div
      data-testid={testId}
      style={{
        padding: 9,
        borderRadius: 4,
        border: `1px solid color-mix(in srgb, ${tone} 30%, var(--border))`,
        background: `color-mix(in srgb, ${tone} 7%, transparent)`,
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        marginBottom: 5,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          fontWeight: 700,
          color: tone,
          letterSpacing: 0,
          textTransform: 'uppercase',
        }}>
          {baseline.label}
        </span>
        {baseline.latestLogDate && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
            {baseline.latestLogDate}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: 'var(--text-2)' }}>
        {baseline.summary}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
        {chips.map(item => (
          <span
            key={item}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-2)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '2px 5px',
            }}
          >
            {item}
          </span>
        ))}
      </div>
      {readinessGap && (
        <p style={{ margin: '7px 0 0', fontSize: 10.5, lineHeight: 1.45, color: 'var(--text-3)' }}>
          {readinessGap}
        </p>
      )}
      {hydrationGap && (
        <p style={{ margin: '6px 0 0', fontSize: 10.5, lineHeight: 1.45, color: 'var(--text-3)' }}>
          {hydrationGap}
        </p>
      )}
      {trendSummary && (
        <p style={{ margin: '6px 0 0', fontSize: 10.5, lineHeight: 1.45, color: 'var(--text-2)' }}>
          {trendSummary}
        </p>
      )}
      {nextLearningLog && (
        <p style={{ margin: '6px 0 0', fontSize: 10.5, lineHeight: 1.45, color: 'var(--text-2)' }}>
          {nextLearningLog}
        </p>
      )}
      {!hidePrimaryNextAction && nextLearningAction && nextLearningActionTargetPath && onOpenNextAction && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => onOpenNextAction(nextLearningActionTargetPath)}
            style={{
              alignSelf: 'flex-start',
              minHeight: 44,
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '7px 10px',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            {nextLearningAction.label}
          </button>
          <span style={{ fontSize: 10.5, lineHeight: 1.45, color: 'var(--text-3)' }}>
            Nach dem Klick: Pulse öffnet die Aktivität und den Fueling-Log; Plan und Garmin bleiben unverändert.
          </span>
        </div>
      )}
      {completionTargets.length > 1 && onOpenNextAction && (
        <div data-testid={`${testId}-completion-candidates`} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 9 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase' }}>
            Bestehende Logs schließen
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {completionTargets.map(({ candidate, targetPath }) => (
              <button
                key={`${candidate.kind}-${targetPath}`}
                type="button"
                onClick={() => onOpenNextAction(targetPath)}
                style={{
                  minHeight: 44,
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '7px 9px',
                  background: 'rgba(0,0,0,0.12)',
                  color: 'var(--text-2)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9.5,
                  cursor: 'pointer',
                }}
              >
                {candidate.summary}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 10.5, lineHeight: 1.45, color: 'var(--text-3)' }}>
            Erst echte GI- oder Carb-Evidence eintragen; danach braucht die Baseline noch neue komplette Long-Session-Logs.
          </span>
        </div>
      )}
    </div>
  );
}
