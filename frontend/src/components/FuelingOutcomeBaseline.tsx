import type { PulseFuelingOutcomeBaseline } from '@coaching-os/shared/pulse';

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

function nextLearningLogText(baseline: PulseFuelingOutcomeBaseline): string | null {
  const readiness = baseline.learningReadiness ?? null;
  if (!readiness || readiness.readyForTrendSummary) return null;

  const target = baseline.targetCarbsPerHour
    ? `${baseline.targetCarbsPerHour.min}-${baseline.targetCarbsPerHour.max} g/h kontrolliert testen; `
    : '';

  return `Nächster Lernlog: ${target}Dauer, Carbs und GI-Komfort zusammen erfassen. Flaschen/Pulver mitschreiben; ${hydrationLearningContext(baseline)}`;
}

export function FuelingOutcomeBaselineBlock({
  baseline,
  testId = 'fueling-outcome-baseline',
}: {
  baseline?: PulseFuelingOutcomeBaseline | null;
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
    readiness ? chip('Trend-Evidenz', `${readiness.comparableCompleteLogs}/${readiness.requiredComparableCompleteLogs}`) : null,
  ].filter((item): item is string => item != null);
  const readinessGap = readiness?.readyForTrendSummary === false
    ? readiness.missingEvidence[0] ?? null
    : null;
  const hydrationGap = hydrationGapText(baseline);
  const nextLearningLog = nextLearningLogText(baseline);
  const trendSummary = baseline.trendSummary?.trim() || null;

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
    </div>
  );
}
