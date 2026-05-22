import type { PulseFuelingLearningCompletionCandidate, PulseFuelingOutcomeBaseline } from '@coaching-os/shared/pulse';

export const MIN_COMPARABLE_FUELING_LOGS = 3;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function requiredComparableFuelingLogs(baseline: PulseFuelingOutcomeBaseline | null | undefined): number {
  return Math.max(
    baseline?.learningReadiness?.requiredComparableCompleteLogs ?? MIN_COMPARABLE_FUELING_LOGS,
    MIN_COMPARABLE_FUELING_LOGS,
  );
}

export function fuelingTrendEvidenceLabel(baseline: PulseFuelingOutcomeBaseline | null | undefined): string {
  const comparable = baseline?.learningReadiness?.comparableCompleteLogs ?? 0;
  return `Trend-Evidenz ${comparable}/${requiredComparableFuelingLogs(baseline)}`;
}

export function fuelingLearningCapturePlan(baseline: PulseFuelingOutcomeBaseline | null | undefined): string | null {
  const readiness = baseline?.learningReadiness ?? null;
  if (!baseline || !readiness || isFuelingTrendReady(baseline)) return null;

  const required = requiredComparableFuelingLogs(baseline);
  const comparable = readiness.comparableCompleteLogs;
  const candidates = readiness.completionCandidates?.length ?? 0;
  const newLogsNeeded = Math.max(required - comparable - candidates, 0);
  const candidateText = candidates === 1
    ? '1 vorhandener Log direkt schließbar'
    : `${candidates} vorhandene Logs direkt schließbar`;
  const newLogText = newLogsNeeded === 0
    ? 'danach kein neuer Long-Session-Log nötig'
    : newLogsNeeded === 1
      ? 'danach 1 neuer Long-Session-Log'
      : `danach ${newLogsNeeded} neue Long-Session-Logs`;

  return `${comparable}/${required} komplett · ${candidateText} · ${newLogText}. GI-Komfort bleibt echte Auswahl.`;
}

export function isFuelingTrendReady(baseline: PulseFuelingOutcomeBaseline | null | undefined): boolean {
  const readiness = baseline?.learningReadiness ?? null;
  if (!readiness?.readyForTrendSummary) return false;
  return readiness.comparableCompleteLogs >= requiredComparableFuelingLogs(baseline);
}

export function fuelingTrendSummaryForDisplay(baseline: PulseFuelingOutcomeBaseline | null | undefined): string | null {
  const summary = clean(baseline?.trendSummary ?? null);
  if (!summary || !isFuelingTrendReady(baseline)) return null;
  return summary;
}

export function fuelingLearningActionTargetPath(baseline: PulseFuelingOutcomeBaseline | null | undefined): string | null {
  const nextAction = baseline?.learningReadiness?.nextAction ?? null;
  if (!nextAction?.activityId || nextAction.kind === 'log_next_long_session') return null;
  return `/plan/activity/${nextAction.activityId}#activity-fueling-log`;
}

export function fuelingCompletionCandidateTargetPath(candidate: PulseFuelingLearningCompletionCandidate): string | null {
  if (!candidate.activityId) return null;
  return `/plan/activity/${candidate.activityId}#activity-fueling-log`;
}

export function fuelingLearningGapSummary(baseline: PulseFuelingOutcomeBaseline | null | undefined): string | null {
  const readiness = baseline?.learningReadiness ?? null;
  if (!baseline || !readiness || isFuelingTrendReady(baseline)) return null;

  const missing = readiness.missingEvidence[0] ?? 'Vergleichbare komplette During-Logs fehlen noch.';
  const nextAction = readiness.nextAction ?? null;
  const nextActionText = nextAction
    ? ` Naechste Evidence: ${nextAction.label}; ${nextAction.detail}`
    : '';
  return `${fuelingTrendEvidenceLabel(baseline)}: ${missing}.${nextActionText}`;
}
