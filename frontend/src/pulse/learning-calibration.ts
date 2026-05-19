import type {
  PulseDailyDecisionQualityResponse,
  PulseFuelingOutcomeBaseline,
  PulsePersonalResponseResponse,
  PulsePersonalResponseSignal,
} from '@coaching-os/shared/pulse';
import {
  fuelingLearningActionTargetPath,
  fuelingLearningGapSummary,
  fuelingTrendEvidenceLabel,
  fuelingTrendSummaryForDisplay,
  isFuelingTrendReady,
} from './fueling-learning';

export type LearningCalibrationEffect = 'today_action' | 'watch_context';
export type LearningCalibrationTone = 'green' | 'amber' | 'rose' | 'muted';

export type LearningCalibrationSignal = {
  label: string;
  title: string;
  summary: string;
  evidence: string[];
  tone: LearningCalibrationTone;
  effect: LearningCalibrationEffect;
  actionLabel?: string;
  targetPath?: string;
  resultPreview?: string;
};

export const LEARNING_DECISION_QUALITY_PATH = '/data?tab=analysis#data-decision-quality';
export const LEARNING_PERSONAL_RESPONSE_PATH = '/data?tab=analysis#data-personal-response';

function unique(items: Array<string | null | undefined>, limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const clean = item?.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
    if (result.length >= limit) break;
  }
  return result;
}

function personalResponseSignalRank(signal: PulsePersonalResponseSignal): number {
  if (signal.strength === 'useful') return 3;
  if (signal.strength === 'learning') return 2;
  return 1;
}

export function strongestPersonalResponseSignal(
  personalResponse: PulsePersonalResponseResponse | null | undefined,
): PulsePersonalResponseSignal | null {
  return personalResponse?.summary.signals
    .filter(item => item.strength !== 'insufficient')
    .sort((a, b) => personalResponseSignalRank(b) - personalResponseSignalRank(a))[0] ?? null;
}

export function decisionQualityCanCalibrate(
  decisionQuality: PulseDailyDecisionQualityResponse | null | undefined,
): boolean {
  if (!decisionQuality) return false;
  const hasRepeatedTheme = decisionQuality.repeatedThemes.some(theme => theme.count >= 2);
  const hasEvidence = decisionQuality.bestEvidence.length > 0 || hasRepeatedTheme;
  return hasEvidence && (decisionQuality.status === 'helpful' || decisionQuality.status === 'needs_strategy_change');
}

function learningCalibrationResultPreview(targetPath: string, effect: LearningCalibrationEffect): string {
  if (targetPath.includes('#activity-fueling-log')) {
    return effect === 'watch_context'
      ? 'Öffnet die Aktivität und den Fueling-Log als Watch-Kontext. Plan und Garmin bleiben unverändert; du schließt nur die Evidenzlücke.'
      : 'Öffnet die Aktivität und den Fueling-Log. Plan und Garmin bleiben unverändert; du prüfst dort nur die Lern-Evidenz.';
  }
  if (targetPath.includes('#data-decision-quality')) {
    return effect === 'today_action'
      ? 'Öffnet die Lern-Evidenz als Tageshandlung. Plan und Garmin bleiben unverändert; Pulse schreibt keine neue Empfehlung ohne deinen nächsten expliziten Schritt.'
      : 'Öffnet die Entscheidungsqualität als Watch-Kontext. Plan und Garmin bleiben unverändert; du prüfst dort nur die Grundlage.';
  }
  if (targetPath.includes('#data-personal-response')) {
    return effect === 'today_action'
      ? 'Öffnet die Reaktionsmuster und Fueling-Evidenz als Tageshandlung. Plan und Garmin bleiben unverändert; du prüfst dort nur die Grundlage.'
      : 'Öffnet die Reaktionsmuster und Fueling-Evidenz als Watch-Kontext. Plan und Garmin bleiben unverändert; du prüfst dort nur die Grundlage.';
  }
  return effect === 'today_action'
    ? 'Öffnet die passende Lern-Evidenz als Tageshandlung. Plan und Garmin bleiben unverändert; du prüfst dort nur die Grundlage.'
    : 'Öffnet die passende Lern-Evidenz als Watch-Kontext. Plan und Garmin bleiben unverändert; du prüfst dort nur die Grundlage.';
}

export function buildLearningCalibration(
  decisionQuality: PulseDailyDecisionQualityResponse | null | undefined,
  personalResponse: PulsePersonalResponseResponse | null | undefined,
  fuelingOutcomeBaseline: PulseFuelingOutcomeBaseline | null | undefined,
): LearningCalibrationSignal {
  const responseSignal = strongestPersonalResponseSignal(personalResponse);
  const fuelingTrend = fuelingTrendSummaryForDisplay(fuelingOutcomeBaseline);
  const fuelingGap = fuelingLearningGapSummary(fuelingOutcomeBaseline);
  const fuelingReady = isFuelingTrendReady(fuelingOutcomeBaseline);
  const readyNotes: string[] = [];
  const watchNotes: string[] = [];
  const evidence: string[] = [];

  if (decisionQualityCanCalibrate(decisionQuality)) {
    readyNotes.push(`Decision Quality: ${decisionQuality!.statusLabel}; ${decisionQuality!.suggestedAdjustment}`);
    evidence.push(...decisionQuality!.bestEvidence);
  } else if (decisionQuality && decisionQuality.status !== 'insufficient_evidence') {
    watchNotes.push(`Decision Quality: ${decisionQuality.statusLabel}; ${decisionQuality.suggestedAdjustment}`);
    evidence.push(...decisionQuality.bestEvidence);
  }

  if (responseSignal?.strength === 'useful') {
    readyNotes.push(`Reaktionsmodell: ${responseSignal.nextAdjustment}`);
    evidence.push(...responseSignal.evidence);
  } else if (responseSignal?.strength === 'learning') {
    watchNotes.push(`${responseSignal.kind === 'fueling_response' ? 'Fueling-Reaktion' : 'Reaktionsmodell'}: ${responseSignal.nextAdjustment}`);
    evidence.push(...responseSignal.evidence);
  }

  if (fuelingReady) {
    readyNotes.push(fuelingTrend ? `Fueling: ${fuelingTrend}` : `Fueling: ${fuelingTrendEvidenceLabel(fuelingOutcomeBaseline)} vollstaendig`);
    evidence.push(...(fuelingOutcomeBaseline?.evidence ?? []));
  } else if (fuelingGap) {
    watchNotes.push(`Fueling: ${fuelingGap}`);
    evidence.push(...(fuelingOutcomeBaseline?.evidence ?? []));
  }

  if (readyNotes.length > 0) {
    const hasWatchRemainder = watchNotes.length > 0;
    const targetPath = decisionQualityCanCalibrate(decisionQuality) ? LEARNING_DECISION_QUALITY_PATH : LEARNING_PERSONAL_RESPONSE_PATH;
    const resultPreview = targetPath === LEARNING_PERSONAL_RESPONSE_PATH && responseSignal?.strength === 'useful'
      ? `Öffnet die Reaktionsmuster; ${responseSignal.nextAdjustment} Plan und Garmin bleiben unverändert.`
      : learningCalibrationResultPreview(targetPath, 'today_action');
    return {
      label: 'Lernkalibrierung',
      title: hasWatchRemainder ? 'Empfehlung darf teilweise lernen' : 'Empfehlung darf lernen',
      summary: hasWatchRemainder
        ? `Empfehlung darf lernen: ${readyNotes.join(' · ')}. Watch-Kontext bleibt: ${watchNotes.join(' · ')}.`
        : `Empfehlung darf lernen: ${readyNotes.join(' · ')}.`,
      evidence: unique(evidence, 4),
      tone: decisionQuality?.status === 'needs_strategy_change' ? 'rose' : 'green',
      effect: 'today_action',
      actionLabel: 'Kalibrierung prüfen',
      targetPath,
      resultPreview,
    };
  }

  if (watchNotes.length === 0) {
    return {
      label: 'Lernkalibrierung',
      title: 'Lernevidenz offen',
      summary: 'Noch nicht genug wiederholte Decision-Quality-, Reaktions- oder Fueling-Evidenz, um die nächste Empfehlung zu verändern.',
      evidence: [],
      tone: 'muted',
      effect: 'watch_context',
    };
  }

  const targetPath = fuelingLearningActionTargetPath(fuelingOutcomeBaseline)
    ?? (responseSignal ? LEARNING_PERSONAL_RESPONSE_PATH : LEARNING_DECISION_QUALITY_PATH);
  const actionLabel = fuelingOutcomeBaseline?.learningReadiness?.nextAction?.label
    ?? (responseSignal ? 'Lernevidenz prüfen' : 'Entscheidungsqualität prüfen');

  return {
    label: 'Lernkalibrierung',
    title: 'Noch nicht kalibrieren',
    summary: `Noch Watch-Kontext: ${watchNotes.join(' · ')}.`,
    evidence: unique(evidence, 4),
    tone: 'amber',
    effect: 'watch_context',
    actionLabel,
    targetPath,
    resultPreview: learningCalibrationResultPreview(targetPath, 'watch_context'),
  };
}
