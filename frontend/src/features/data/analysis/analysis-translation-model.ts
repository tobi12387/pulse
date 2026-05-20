import type {
  PulseDailyDecisionQualityResponse,
  PulseFuelingOutcomeBaseline,
  PulseGoalProjection,
  PulseGoalProjectionResponse,
  PulsePersonalResponseResponse,
  PulsePersonalResponseSignal,
  PulsePlanTrace,
  PulseTrainingAnalyticsResponse,
} from '@coaching-os/shared/pulse';
import {
  buildLearningCalibration,
  strongestPersonalResponseSignal,
} from '../../../pulse/learning-calibration';
import { classifyTradeoffPattern, type TradeoffPatternClassification } from '../../../pulse/tradeoff-patterns';

export type AnalysisTranslationTone = 'green' | 'amber' | 'rose' | 'muted';
export type AnalysisDecisionEffect = 'today_action' | 'plan_decision' | 'watch_context';

export type AnalysisTranslationSignal = {
  label: string;
  title: string;
  summary: string;
  evidence: string[];
  tone: AnalysisTranslationTone;
  effect: AnalysisDecisionEffect;
  effectLabel: string;
  effectSummary: string;
  actionLabel?: string;
  targetPath?: string;
  resultPreview?: string;
};

export type AnalysisTranslation = {
  trainingRisk: AnalysisTranslationSignal;
  learning: AnalysisTranslationSignal;
  primary: AnalysisTranslationSignal;
  watch: AnalysisTranslationSignal;
  supportEvidence: string[];
};

const PLAN_WEEKLY_DECISION_PATH = '/plan?tab=training&source=data-load#plan-weekly-decision';
const TRADEOFF_PLAN_DECISION_PATH = '/plan?tab=training&source=data-tradeoff#plan-weekly-decision';
const TRADEOFF_TODAY_PATH = '/?source=data-tradeoff';
const GOAL_PROJECTION_PATH = '/data?tab=analysis#data-goal-projection';
const DECISION_QUALITY_PATH = '/data?tab=analysis#data-decision-quality';
const PERSONAL_RESPONSE_PATH = '/data?tab=analysis#data-personal-response';
const POWER_QUALITY_PATH = '/data?tab=analysis#data-power-quality';
const POWER_DURATION_PATH = '/data?tab=analysis#data-power-duration';

const EFFECT_COPY: Record<AnalysisDecisionEffect, { label: string; summary: string }> = {
  today_action: {
    label: 'Tageshandlung',
    summary: 'Dieses Signal kann die heutige naechste Handlung veraendern oder eine Evidenzluecke schliessen.',
  },
  plan_decision: {
    label: 'Planentscheidung',
    summary: 'Dieses Signal gehoert in die Wochenentscheidung, bevor Plan oder Garmin veraendert werden.',
  },
  watch_context: {
    label: 'Watch-Kontext',
    summary: 'Dieses Signal bleibt Beobachtung und sollte ohne staerkeren Kontext keine Handlung fuehren.',
  },
};

function withEffect<T extends Omit<AnalysisTranslationSignal, 'effect' | 'effectLabel' | 'effectSummary'>>(
  signal: T,
  effect: AnalysisDecisionEffect,
): AnalysisTranslationSignal {
  const copy = EFFECT_COPY[effect];
  return {
    ...signal,
    effect,
    effectLabel: copy.label,
    effectSummary: copy.summary,
  };
}

type Input = {
  decisionQuality: PulseDailyDecisionQualityResponse | null | undefined;
  goalProjection: PulseGoalProjectionResponse | null | undefined;
  personalResponse: PulsePersonalResponseResponse | null | undefined;
  planTrace: PulsePlanTrace | null | undefined;
  trainingAnalytics: PulseTrainingAnalyticsResponse | null | undefined;
  fuelingOutcomeBaseline?: PulseFuelingOutcomeBaseline | null | undefined;
};

function goalTone(status: PulseGoalProjection['status']): AnalysisTranslationTone {
  if (status === 'on_track') return 'green';
  if (status === 'watch') return 'amber';
  if (status === 'at_risk') return 'rose';
  return 'muted';
}

function qualityTone(status: PulseDailyDecisionQualityResponse['status']): AnalysisTranslationTone {
  if (status === 'helpful') return 'green';
  if (status === 'watch' || status === 'stale') return 'amber';
  if (status === 'needs_strategy_change') return 'rose';
  return 'muted';
}

function signalTone(signal: PulsePersonalResponseSignal): AnalysisTranslationTone {
  if (signal.strength === 'useful') return 'green';
  if (signal.strength === 'learning') return 'amber';
  return 'muted';
}

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

function effectForTargetPath(targetPath: string): AnalysisDecisionEffect {
  if (targetPath.startsWith('/plan')) return 'plan_decision';
  if (
    targetPath.includes('#data-decision-quality') ||
    targetPath.includes('#data-personal-response') ||
    targetPath.includes('#data-garmin-quality')
  ) {
    return 'today_action';
  }
  return 'watch_context';
}

function strongestTone(tones: AnalysisTranslationTone[]): AnalysisTranslationTone {
  if (tones.includes('rose')) return 'rose';
  if (tones.includes('amber')) return 'amber';
  if (tones.includes('green')) return 'green';
  return 'muted';
}

function riskSignalTone(severity: string): AnalysisTranslationTone {
  if (['critical', 'severe', 'high', 'action'].includes(severity)) return 'rose';
  if (['warn', 'warning', 'watch', 'moderate'].includes(severity)) return 'amber';
  return 'muted';
}

function buildTrainingRiskContract(
  planTrace: PulsePlanTrace | null | undefined,
  trainingAnalytics: PulseTrainingAnalyticsResponse | null | undefined,
): AnalysisTranslationSignal {
  const riskSignals = planTrace?.inputSnapshot.riskSignals ?? [];
  const load = planTrace?.inputSnapshot.load ?? null;
  const limiter = planTrace?.inputSnapshot.goalLimiter ?? null;
  const dataWarnings = planTrace?.inputSnapshot.dataWarnings ?? [];
  const quality = trainingAnalytics?.powerDataQuality ?? null;
  const durability = trainingAnalytics?.powerDuration?.durability ?? null;
  const tones: AnalysisTranslationTone[] = [];
  const planDrivers: string[] = [];
  const dataDrivers: string[] = [];
  const watchDrivers: string[] = [];

  for (const signal of riskSignals.slice(0, 2)) {
    const tone = riskSignalTone(signal.severity);
    tones.push(tone);
    planDrivers.push(signal.title);
  }

  if (load && load.tsb <= -12) {
    tones.push(load.tsb <= -22 ? 'rose' : 'amber');
    planDrivers.push(`TSB ${load.tsb.toFixed(1)}`);
  }

  if (limiter) {
    tones.push(limiter.confidence === 'high' ? 'rose' : 'amber');
    planDrivers.push(`Limiter: ${limiter.label}`);
  }

  if (dataWarnings.length > 0) {
    tones.push('amber');
    planDrivers.push(dataWarnings[0]!);
  }

  if (quality?.status === 'blocked') {
    tones.push('rose');
    dataDrivers.push(`Power-Daten blockieren Trainingsrisiko: ${quality.limitations[0] ?? 'Messgrundlage fehlt'}`);
  } else if (quality?.status === 'usable_with_caution') {
    tones.push('amber');
    watchDrivers.push(`Power nur mit Vorsicht: ${quality.coveragePct}% Coverage`);
  }

  if (durability && durability.rating !== 'strong') {
    tones.push(durability.rating === 'limited' ? 'amber' : 'muted');
    watchDrivers.push(`Durability ${durability.rating}: ${durability.evidence[0] ?? 'Evidenz beobachten'}`);
  }

  const tone = strongestTone(tones);
  const allDrivers = unique([...planDrivers, ...dataDrivers, ...watchDrivers], 4);
  if (tone === 'green' || allDrivers.length === 0) {
    const hasEvidence = Boolean(planTrace || trainingAnalytics);
    return withEffect({
      label: 'Trainingsrisiko',
      title: hasEvidence ? 'Trainingsrisiko stabil' : 'Trainingsrisiko offen',
      summary: hasEvidence
        ? 'Aktuell zeigt die Analyse keinen harten Trainingsrisiko-Hebel; die Evidenz bleibt Watch-Kontext.'
        : 'Trainingsrisiko wird geladen; bis belastbare Evidenz vorliegt, bleibt die Analyse Watch-Kontext.',
      evidence: load ? [`TSB ${load.tsb.toFixed(1)}`] : [],
      tone: hasEvidence ? 'green' : 'muted',
    }, 'watch_context');
  }

  if (planDrivers.length > 0) {
    return withEffect({
      label: 'Trainingsrisiko',
      title: tone === 'rose' ? 'Trainingsrisiko hoch' : 'Trainingsrisiko prüfen',
      summary: `Plan- und Load-Risiko zuerst einordnen: ${allDrivers.join(' · ')}.`,
      evidence: allDrivers,
      tone,
      actionLabel: 'Wochenentscheidung prüfen',
      targetPath: PLAN_WEEKLY_DECISION_PATH,
      resultPreview: resultPreviewForTargetPath(PLAN_WEEKLY_DECISION_PATH, 'plan_decision'),
    }, 'plan_decision');
  }

  if (dataDrivers.length > 0) {
    return withEffect({
      label: 'Trainingsrisiko',
      title: 'Trainingsrisiko blockiert',
      summary: dataDrivers.join(' · '),
      evidence: allDrivers,
      tone: 'rose',
      actionLabel: 'Power-Daten prüfen',
      targetPath: POWER_QUALITY_PATH,
      resultPreview: resultPreviewForTargetPath(POWER_QUALITY_PATH, 'today_action'),
    }, 'today_action');
  }

  return withEffect({
    label: 'Trainingsrisiko',
    title: 'Trainingsrisiko beobachten',
    summary: `Noch kein Planentscheid, aber Watch-Kontext bleibt sichtbar: ${allDrivers.join(' · ')}.`,
    evidence: allDrivers,
    tone,
    actionLabel: 'Durability prüfen',
    targetPath: POWER_DURATION_PATH,
    resultPreview: resultPreviewForTargetPath(POWER_DURATION_PATH, 'watch_context'),
  }, 'watch_context');
}

function resultPreviewForTargetPath(targetPath: string, effect: AnalysisDecisionEffect = effectForTargetPath(targetPath)): string {
  if (targetPath.includes('#activity-fueling-log')) {
    return effect === 'watch_context'
      ? 'Öffnet die Aktivität und den Fueling-Log als Watch-Kontext. Plan und Garmin bleiben unverändert; du schließt nur die Evidenzlücke.'
      : 'Öffnet die Aktivität und den Fueling-Log. Plan und Garmin bleiben unverändert; du prüfst dort nur die Lern-Evidenz.';
  }
  if (targetPath.startsWith('/plan')) {
    return 'Öffnet die Planentscheidung in der Wochenentscheidung aus der Analyse. Plan und Garmin bleiben unverändert, bis du dort bewusst eine Vorschau anwendest.';
  }
  if (targetPath.includes('#data-goal-projection')) {
    return 'Öffnet die Zielprojektion als Watch-Kontext. Plan und Garmin bleiben unverändert; du prüfst dort nur die Grundlage.';
  }
  if (targetPath.includes('#data-decision-quality')) {
    return effect === 'today_action'
      ? 'Öffnet die Entscheidungsqualität als Tageshandlung und Lernschleife. Plan und Garmin bleiben unverändert; du prüfst dort nur die Grundlage.'
      : 'Öffnet die Entscheidungsqualität als Watch-Kontext. Plan und Garmin bleiben unverändert; du prüfst dort nur die Grundlage.';
  }
  if (targetPath.includes('#data-personal-response')) {
    return 'Öffnet die Reaktionsmuster und Fueling-Evidenz als Tageshandlung. Plan und Garmin bleiben unverändert; du prüfst dort nur die Grundlage.';
  }
  if (targetPath.includes('#data-power-quality')) {
    return effect === 'today_action'
      ? 'Öffnet die Power-Datenqualität als Tageshandlung, weil die Messgrundlage blockiert. Plan und Garmin bleiben unverändert.'
      : 'Öffnet die Power-Datenqualität als Watch-Kontext mit Quelle, Coverage und Limitierung. Plan und Garmin bleiben unverändert; du prüfst dort nur die Messgrundlage.';
  }
  if (targetPath.includes('#data-power-duration')) {
    return 'Öffnet die Durability-Evidenz als Watch-Kontext mit Best Effort und Drift. Plan und Garmin bleiben unverändert; du prüfst dort nur die Analysegrundlage.';
  }
  if (targetPath.includes('#data-garmin-quality')) {
    return 'Öffnet die Datengrundlage als Tageshandlung. Plan und Garmin bleiben unverändert; du pruefst dort nur die Evidenzluecke.';
  }
  if (targetPath.startsWith('/data')) {
    return effect === 'today_action'
      ? 'Öffnet die passende Datenevidenz als Tageshandlung. Plan und Garmin bleiben unverändert; du prüfst dort nur die Grundlage.'
      : 'Öffnet die passende Datenevidenz als Watch-Kontext. Plan und Garmin bleiben unverändert; du prüfst dort nur die Grundlage.';
  }
  if (targetPath === '/' || targetPath.startsWith('/?')) {
    return 'Öffnet die heutige Entscheidung mit diesem Schutzsignal. Plan und Garmin bleiben unverändert, bis du dort bewusst weitergehst.';
  }
  return 'Öffnet den nächsten expliziten Schritt aus der Analyse. Plan und Garmin bleiben unverändert, bis du dort bewusst weitergehst.';
}

function primaryFromGoal(goalProjection: PulseGoalProjectionResponse | null | undefined): AnalysisTranslationSignal | null {
  const top = goalProjection?.projections[0] ?? null;
  if (!top) return null;
  const intervention = top.nextBestIntervention;
  const effect = effectForTargetPath(intervention.targetPath);
  return withEffect({
    label: 'Zielwirkung',
    title: intervention.title,
    summary: `${top.title}: ${top.summary} ${intervention.summary}`,
    evidence: unique([...intervention.evidence, ...top.evidence, top.limiterRisk.summary], 4),
    tone: goalTone(top.status),
    actionLabel: intervention.actionLabel,
    targetPath: intervention.targetPath,
    resultPreview: resultPreviewForTargetPath(intervention.targetPath, effect),
  }, effect);
}

function primaryFromPlanTrace(planTrace: PulsePlanTrace | null | undefined): AnalysisTranslationSignal | null {
  const limiter = planTrace?.inputSnapshot.goalLimiter ?? null;
  if (!limiter) return null;
  return withEffect({
    label: 'Plan-Limiter',
    title: limiter.label,
    summary: limiter.planBias,
    evidence: unique(limiter.evidence, 4),
    tone: 'amber',
    actionLabel: 'Wochenentscheidung prüfen',
    targetPath: PLAN_WEEKLY_DECISION_PATH,
    resultPreview: resultPreviewForTargetPath(PLAN_WEEKLY_DECISION_PATH, 'plan_decision'),
  }, 'plan_decision');
}

function primaryFromDecisionQuality(decisionQuality: PulseDailyDecisionQualityResponse | null | undefined): AnalysisTranslationSignal | null {
  if (!decisionQuality) return null;
  return withEffect({
    label: 'Entscheidungsqualität',
    title: decisionQuality.statusLabel,
    summary: decisionQuality.suggestedAdjustment,
    evidence: unique(decisionQuality.bestEvidence, 4),
    tone: qualityTone(decisionQuality.status),
    actionLabel: 'Lernschleife prüfen',
    targetPath: DECISION_QUALITY_PATH,
    resultPreview: resultPreviewForTargetPath(DECISION_QUALITY_PATH, 'today_action'),
  }, 'today_action');
}

function tradeoffReopenSummary(
  pattern: TradeoffPatternClassification,
  scope: 'Heute' | 'Wochen',
): string {
  const sourceTrend = tradeoffReopenSourceTrendSummary(pattern);
  const resolvedSourceContext = sourceTrend ? tradeoffResolvedReopenSourceTrendContext(pattern) : null;
  const resolved = resolvedSourceContext
    ? `${resolvedSourceContext} `
    : pattern.resolvedEvidence.length > 0
    ? `Aeltere eingeordnete Evidenz bleibt Kontext: ${pattern.resolvedEvidence.join(' · ')}. `
    : '';
  if (sourceTrend) {
    return `${sourceTrend} ${resolved}${pattern.count}x ${pattern.themeLabel}. ${pattern.suggestedAdjustment}.`;
  }

  const prefix = pattern.hasFreshEvidence
    ? `Frische ${scope}-Evidenz`
    : scope === 'Heute'
      ? 'Wiederholter Tageskonflikt'
      : 'Wiederholter Tageskonflikt';
  const fresh = pattern.freshEvidence.length > 0
    ? `${pattern.freshEvidence.join(' · ')}. `
    : '';
  return `${prefix}: ${fresh}${resolved}${pattern.count}x ${pattern.themeLabel}. ${pattern.suggestedAdjustment}.`;
}

function tradeoffSourceTrendLabel(trends: TradeoffPatternClassification['reopenSourceTrends']): string | null {
  if (trends.length === 0) return null;
  return trends
    .map(trend => `${trend.label} ${trend.count}x`)
    .join(', ');
}

function tradeoffReceiptEvidence(pattern: TradeoffPatternClassification): string | null {
  return pattern.resolvedEvidence.find(item => /plan-receipt/i.test(item))
    ?? pattern.resolvedEvidence.find(item => /wochenentscheidung gemerkt/i.test(item))
    ?? null;
}

function tradeoffReceiptFollowupEvidence(pattern: TradeoffPatternClassification): string | null {
  return pattern.receiptFollowupEvidence[0] ?? null;
}

function receiptFollowupDays(value: string): number | null {
  const days = value.match(/\b(\d+)\s*Tage?\b/iu)?.[1] ?? null;
  if (days) return Number.parseInt(days, 10);

  const weeks = value.match(/\b(\d+)\s*Wochen?\b/iu)?.[1] ?? null;
  return weeks ? Number.parseInt(weeks, 10) * 7 : null;
}

function tradeoffReceiptTrustDuration(pattern: TradeoffPatternClassification): string | null {
  const durations = pattern.receiptFollowupEvidence
    .map(receiptFollowupDays)
    .filter((days): days is number => days != null && Number.isFinite(days));
  if (durations.length === 0) return null;

  const maxDays = Math.max(...durations);
  return `${maxDays} ${maxDays === 1 ? 'Tag' : 'Tage'}`;
}

function tradeoffReopenSourceTrendSummary(pattern: TradeoffPatternClassification): string | null {
  if (pattern.reopenSourceTrends.length === 0) return null;
  const trendLabel = tradeoffSourceTrendLabel(pattern.reopenSourceTrends);
  const drivers = unique(pattern.reopenSourceTrends.flatMap(trend => trend.evidence), 2);
  const driverDetail = drivers.length > 0 ? ` Treiber: ${drivers.join(' · ')}.` : '';
  if (pattern.resolvedReopenSourceTrends.length > 0) {
    return `Reopen-Quellentrend erneut aktiv: ${trendLabel}. Data vergleicht die frischen Quellen mit der bereits eingeordneten Wochenentscheidung.${driverDetail}`;
  }
  return `Reopen-Quellentrend: ${trendLabel}. Data buendelt frische Reopen-Gruende zu Lerntrends, statt einzelne alte Tageskonflikte neu zu starten.${driverDetail}`;
}

function tradeoffResolvedReopenSourceTrendSummary(pattern: TradeoffPatternClassification): string | null {
  const trendLabel = tradeoffSourceTrendLabel(pattern.resolvedReopenSourceTrends);
  if (!trendLabel) return null;
  const receipt = tradeoffReceiptEvidence(pattern);
  const followup = tradeoffReceiptFollowupEvidence(pattern);
  const trustDuration = tradeoffReceiptTrustDuration(pattern);
  const receiptDetail = receipt ? `Wochenreceipt: ${receipt}. ` : '';
  const trustDurationDetail = trustDuration ? `Wochenreceipt-Vertrauensdauer: ${trustDuration}. ` : '';
  const followupDetail = followup ? `${followup}. ` : '';
  if (receipt && followup) {
    return `Wochenreceipt-Lernvertrauen bestaetigt: ${trendLabel}. ${receiptDetail}${trustDurationDetail}${followupDetail}Data haelt ihn als Kontinuitaet ruhig, bis frische Heute- oder Wochen-Evidenz Home oder Plan erneut veraendert.`;
  }
  if (receipt) {
    return `Wochenreceipt-Lernvertrauen unaufgefrischt: ${trendLabel}. ${receiptDetail}Die Wochenentscheidung hat den Reopen-Quellentrend bereits eingeordnet, aber diese Folgewirkung ist noch nicht neu bestaetigt. Data behandelt ihn als ungebrochenen Watch-Kontext, bis frische Heute- oder Wochen-Evidenz Home oder Plan erneut veraendert.`;
  }

  return `${receiptDetail}Die Wochenentscheidung hat den Reopen-Quellentrend ${trendLabel} bereits eingeordnet. Das ist Lernvertrauen: Data haelt ihn als Kontinuitaet ruhig, bis frische Heute- oder Wochen-Evidenz Home oder Plan erneut veraendert.`;
}

function tradeoffResolvedReopenSourceTrendContext(pattern: TradeoffPatternClassification): string | null {
  const trendLabel = tradeoffSourceTrendLabel(pattern.resolvedReopenSourceTrends);
  if (!trendLabel) return null;
  const receipt = tradeoffReceiptEvidence(pattern);
  if (receipt) {
    return `Wochenreceipt-Lernvertrauen braucht Review: ${trendLabel}. Frische Folgewirkung schwaecht die Sicherheit; frische Quellen oeffnen Home oder Plan nur wegen neuer Heute- oder Wochenwirkung.`;
  }
  return `Wochenreceipt bleibt Lernvertrauen: ${trendLabel} war bereits eingeordnet; frische Quellen oeffnen Home oder Plan nur wegen neuer Heute- oder Wochenwirkung.`;
}

function tradeoffEvidence(pattern: TradeoffPatternClassification): string[] {
  const receipt = tradeoffReceiptEvidence(pattern);
  const trendLabel = tradeoffSourceTrendLabel(pattern.resolvedReopenSourceTrends);
  const followup = tradeoffReceiptFollowupEvidence(pattern);
  const trustDuration = tradeoffReceiptTrustDuration(pattern);
  const receiptConfidenceEvidence = receipt && trendLabel
    ? pattern.reopenSourceTrends.length > 0
      ? `Wochenreceipt-Folgewirkung geschwaecht: ${trendLabel}`
      : followup
        ? `Wochenreceipt-Folgewirkung bestaetigt: ${followup}`
        : null
    : null;
  return unique([
    ...pattern.reopenSourceTrends.map(trend => `Reopen-Trend ${trend.label} ${trend.count}x`),
    ...pattern.resolvedReopenSourceTrends.map(trend => `Reopen-Trend entschieden ${trend.label} ${trend.count}x`),
    receipt && trendLabel && !followup && pattern.reopenSourceTrends.length === 0 ? `Wochenreceipt-Vertrauen unaufgefrischt: ${trendLabel}` : null,
    trustDuration ? `Wochenreceipt-Vertrauensdauer: ${trustDuration}` : null,
    receiptConfidenceEvidence,
    receipt ? `Wochenreceipt: ${receipt}` : null,
    ...pattern.evidence,
  ], 6);
}

function primaryFromTradeoffPattern(decisionQuality: PulseDailyDecisionQualityResponse | null | undefined): AnalysisTranslationSignal | null {
  const pattern = classifyTradeoffPattern(decisionQuality);
  if (!pattern || !decisionQuality) return null;
  const effect: AnalysisDecisionEffect = pattern.effect;
  const hasSourceTrend = pattern.reopenSourceTrends.length > 0;
  let tone: AnalysisTranslationTone = qualityTone(decisionQuality.status);
  if (pattern.state === 'resolved') {
    tone = 'muted';
  } else if (effect === 'plan_decision') {
    tone = 'rose';
  } else if (effect === 'today_action') {
    tone = 'green';
  }

  if (effect === 'plan_decision') {
    return withEffect({
      label: 'Tradeoff-Muster',
      title: hasSourceTrend
        ? pattern.resolvedReopenSourceTrends.length > 0
          ? 'Reopen-Quellen werden erneut aktiv'
          : 'Reopen-Quellen werden Lerntrend'
        : 'Tageskonflikte werden Wochenentscheidung',
      summary: tradeoffReopenSummary(pattern, 'Wochen'),
      evidence: tradeoffEvidence(pattern),
      tone,
      actionLabel: 'Wochenentscheidung prüfen',
      targetPath: TRADEOFF_PLAN_DECISION_PATH,
      resultPreview: resultPreviewForTargetPath(TRADEOFF_PLAN_DECISION_PATH, 'plan_decision'),
    }, 'plan_decision');
  }

  if (effect === 'today_action') {
    return withEffect({
      label: 'Tradeoff-Muster',
      title: hasSourceTrend
        ? pattern.resolvedReopenSourceTrends.length > 0
          ? 'Reopen-Quellen werden erneut aktiv'
          : 'Reopen-Quellen werden Lerntrend'
        : 'Tageskonflikt verändert Heute',
      summary: tradeoffReopenSummary(pattern, 'Heute'),
      evidence: tradeoffEvidence(pattern),
      tone,
      actionLabel: 'Heute einordnen',
      targetPath: TRADEOFF_TODAY_PATH,
      resultPreview: resultPreviewForTargetPath(TRADEOFF_TODAY_PATH, 'today_action'),
    }, 'today_action');
  }

  if (pattern.state === 'resolved') {
    const resolvedSourceTrend = tradeoffResolvedReopenSourceTrendSummary(pattern);
    return withEffect({
      label: 'Tradeoff-Muster',
      title: resolvedSourceTrend ? 'Reopen-Quellentrend entschieden' : 'Tageskonflikt bereits eingeordnet',
      summary: resolvedSourceTrend
        ? `${resolvedSourceTrend} ${pattern.suggestedAdjustment}.`
        : `Bereits eingeordnet: ${pattern.count}x ${pattern.themeLabel}. ${pattern.suggestedAdjustment}. Data haelt das Muster ruhig, bis frische Evidenz die Handlung erneut veraendert.`,
      evidence: tradeoffEvidence(pattern),
      tone,
      actionLabel: 'Muster prüfen',
      targetPath: DECISION_QUALITY_PATH,
      resultPreview: resultPreviewForTargetPath(DECISION_QUALITY_PATH, 'watch_context'),
    }, 'watch_context');
  }

  const prefix = pattern.count >= 2 ? 'Noch nicht stark genug' : 'Ein einzelner Tageskonflikt';
  const sourceTrend = tradeoffReopenSourceTrendSummary(pattern);
  return withEffect({
    label: 'Tradeoff-Muster',
    title: hasSourceTrend ? 'Reopen-Quellen beobachten' : 'Tageskonflikt beobachten',
    summary: sourceTrend
      ? `${sourceTrend} ${prefix} fuer eine Planentscheidung oder neue Tageshandlung: ${pattern.suggestedAdjustment}.`
      : `${prefix} ist noch keine Planentscheidung und keine neue Tageshandlung: ${pattern.themeLabel}. ${pattern.suggestedAdjustment}.`,
    evidence: tradeoffEvidence(pattern),
    tone,
    actionLabel: 'Muster prüfen',
    targetPath: DECISION_QUALITY_PATH,
    resultPreview: resultPreviewForTargetPath(DECISION_QUALITY_PATH, 'watch_context'),
  }, 'watch_context');
}

function primaryFromPersonalResponse(personalResponse: PulsePersonalResponseResponse | null | undefined): AnalysisTranslationSignal | null {
  const signal = strongestPersonalResponseSignal(personalResponse);
  if (!signal) return null;
  const isFueling = signal.kind === 'fueling_response';
  return withEffect({
    label: isFueling ? 'Fueling-Lernschleife' : 'Reaktionsmodell',
    title: signal.label,
    summary: signal.nextAdjustment,
    evidence: unique(signal.evidence, 4),
    tone: signalTone(signal),
    actionLabel: isFueling ? 'Fueling-Evidenz prüfen' : 'Reaktionsmuster prüfen',
    targetPath: PERSONAL_RESPONSE_PATH,
    resultPreview: resultPreviewForTargetPath(PERSONAL_RESPONSE_PATH, 'today_action'),
  }, 'today_action');
}

function watchFromGoal(goalProjection: PulseGoalProjectionResponse | null | undefined): AnalysisTranslationSignal | null {
  const top = goalProjection?.projections[0] ?? null;
  const gap = top?.missingEvidence[0] ?? goalProjection?.missingEvidence[0] ?? null;
  if (!gap) return null;
  return withEffect({
    label: 'Evidenzlücke',
    title: 'Noch nicht trendfähig',
    summary: gap,
    evidence: unique([top?.limiterRisk.label, top?.limiterRisk.summary], 3),
    tone: 'amber',
    actionLabel: 'Zielevidenz prüfen',
    targetPath: GOAL_PROJECTION_PATH,
    resultPreview: resultPreviewForTargetPath(GOAL_PROJECTION_PATH, 'watch_context'),
  }, 'watch_context');
}

function watchFromTrainingAnalytics(trainingAnalytics: PulseTrainingAnalyticsResponse | null | undefined): AnalysisTranslationSignal | null {
  const quality = trainingAnalytics?.powerDataQuality ?? null;
  if (quality && quality.status !== 'trusted') {
    const effect: AnalysisDecisionEffect = quality.status === 'blocked' ? 'today_action' : 'watch_context';
    return withEffect({
      label: 'Analysequalität',
      title: quality.status === 'blocked' ? 'Power blockiert' : 'Power nur Hinweis',
      summary: quality.limitations[0] ?? 'Power-Analyse bleibt begrenzt, bis belastbare Stream-Daten vorhanden sind.',
      evidence: unique([`${quality.coveragePct}% Coverage`, `${quality.spikeCount} Spikes`], 3),
      tone: quality.status === 'blocked' ? 'rose' : 'amber',
      actionLabel: 'Power-Daten prüfen',
      targetPath: POWER_QUALITY_PATH,
      resultPreview: resultPreviewForTargetPath(POWER_QUALITY_PATH, effect),
    }, effect);
  }
  const durability = trainingAnalytics?.powerDuration?.durability ?? null;
  if (durability && durability.rating !== 'strong') {
    return withEffect({
      label: 'Durability',
      title: 'Durability beobachten',
      summary: trainingAnalytics?.powerDuration?.durabilityLine ?? 'Durability ist interessant, aber noch kein primärer Tageshebel.',
      evidence: unique(durability.evidence, 3),
      tone: durability.rating === 'limited' ? 'rose' : 'amber',
      actionLabel: 'Durability prüfen',
      targetPath: POWER_DURATION_PATH,
      resultPreview: resultPreviewForTargetPath(POWER_DURATION_PATH, 'watch_context'),
    }, 'watch_context');
  }
  return null;
}

function watchFromPersonalResponse(personalResponse: PulsePersonalResponseResponse | null | undefined): AnalysisTranslationSignal | null {
  const missing = personalResponse?.summary.missingEvidence[0] ?? null;
  if (missing) {
    return withEffect({
      label: 'Reaktionsmodell',
      title: 'Lernsignal offen',
      summary: missing,
      evidence: [],
      tone: 'muted',
      actionLabel: 'Reaktionsmuster prüfen',
      targetPath: PERSONAL_RESPONSE_PATH,
      resultPreview: resultPreviewForTargetPath(PERSONAL_RESPONSE_PATH, 'today_action'),
    }, 'today_action');
  }
  const insufficient = personalResponse?.summary.signals.find(signal => signal.strength === 'insufficient') ?? null;
  if (!insufficient) return null;
  return withEffect({
    label: 'Reaktionsmodell',
    title: insufficient.label,
    summary: insufficient.summary,
    evidence: unique(insufficient.evidence, 3),
    tone: 'muted',
    actionLabel: 'Reaktionsmuster prüfen',
    targetPath: PERSONAL_RESPONSE_PATH,
    resultPreview: resultPreviewForTargetPath(PERSONAL_RESPONSE_PATH, 'today_action'),
  }, 'today_action');
}

export function buildAnalysisTranslation({
  decisionQuality,
  fuelingOutcomeBaseline,
  goalProjection,
  personalResponse,
  planTrace,
  trainingAnalytics,
}: Input): AnalysisTranslation {
  const primary = primaryFromGoal(goalProjection)
    ?? primaryFromPlanTrace(planTrace)
    ?? primaryFromTradeoffPattern(decisionQuality)
    ?? primaryFromDecisionQuality(decisionQuality)
    ?? primaryFromPersonalResponse(personalResponse)
    ?? withEffect({
      label: 'Analyse',
      title: 'Evidenz wird gesammelt',
      summary: 'Noch kein tiefes Signal ist stark genug, um die Tagesentscheidung zu verändern.',
      evidence: [],
      tone: 'muted' as const,
    }, 'watch_context');

  const watch = watchFromGoal(goalProjection)
    ?? watchFromTrainingAnalytics(trainingAnalytics)
    ?? watchFromPersonalResponse(personalResponse)
    ?? withEffect({
      label: 'Beobachtung',
      title: 'Kein Nebenhebel offen',
      summary: 'Die aktuellen Analyse-Signale sind entweder bereits in der Handlung enthalten oder noch nicht geladen.',
      evidence: [],
      tone: 'muted' as const,
    }, 'watch_context');
  const trainingRisk = buildTrainingRiskContract(planTrace, trainingAnalytics);
  const decisionQualityForGenericLearning = classifyTradeoffPattern(decisionQuality) ? null : decisionQuality;
  const calibration = buildLearningCalibration(decisionQualityForGenericLearning, personalResponse, fuelingOutcomeBaseline);
  const learning = withEffect({
    label: calibration.label,
    title: calibration.title,
    summary: calibration.summary,
    evidence: calibration.evidence,
    tone: calibration.tone,
    actionLabel: calibration.actionLabel,
    targetPath: calibration.targetPath,
    resultPreview: calibration.resultPreview,
  }, calibration.effect);

  return {
    trainingRisk,
    learning,
    primary,
    watch,
    supportEvidence: unique([
      ...trainingRisk.evidence,
      ...learning.evidence,
      ...primary.evidence,
      ...watch.evidence,
      decisionQuality?.bestEvidence[0],
      personalResponse?.summary.headline,
      goalProjection?.headline,
    ], 3),
  };
}
