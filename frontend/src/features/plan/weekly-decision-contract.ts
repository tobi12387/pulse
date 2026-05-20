import type {
  PulseAdaptationEvent,
  PulseDailyDecisionQualityResponse,
  PulseFitnessLoad,
  PulseFuelingOutcomeBaseline,
  PulseGoalProjection,
  PulseGoalProjectionResponse,
  PulsePersonalResponseResponse,
  PulsePlanRefreshPreview,
  PulsePlannedWorkout,
  PulseWeeklyReview,
} from '@coaching-os/shared/pulse';
import { buildLearningCalibration, type LearningCalibrationSignal } from '../../pulse/learning-calibration';
import { classifyTradeoffPattern, type TradeoffReopenSourceTrend } from '../../pulse/tradeoff-patterns';
import { buildPlanChangeInbox } from './change-inbox-model';

export type PlanWeeklyDecisionTone = 'attention' | 'watch' | 'ok';
export type PlanWeeklyDecisionSectionId = 'learned' | 'changed' | 'risk' | 'next_action';
export type PlanWeeklyDecisionOptionKind = 'accept_current' | 'adapt_week' | 'defer_decision';

export interface PlanWeeklyDecisionSection {
  id: PlanWeeklyDecisionSectionId;
  label: string;
  title: string;
  body: string;
  evidence: string[];
}

export interface PlanWeeklyDecisionOption {
  kind: PlanWeeklyDecisionOptionKind;
  label: string;
  title: string;
  weekImpact: string;
  resultPreview: string;
  readOnly: boolean;
  targetPath: string | null;
}

export interface PlanWeeklyDecisionContract {
  tone: PlanWeeklyDecisionTone;
  title: string;
  summary: string;
  sections: PlanWeeklyDecisionSection[];
  options: PlanWeeklyDecisionOption[];
  primaryOption: PlanWeeklyDecisionOptionKind;
  evidence: string[];
}

export interface PlanWeeklyDecisionReceipt {
  contractSignature: string;
  optionKind: PlanWeeklyDecisionOptionKind;
  optionLabel: string;
  title: string;
  decision: string;
  weekImpact: string;
  nextConsequence: string;
  mutationBoundary: string;
  targetPath: string | null;
  createdAt: string;
  evidence?: string[];
}

export interface PlanWeeklyDecisionContractInput {
  today: string;
  workouts: PulsePlannedWorkout[];
  adaptationEvents: PulseAdaptationEvent[];
  refreshPreview: PulsePlanRefreshPreview | null;
  currentLoad: PulseFitnessLoad | null;
  goalProjection: PulseGoalProjectionResponse | null;
  personalResponse: PulsePersonalResponseResponse | null;
  decisionQuality?: PulseDailyDecisionQualityResponse | null;
  fuelingOutcomeBaseline?: PulseFuelingOutcomeBaseline | null;
  review: PulseWeeklyReview | null;
}

function hasRefreshSignal(preview: PulsePlanRefreshPreview | null): preview is PulsePlanRefreshPreview {
  return !!preview && (preview.stale || preview.triggers.length > 0 || preview.comparisons.length > 0);
}

function sign(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function firstUsefulSignal(response: PulsePersonalResponseResponse | null): string | null {
  const summary = response?.summary;
  if (!summary) return null;
  const useful = summary.signals.find(signal => signal.strength !== 'insufficient') ?? summary.signals[0] ?? null;
  return useful ? `${useful.label}: ${useful.nextAdjustment}` : summary.headline;
}

function learningCalibrationContext(input: PlanWeeklyDecisionContractInput): {
  calibration: LearningCalibrationSignal;
  hasDecision: boolean;
  hasWatch: boolean;
  title: string;
  body: string;
  evidence: string[];
} | null {
  const calibration = buildLearningCalibration(
    input.decisionQuality ?? null,
    input.personalResponse,
    input.fuelingOutcomeBaseline ?? null,
  );

  if (calibration.effect === 'watch_context' && calibration.evidence.length === 0) return null;

  const evidence = calibration.evidence.slice(0, 3);
  const personalWatchLine = input.personalResponse?.summary.signals.find(signal => signal.strength !== 'insufficient');
  if (calibration.effect === 'today_action') {
    return {
      calibration,
      hasDecision: true,
      hasWatch: false,
      title: 'Lernkalibrierung entscheidet mit',
      body: `${calibration.summary} Plan und Garmin bleiben unverändert; Beibehalten, Anpassen oder Spaeter sind explizite Wochenentscheidungen.`,
      evidence,
    };
  }

  return {
    calibration,
    hasDecision: false,
    hasWatch: true,
    title: 'Lernkalibrierung bleibt Watch-Kontext',
    body: `${personalWatchLine ? `${personalWatchLine.label}: ${personalWatchLine.nextAdjustment}. ` : ''}${calibration.summary} Daraus keine Wochenaenderung ableiten, bis das Evidenzgate geschlossen ist.`,
    evidence,
  };
}

type TradeoffDecisionContext = {
  count: number;
  hasDecision: boolean;
  hasWatch: boolean;
  hasHandledReceipt: boolean;
  hasFreshEvidence: boolean;
  sourceTrendLabel: string | null;
  resolvedSourceTrendLabel: string | null;
  title: string;
  body: string;
  evidence: string[];
  suggestedAdjustment: string;
  freshSourceLabel: string | null;
  freshEvidenceSummary: string | null;
  handledEvidenceSummary: string | null;
  receiptSummary: string | null;
  receiptFollowupSummary: string | null;
  receiptTrustDuration: string | null;
  receiptRenewalCheck: string | null;
  adaptTargetLabel: string;
  adaptTargetPath: string;
};

function unique(items: string[]): string[] {
  return items.filter((item, index) => items.indexOf(item) === index);
}

function germanList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} und ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} und ${items[items.length - 1]}`;
}

function withoutTrailingPeriod(value: string): string {
  return value.trim().replace(/[.\s]+$/u, '');
}

function cleanFreshTradeoffEvidence(value: string): string {
  return withoutTrailingPeriod(value)
    .replace(/^Neue Evidenz seit gemerkter Wochenentscheidung:\s*/iu, '')
    .replace(/^Neue Evidenz:\s*/iu, '')
    .trim();
}

function tradeoffFreshEvidenceSummary(pattern: NonNullable<ReturnType<typeof classifyTradeoffPattern>>): string | null {
  const fresh = pattern.freshEvidence
    .map(cleanFreshTradeoffEvidence)
    .filter(item => item.length > 0
      && !/^Tageskonflikt mit neuer Wochenwirkung$/iu.test(item)
      && (pattern.reopenSourceTrends.length === 0 || !/wiederholter reopen-grund|reopen-grund|reopen-source|quellentrend/i.test(item)));
  return fresh.length > 0 ? fresh.join(' · ') : null;
}

function tradeoffHandledEvidenceSummary(pattern: NonNullable<ReturnType<typeof classifyTradeoffPattern>>): string | null {
  const handled = pattern.resolvedEvidence.map(withoutTrailingPeriod).filter(Boolean);
  return handled.length > 0 ? handled.join(' · ') : null;
}

function tradeoffReceiptEvidence(pattern: NonNullable<ReturnType<typeof classifyTradeoffPattern>>): string | null {
  return pattern.resolvedEvidence.find(item => /plan-receipt/i.test(item))
    ?? pattern.resolvedEvidence.find(item => /wochenentscheidung gemerkt/i.test(item))
    ?? null;
}

function tradeoffWeeklyReceiptSummary(pattern: NonNullable<ReturnType<typeof classifyTradeoffPattern>>): string | null {
  const receipt = tradeoffReceiptEvidence(pattern);
  if (!receipt) return null;

  const clean = withoutTrailingPeriod(receipt);
  if (/^plan-receipt:/iu.test(clean)) return clean;
  return clean.replace(/^wochenentscheidung gemerkt:\s*/iu, '');
}

function receiptFollowupDays(value: string): number | null {
  const days = value.match(/\b(\d+)\s*Tage?\b/iu)?.[1] ?? null;
  if (days) return Number.parseInt(days, 10);

  const weeks = value.match(/\b(\d+)\s*Wochen?\b/iu)?.[1] ?? null;
  return weeks ? Number.parseInt(weeks, 10) * 7 : null;
}

function tradeoffReceiptFollowupEvidence(pattern: NonNullable<ReturnType<typeof classifyTradeoffPattern>>): string[] {
  return pattern.receiptFollowupEvidence.filter(item => !/wochenreceipt-erneuerungscheck/i.test(item));
}

function tradeoffReceiptFollowupSummary(pattern: NonNullable<ReturnType<typeof classifyTradeoffPattern>>): string | null {
  const followupEvidence = tradeoffReceiptFollowupEvidence(pattern);
  const [first] = followupEvidence;
  if (!first) return null;

  return withoutTrailingPeriod(followupEvidence.reduce((selected, evidence) => {
    const selectedDays = receiptFollowupDays(selected) ?? -1;
    const evidenceDays = receiptFollowupDays(evidence) ?? -1;
    return evidenceDays > selectedDays ? evidence : selected;
  }, first));
}

function tradeoffReceiptTrustDuration(pattern: NonNullable<ReturnType<typeof classifyTradeoffPattern>>): string | null {
  const durations = tradeoffReceiptFollowupEvidence(pattern)
    .map(receiptFollowupDays)
    .filter((days): days is number => days != null && Number.isFinite(days));
  if (durations.length === 0) return null;

  const maxDays = Math.max(...durations);
  return `${maxDays} ${maxDays === 1 ? 'Tag' : 'Tage'}`;
}

function tradeoffReceiptRenewalCheck(
  pattern: NonNullable<ReturnType<typeof classifyTradeoffPattern>>,
  resolvedSourceTrendLabel: string | null,
): string | null {
  const receiptSummary = tradeoffWeeklyReceiptSummary(pattern);
  if (!receiptSummary || !resolvedSourceTrendLabel || pattern.hasFreshEvidence || pattern.reopenSourceTrends.length > 0) return null;

  const followup = tradeoffReceiptFollowupSummary(pattern);
  if (followup) {
    return `Wochenreceipt-Erneuerungscheck: ${resolvedSourceTrendLabel} bleibt bestaetigt, solange weiter keine erneute Reopen-Quelle auftaucht`;
  }

  return `Wochenreceipt-Erneuerungscheck offen: ${resolvedSourceTrendLabel} - naechste Heute- oder Wochen-Evidenz ohne erneute Reopen-Quelle bestaetigt das Vertrauen neu`;
}

function tradeoffFreshSourceLabel(
  pattern: NonNullable<ReturnType<typeof classifyTradeoffPattern>>,
): string | null {
  const corpus = [
    ...pattern.freshEvidence,
  ].join(' ');
  const sources: string[] = [];

  if (/ziel|goal|race|kraichgau|70\.3|wahrscheinlichkeit|limiter|long[-\s]?endurance/i.test(corpus)) {
    sources.push('Zielrisiko');
  }
  if (/planlast|wochenlast|trainingslast|load|tss|umfang/i.test(corpus)) {
    sources.push('Planlast');
  }
  if (/recovery|erholung|readiness|tsb|hrv|schlaf/i.test(corpus)) {
    sources.push('Recovery');
  }
  if (/garmin|ausfuehrung|ausführung|sync|handoff|uhr|edge/i.test(corpus)) {
    sources.push('Garmin-Ausfuehrung');
  }

  return sources.length > 0 ? germanList(unique(sources)) : null;
}

function sourceTrendLabel(trends: TradeoffReopenSourceTrend[]): string | null {
  if (trends.length === 0) return null;
  return germanList(trends.map(trend => `${trend.label} ${trend.count}x`));
}

function tradeoffSourceTrendLabel(pattern: NonNullable<ReturnType<typeof classifyTradeoffPattern>>): string | null {
  return sourceTrendLabel(pattern.reopenSourceTrends);
}

function tradeoffResolvedSourceTrendLabel(pattern: NonNullable<ReturnType<typeof classifyTradeoffPattern>>): string | null {
  return sourceTrendLabel(pattern.resolvedReopenSourceTrends);
}

function tradeoffEvidence(pattern: NonNullable<ReturnType<typeof classifyTradeoffPattern>>): string[] {
  const receiptSummary = tradeoffWeeklyReceiptSummary(pattern);
  return unique([
    ...pattern.reopenSourceTrends.map(trend => `Reopen-Trend ${trend.label} ${trend.count}x`),
    ...pattern.resolvedReopenSourceTrends.map(trend => `Reopen-Trend entschieden ${trend.label} ${trend.count}x`),
    receiptSummary ? `Wochenreceipt: ${receiptSummary}` : null,
    ...pattern.evidence,
  ].filter((item): item is string => item != null));
}

function tradeoffAdaptTarget(input: PlanWeeklyDecisionContractInput): Pick<TradeoffDecisionContext, 'adaptTargetLabel' | 'adaptTargetPath'> {
  return hasRefreshSignal(input.refreshPreview)
    ? { adaptTargetLabel: 'Refresh-Vorschau', adaptTargetPath: '#plan-refresh-preview-card' }
    : { adaptTargetLabel: 'Szenario-Vorschau', adaptTargetPath: '#plan-scenario-preview' };
}

function tradeoffDecisionContext(input: PlanWeeklyDecisionContractInput): TradeoffDecisionContext | null {
  const pattern = classifyTradeoffPattern(input.decisionQuality);
  if (!pattern) return null;
  const evidenceHint = pattern.evidence.slice(1, 4).join(' ');
  const sourceTrendLabel = tradeoffSourceTrendLabel(pattern);
  const resolvedSourceTrendLabel = tradeoffResolvedSourceTrendLabel(pattern);
  const freshSourceLabel = pattern.hasFreshEvidence ? tradeoffFreshSourceLabel(pattern) : null;
  const freshEvidenceSummary = pattern.hasFreshEvidence ? tradeoffFreshEvidenceSummary(pattern) : null;
  const handledEvidenceSummary = pattern.hasFreshEvidence ? tradeoffHandledEvidenceSummary(pattern) : null;
  const receiptSummary = tradeoffWeeklyReceiptSummary(pattern);
  const receiptFollowupSummary = tradeoffReceiptFollowupSummary(pattern);
  const receiptTrustDuration = tradeoffReceiptTrustDuration(pattern);
  const receiptRenewalCheck = tradeoffReceiptRenewalCheck(pattern, resolvedSourceTrendLabel);
  const evidence = tradeoffEvidence(pattern);
  const adaptTarget = tradeoffAdaptTarget(input);

  if (pattern.effect === 'plan_decision') {
    const evidencePrefix = sourceTrendLabel
      ? `Reopen-Quellentrend: ${sourceTrendLabel}`
      : freshSourceLabel
        ? `Frische Wochen-Evidenz aus ${freshSourceLabel}`
        : pattern.hasFreshEvidence
          ? 'Frische Wochen-Evidenz'
          : 'Wiederholter Tageskonflikt';
    const freshDetail = !sourceTrendLabel && freshEvidenceSummary ? `${freshEvidenceSummary}. ` : '';
    const trendDetail = sourceTrendLabel
      ? 'Data hat die wiederholten Quellen gebuendelt; Plan prueft nur, ob daraus eine Wochenwahl entsteht. '
      : '';
    const handledDetail = resolvedSourceTrendLabel
      ? receiptSummary
        ? `Wochenreceipt-Lernvertrauen braucht Review: ${resolvedSourceTrendLabel}. `
        : `Geschlossener Reopen-Quellentrend bleibt Kontext: ${resolvedSourceTrendLabel}. `
      : handledEvidenceSummary ? `Aeltere Receipt-Evidenz bleibt Kontext: ${handledEvidenceSummary}. ` : '';
    return {
      count: pattern.count,
      hasDecision: true,
      hasWatch: false,
      hasHandledReceipt: false,
      hasFreshEvidence: pattern.hasFreshEvidence,
      sourceTrendLabel,
      resolvedSourceTrendLabel,
      title: sourceTrendLabel ? 'Reopen-Quellentrend verändert die Woche' : 'Tageskonflikte verändern die Woche',
      body: sourceTrendLabel
        ? `${evidencePrefix}. ${trendDetail}${handledDetail}${pattern.count}x ${pattern.themeLabel}. ${pattern.suggestedAdjustment}. Plan und Garmin bleiben unverändert; Beibehalten, Anpassen oder Spaeter sind explizite Wochenentscheidungen.`
        : `${evidencePrefix}: ${freshDetail}${handledDetail}${pattern.hasFreshEvidence ? '' : evidenceHint ? `${evidenceHint}. ` : ''}${pattern.count}x ${pattern.themeLabel}. ${pattern.suggestedAdjustment}. Plan und Garmin bleiben unverändert; Beibehalten, Anpassen oder Spaeter sind explizite Wochenentscheidungen.`,
      evidence,
      suggestedAdjustment: pattern.suggestedAdjustment,
      freshSourceLabel,
      freshEvidenceSummary,
      handledEvidenceSummary,
      receiptSummary,
      receiptFollowupSummary,
      receiptTrustDuration,
      receiptRenewalCheck,
      ...adaptTarget,
    };
  }

  if (pattern.effect === 'today_action') {
    return {
      count: pattern.count,
      hasDecision: false,
      hasWatch: true,
      hasHandledReceipt: false,
      hasFreshEvidence: pattern.hasFreshEvidence,
      sourceTrendLabel,
      resolvedSourceTrendLabel,
      title: sourceTrendLabel ? 'Reopen-Quellentrend bleibt Heute-Kontext' : 'Tageskonflikt bleibt Heute-Kontext',
      body: sourceTrendLabel
        ? `Reopen-Quellentrend: ${sourceTrendLabel}. Der Trend veraendert heute die sichere Option, nicht die Woche: ${pattern.suggestedAdjustment}. Das ist keine Wochenentscheidung, bis neue Wochen-Evidenz Plan oder Garmin betrifft.`
        : `Heute veraendert der wiederholte Tageskonflikt die sichere Option, nicht die Woche: ${pattern.count}x ${pattern.themeLabel}. ${pattern.suggestedAdjustment}. Das ist keine Wochenentscheidung, bis neue Wochen-Evidenz Plan oder Garmin betrifft.`,
      evidence,
      suggestedAdjustment: pattern.suggestedAdjustment,
      freshSourceLabel,
      freshEvidenceSummary,
      handledEvidenceSummary,
      receiptSummary,
      receiptFollowupSummary,
      receiptTrustDuration,
      receiptRenewalCheck,
      ...adaptTarget,
    };
  }

  if (pattern.state === 'resolved') {
    if (resolvedSourceTrendLabel) {
      return {
        count: pattern.count,
        hasDecision: false,
        hasWatch: true,
        hasHandledReceipt: true,
        hasFreshEvidence: false,
        sourceTrendLabel,
        resolvedSourceTrendLabel,
        title: receiptSummary && receiptFollowupSummary
          ? 'Wochenreceipt-Lernvertrauen bestaetigt Beibehalten'
          : receiptSummary
          ? 'Wochenreceipt-Lernvertrauen unaufgefrischt Beibehalten'
          : 'Reopen-Quellentrend-Receipt bleibt ruhig',
        body: receiptSummary
          ? receiptFollowupSummary
            ? `Wochenreceipt-Lernvertrauen bestaetigt: ${resolvedSourceTrendLabel}. Wochenreceipt: ${receiptSummary}. ${receiptTrustDuration ? `Wochenreceipt-Vertrauensdauer: ${receiptTrustDuration}. ` : ''}${receiptFollowupSummary}. ${receiptRenewalCheck ? `${receiptRenewalCheck}. ` : ''}${pattern.suggestedAdjustment}. Plan bleibt bei Beibehalten; Anpassen oeffnet erst wieder, wenn frische Wochen-Evidenz aus Plan, Recovery oder Garmin die Woche veraendert.`
            : `Wochenreceipt-Lernvertrauen unaufgefrischt: ${resolvedSourceTrendLabel}. Wochenreceipt: ${receiptSummary}. Die Folgewirkung ist noch nicht neu bestaetigt. ${receiptRenewalCheck ? `${receiptRenewalCheck}. ` : ''}${pattern.suggestedAdjustment}. Plan bleibt bei Beibehalten; Anpassen oeffnet erst wieder, wenn frische Wochen-Evidenz aus Plan, Recovery oder Garmin die Woche veraendert.`
          : `Geschlossener Reopen-Quellentrend: ${resolvedSourceTrendLabel}. Die Wochenentscheidung hat diesen Trend bereits eingeordnet; ${pattern.suggestedAdjustment}. Plan bleibt bei Beibehalten; Anpassen oeffnet erst wieder, wenn frische Wochen-Evidenz aus Plan, Recovery oder Garmin die Woche veraendert.`,
        evidence,
        suggestedAdjustment: pattern.suggestedAdjustment,
        freshSourceLabel,
        freshEvidenceSummary,
        handledEvidenceSummary,
        receiptSummary,
        receiptFollowupSummary,
        receiptTrustDuration,
        receiptRenewalCheck,
        ...adaptTarget,
      };
    }

    return {
      count: pattern.count,
      hasDecision: false,
      hasWatch: true,
      hasHandledReceipt: true,
      hasFreshEvidence: false,
      sourceTrendLabel,
      resolvedSourceTrendLabel,
      title: 'Tageskonflikt-Receipt bleibt ruhig',
      body: `Erledigter Tageskonflikt: ${pattern.count}x ${pattern.themeLabel}. ${evidenceHint ? `${evidenceHint}. ` : ''}${pattern.suggestedAdjustment}. Plan bleibt bei Beibehalten; Anpassen oeffnet erst wieder, wenn frische Wochen-Evidenz aus Plan, Recovery oder Garmin die Woche veraendert.`,
      evidence,
      suggestedAdjustment: pattern.suggestedAdjustment,
      freshSourceLabel,
      freshEvidenceSummary,
      handledEvidenceSummary,
      receiptSummary,
      receiptFollowupSummary,
      receiptTrustDuration,
      receiptRenewalCheck,
      ...adaptTarget,
    };
  }

  const prefix = pattern.count >= 2
    ? 'Noch nicht stark genug fuer eine Wochenaenderung'
    : 'Ein einzelner Tageskonflikt ist keine Wochenaenderung';

  return {
    count: pattern.count,
    hasDecision: false,
    hasWatch: true,
    hasHandledReceipt: false,
    hasFreshEvidence: pattern.hasFreshEvidence,
    sourceTrendLabel,
    resolvedSourceTrendLabel,
    title: sourceTrendLabel ? 'Reopen-Quellentrend bleibt Watch-Kontext' : 'Tageskonflikt bleibt Watch-Kontext',
    body: sourceTrendLabel
      ? `Reopen-Quellentrend: ${sourceTrendLabel}. Der Trend ist noch keine Wochenaenderung: ${pattern.suggestedAdjustment}. Plan bleibt bei Beibehalten, bis der Trend echte Wochenwirkung bekommt.`
      : `${prefix}: ${pattern.themeLabel}. ${pattern.suggestedAdjustment}. Pulse wartet auf frische Wochen-Evidenz, bevor Plan oder Garmin zur Entscheidung werden.`,
    evidence,
    suggestedAdjustment: pattern.suggestedAdjustment,
    freshSourceLabel,
    freshEvidenceSummary,
    handledEvidenceSummary,
    receiptSummary,
    receiptFollowupSummary,
    receiptTrustDuration,
    receiptRenewalCheck,
    ...adaptTarget,
  };
}

function reviewRecommendation(review: PulseWeeklyReview | null): string | null {
  return review?.recommendations.find(item => item.trim().length > 0)?.trim() ?? null;
}

function topGoalProjection(response: PulseGoalProjectionResponse | null): PulseGoalProjection | null {
  return response?.projections.find(projection => projection.status === 'at_risk')
    ?? response?.projections.find(projection => projection.status === 'watch')
    ?? response?.projections[0]
    ?? null;
}

function goalRiskLine(projection: PulseGoalProjection | null): string | null {
  if (!projection || (projection.status !== 'watch' && projection.status !== 'at_risk')) return null;
  const probability = projection.probabilityPct != null ? ` (${projection.probabilityPct}% Zielwahrscheinlichkeit)` : '';
  return `${projection.title}${probability}: ${projection.nextBestIntervention.summary}`;
}

function recoveryRiskLine(load: PulseFitnessLoad | null): string | null {
  if (!load) return null;
  if (load.tsb <= -20) return `Recovery: TSB ${Math.round(load.tsb)} - erst Entlastung pruefen.`;
  if (load.tsb <= -10) return `Recovery: TSB ${Math.round(load.tsb)} beobachten.`;
  return null;
}

function explicitRecoveryEventLine(events: PulseAdaptationEvent[]): string | null {
  const event = events.find(item => item.kind === 'recovery_risk' || item.recommendation === 'protect_recovery');
  return event?.summary ?? null;
}

function changedBody(input: PlanWeeklyDecisionContractInput, tradeoffContext: TradeoffDecisionContext | null): string {
  if (hasRefreshSignal(input.refreshPreview)) return input.refreshPreview.summary;
  const inbox = buildPlanChangeInbox({
    today: input.today,
    workouts: input.workouts,
    adaptationEvents: input.adaptationEvents,
    refreshPreview: input.refreshPreview,
  });
  const first = inbox.items.find(item => item.id.startsWith('adaptation-')) ?? inbox.items[0] ?? null;
  if (!first && tradeoffContext?.hasDecision) {
    if (tradeoffContext.sourceTrendLabel) {
      return `Reopen-Quellentrend: ${tradeoffContext.sourceTrendLabel} oeffnet die Wochenentscheidung als Kontext: ${tradeoffContext.suggestedAdjustment}.`;
    }
    if (tradeoffContext.hasFreshEvidence) {
      const source = tradeoffContext.freshSourceLabel
        ? `Frische Wochen-Evidenz aus ${tradeoffContext.freshSourceLabel}`
        : 'Frische Wochen-Evidenz';
      const fresh = tradeoffContext.freshEvidenceSummary ? `${tradeoffContext.freshEvidenceSummary}. ` : '';
      return `${source} oeffnet die erledigte Tageskonflikt-Entscheidung erneut: ${fresh}${tradeoffContext.suggestedAdjustment}.`;
    }
    return `Wiederholte Tageskonflikte verlangen eine bewusste Wochenentscheidung: ${tradeoffContext.suggestedAdjustment}.`;
  }
  return first?.summary
    ?? reviewRecommendation(input.review)
    ?? 'Keine offene Planaenderung; Woche, Garmin-Handoff und Adaptionssignale wirken aktuell geschlossen.';
}

function riskBody(input: PlanWeeklyDecisionContractInput): { body: string; evidence: string[]; hasAttention: boolean; hasWatch: boolean } {
  const inbox = buildPlanChangeInbox({
    today: input.today,
    workouts: input.workouts,
    adaptationEvents: input.adaptationEvents,
    refreshPreview: input.refreshPreview,
  });
  const garminDebt = inbox.items.find(item => item.id === 'garmin-sync-debt') ?? null;
  const goal = topGoalProjection(input.goalProjection);
  const lines = [
    recoveryRiskLine(input.currentLoad),
    explicitRecoveryEventLine(input.adaptationEvents),
    goalRiskLine(goal),
    garminDebt ? `Garmin: ${garminDebt.summary}` : null,
  ].filter((item): item is string => item != null);

  const hasAttention = (input.currentLoad?.tsb ?? 0) <= -20
    || goal?.status === 'at_risk'
    || input.adaptationEvents.some(event => event.severity === 'action');
  const hasWatch = lines.length > 0;

  return {
    body: lines.length > 0
      ? lines.join(' ')
      : 'Risiko aktuell ruhig: keine starke Recovery-, Ziel- oder Garmin-Gegenanzeige.',
    evidence: [
      input.currentLoad ? `CTL ${Math.round(input.currentLoad.ctl)} / ATL ${Math.round(input.currentLoad.atl)} / TSB ${Math.round(input.currentLoad.tsb)}` : null,
      goal ? `Ziel: ${goal.title}` : null,
      garminDebt ? garminDebt.evidence.join(' · ') : null,
    ].filter((item): item is string => item != null && item.length > 0),
    hasAttention,
    hasWatch,
  };
}

function buildOptions(
  input: PlanWeeklyDecisionContractInput,
  hasOpenChange: boolean,
  tradeoffContext: TradeoffDecisionContext | null,
): PlanWeeklyDecisionOption[] {
  const preview = hasRefreshSignal(input.refreshPreview) ? input.refreshPreview : null;
  const hasTradeoffDecision = Boolean(tradeoffContext?.hasDecision);
  const impact = preview
    ? `Vorschau: TSS ${sign(preview.loadImpact.tssDelta)}, Dauer ${sign(preview.loadImpact.durationDeltaMin)} min; ${preview.garminImpact.summary}`
    : hasTradeoffDecision
      ? tradeoffContext!.sourceTrendLabel
        ? `Vorschau: Reopen-Quellentrend: ${tradeoffContext!.sourceTrendLabel} in der ${tradeoffContext!.adaptTargetLabel} pruefen; ${tradeoffContext!.suggestedAdjustment}.`
        : tradeoffContext!.hasFreshEvidence
        ? `Vorschau: ${tradeoffContext!.freshSourceLabel ? `Frische Wochen-Evidenz aus ${tradeoffContext!.freshSourceLabel}` : 'Frische Wochen-Evidenz'} in der ${tradeoffContext!.adaptTargetLabel} pruefen; ${tradeoffContext!.suggestedAdjustment}.`
        : `Vorschau: wiederholte Tageskonflikte in eine Wochenentscheidung uebersetzen; ${tradeoffContext!.suggestedAdjustment}.`
    : 'Vorschau: Woche bleibt strukturell unveraendert, bis ein Szenario geoeffnet wird.';
  return [
    {
      kind: 'accept_current',
      label: 'Beibehalten',
      title: hasOpenChange ? 'Aktuelle Woche bewusst akzeptieren' : 'Aktuelle Woche weiterfahren',
      weekImpact: hasOpenChange
        ? hasTradeoffDecision
          ? tradeoffContext?.sourceTrendLabel
            ? 'Aktuelle Planlast bleibt trotz Reopen-Quellentrend bestehen; offene Vorschlaege werden nicht angewendet.'
            : 'Aktuelle Planlast bleibt trotz wiederholter Tageskonflikte bestehen; offene Vorschlaege werden nicht angewendet.'
          : 'Aktuelle Planlast bleibt bestehen; offene Vorschlaege werden nicht angewendet.'
        : 'Woche bleibt wie geplant; keine neue Aenderung noetig.',
      resultPreview: 'Du bestaetigst die Richtung nur in dieser Ansicht; keine Plan- oder Garmin-Aenderung passiert hier.',
      readOnly: true,
      targetPath: null,
    },
    {
      kind: 'adapt_week',
      label: 'Anpassen',
      title: 'Wochenvorschau pruefen',
      weekImpact: impact,
      resultPreview: 'Pulse oeffnet die Vorschau; erst ein explizites Anwenden schreibt in Plan oder Garmin.',
      readOnly: true,
      targetPath: preview ? '#plan-refresh-preview-card' : tradeoffContext?.adaptTargetPath ?? '#plan-scenario-preview',
    },
    {
      kind: 'defer_decision',
      label: 'Spaeter',
      title: 'Entscheidung bewusst vertagen',
      weekImpact: hasOpenChange
        ? hasTradeoffDecision
          ? 'Die Woche bleibt vorerst wie geplant; Tradeoff-Evidenz bleibt Watch-Kontext bis zur bewussten Wochenvorschau.'
          : 'Die Woche bleibt vorerst wie geplant; das offene Signal bleibt Watch-Kontext.'
        : 'Keine Wochenlast-Aenderung; Pulse beobachtet weiter.',
      resultPreview: 'Du verschiebst nur die Entscheidung in dieser Ansicht; keine Plan- oder Garmin-Aenderung passiert hier.',
      readOnly: true,
      targetPath: null,
    },
  ];
}

export function planWeeklyDecisionContractSignature(contract: PlanWeeklyDecisionContract): string {
  return [
    contract.title,
    contract.summary,
    contract.primaryOption,
    contract.evidence.join('|'),
    contract.sections.map(section => `${section.id}:${section.title}:${section.body}`).join('|'),
    contract.options.map(option => `${option.kind}:${option.title}:${option.weekImpact}`).join('|'),
  ].join('::');
}

function receiptNextConsequence(option: PlanWeeklyDecisionOption): string {
  if (option.kind === 'adapt_week') {
    if (/tageskonflikt|tradeoff|frische wochen-evidenz|reopen|quellentrend/i.test(option.weekImpact)) {
      return 'Tradeoff-Evidenz in der Vorschau pruefen; Anwenden oder Garmin-Sync passiert erst dort nach explizitem Klick.';
    }
    return option.targetPath
      ? 'Vorschau als naechsten Schritt oeffnen; Anwenden oder Garmin-Sync passiert erst dort nach explizitem Klick.'
      : 'Szenario-Vorschau als naechsten Schritt oeffnen; Anwenden oder Garmin-Sync passiert erst dort nach explizitem Klick.';
  }
  if (option.kind === 'defer_decision') {
    return 'Entscheidung bleibt Watch-Kontext; bei neuer Recovery-, Ziel- oder Garmin-Evidenz wieder pruefen.';
  }
  return 'Woche bleibt wie gewaehlt; Apply, Plan- oder Garmin-Schritte passieren nur auf ihren bestehenden expliziten Oberflaechen.';
}

export function buildPlanWeeklyDecisionReceipt(
  contract: PlanWeeklyDecisionContract,
  optionKind: PlanWeeklyDecisionOptionKind,
  createdAt: string,
): PlanWeeklyDecisionReceipt {
  const option = contract.options.find(item => item.kind === optionKind)
    ?? contract.options.find(item => item.kind === contract.primaryOption)
    ?? contract.options[0];

  return {
    contractSignature: planWeeklyDecisionContractSignature(contract),
    optionKind: option.kind,
    optionLabel: option.label,
    title: `${option.label} gemerkt`,
    decision: option.title,
    weekImpact: option.weekImpact,
    nextConsequence: receiptNextConsequence(option),
    mutationBoundary: 'Keine Plan- oder Garmin-Aenderung gespeichert; dies ist ein lokaler Entscheidungsbeleg.',
    targetPath: option.targetPath,
    createdAt,
    evidence: contract.evidence.slice(0, 4),
  };
}

export function buildPlanWeeklyDecisionContract(input: PlanWeeklyDecisionContractInput): PlanWeeklyDecisionContract {
  const inbox = buildPlanChangeInbox({
    today: input.today,
    workouts: input.workouts,
    adaptationEvents: input.adaptationEvents,
    refreshPreview: input.refreshPreview,
  });
  const tradeoffContext = tradeoffDecisionContext(input);
  const learningContext = tradeoffContext && tradeoffContext.count >= 2
    ? null
    : learningCalibrationContext(input);
  const learningSurface = tradeoffContext?.hasDecision
    ? tradeoffContext
    : learningContext?.hasDecision
      ? learningContext
      : tradeoffContext ?? learningContext;
  const learned = learningSurface?.body
    ?? firstUsefulSignal(input.personalResponse)
    ?? reviewRecommendation(input.review)
    ?? 'Noch nicht genug verdichtete Wochen-Evidenz. Pulse sammelt weiter Ausfuehrung, Feedback und Check-ins, bevor daraus eine harte Planregel wird.';
  const changed = changedBody(input, tradeoffContext);
  const risk = riskBody(input);
  const hasPlanChange = inbox.items.length > 0 || hasRefreshSignal(input.refreshPreview);
  const hasLearningDecision = Boolean(tradeoffContext?.hasDecision || learningContext?.hasDecision);
  const hasOpenChange = hasPlanChange || hasLearningDecision;
  const tone: PlanWeeklyDecisionTone = inbox.hasAction
    || risk.hasAttention
    || Boolean(tradeoffContext?.hasDecision)
    || (learningContext?.hasDecision && learningContext.calibration.tone === 'rose')
    ? 'attention'
    : hasOpenChange || risk.hasWatch
      ? 'watch'
      : 'ok';
  const nextBody = hasPlanChange
    ? 'Prüfen, ob du diese Woche anpassen, beibehalten oder verschieben solltest; erst die Vorschau macht daraus eine Aenderung.'
    : tradeoffContext?.hasDecision
      ? tradeoffContext.sourceTrendLabel
        ? 'Reopen-Quellentrend explizit in Beibehalten, Anpassen oder Spaeter einordnen; erst eine Vorschau oder ein Apply-Schritt schreibt in Plan oder Garmin.'
        : 'Wiederholte Tageskonflikte explizit in Beibehalten, Anpassen oder Spaeter einordnen; erst eine Vorschau oder ein Apply-Schritt schreibt in Plan oder Garmin.'
    : learningContext?.hasDecision
      ? 'Lernkalibrierung explizit in Beibehalten, Anpassen oder Spaeter einordnen; erst eine Vorschau oder ein Apply-Schritt schreibt in Plan oder Garmin.'
    : 'Aktuelle Woche beibehalten und nur reagieren, wenn Check-in, Ausfuehrung oder Zielrisiko ein neues Signal liefern.';

  const sections: PlanWeeklyDecisionSection[] = [
    {
      id: 'learned',
      label: 'Gelernt',
      title: learningSurface?.title ?? 'Was Pulse mitnimmt',
      body: learned,
      evidence: learningSurface?.evidence ?? input.personalResponse?.summary.signals[0]?.evidence.slice(0, 2) ?? [],
    },
    {
      id: 'changed',
      label: 'Geaendert',
      title: hasOpenChange ? 'Was die Woche veraendert' : 'Was stabil bleibt',
      body: changed,
      evidence: inbox.items.slice(0, 2).map(item => item.title),
    },
    {
      id: 'risk',
      label: 'Risiko',
      title: risk.hasWatch ? 'Was gegen blindes Weiterfahren spricht' : 'Keine harte Gegenanzeige',
      body: risk.body,
      evidence: risk.evidence,
    },
    {
      id: 'next_action',
      label: 'Naechster Schritt',
      title: hasOpenChange ? 'Entscheidung aktiv treffen' : 'Plan ruhig halten',
      body: nextBody,
      evidence: inbox.items[0]?.evidence.slice(0, 2) ?? [],
    },
  ];

  const options = buildOptions(input, hasOpenChange, tradeoffContext);
  const primaryOption: PlanWeeklyDecisionOptionKind = hasOpenChange ? 'adapt_week' : 'accept_current';

  return {
    tone,
    title: hasOpenChange ? 'Wochenentscheidung offen' : 'Woche aktuell stabil',
    summary: hasOpenChange
      ? 'Plan, Ziel, Recovery und Garmin erst in einer Vorschau zusammenbringen; kein Schritt schreibt automatisch.'
      : 'Die Woche hat gerade keine offene Planentscheidung; weiter ausfuehren und Evidenz sammeln.',
    sections,
    options,
    primaryOption,
    evidence: [
      `${inbox.items.length} offene Planpunkte`,
      tradeoffContext?.hasDecision ? `Tageskonflikt Wochenentscheidung: ${tradeoffContext.evidence[0]}` : null,
      tradeoffContext?.hasHandledReceipt && tradeoffContext.resolvedSourceTrendLabel && tradeoffContext.receiptSummary && tradeoffContext.receiptFollowupSummary ? `Wochenreceipt-Lernvertrauen bestaetigt: ${tradeoffContext.resolvedSourceTrendLabel}` : null,
      tradeoffContext?.hasHandledReceipt && tradeoffContext.receiptTrustDuration ? `Wochenreceipt-Vertrauensdauer: ${tradeoffContext.receiptTrustDuration}` : null,
      tradeoffContext?.hasHandledReceipt && tradeoffContext.resolvedSourceTrendLabel && tradeoffContext.receiptSummary && !tradeoffContext.receiptFollowupSummary ? `Wochenreceipt-Lernvertrauen unaufgefrischt: ${tradeoffContext.resolvedSourceTrendLabel}` : null,
      tradeoffContext?.hasHandledReceipt && tradeoffContext.receiptRenewalCheck ? tradeoffContext.receiptRenewalCheck : null,
      tradeoffContext?.hasHandledReceipt && (!tradeoffContext.resolvedSourceTrendLabel || !tradeoffContext.receiptSummary) ? `Tageskonflikt erledigt: ${tradeoffContext.evidence[0]}` : null,
      tradeoffContext?.hasWatch && !tradeoffContext.hasHandledReceipt ? 'Tageskonflikt Watch-Kontext' : null,
      tradeoffContext?.sourceTrendLabel ? `Reopen-Quellentrend: ${tradeoffContext.sourceTrendLabel}` : null,
      tradeoffContext?.hasDecision && tradeoffContext.resolvedSourceTrendLabel && tradeoffContext.receiptSummary ? `Wochenreceipt-Lernvertrauen braucht Review: ${tradeoffContext.resolvedSourceTrendLabel}` : null,
      tradeoffContext?.hasHandledReceipt && tradeoffContext.resolvedSourceTrendLabel && !tradeoffContext.receiptSummary ? `Reopen-Quellentrend erledigt: ${tradeoffContext.resolvedSourceTrendLabel}` : null,
      tradeoffContext?.receiptSummary ? `Wochenreceipt: ${tradeoffContext.receiptSummary}` : null,
      ...(tradeoffContext?.sourceTrendLabel
        ? tradeoffContext.evidence.filter(item => item.startsWith('Reopen-Trend')).slice(0, 3)
        : []),
      ...(tradeoffContext?.resolvedSourceTrendLabel
        ? tradeoffContext.evidence.filter(item => item.startsWith('Reopen-Trend entschieden')).slice(0, 3)
        : []),
      learningContext?.hasDecision ? `Lernkalibrierung: ${learningContext.calibration.title}` : null,
      learningContext?.hasWatch ? 'Lernkalibrierung Watch-Kontext' : null,
      ...risk.evidence.slice(0, 3),
    ].filter((item): item is string => item != null && item.length > 0),
  };
}
