import type { PulseDailyDecisionQualityResponse } from '@coaching-os/shared/pulse';

export type TradeoffPatternEffect = 'today_action' | 'plan_decision' | 'watch_context';
export type TradeoffPatternState = 'active' | 'resolved' | 'evidence_gap';

export interface TradeoffPatternClassification {
  count: number;
  themeLabel: string;
  suggestedAdjustment: string;
  evidence: string[];
  freshEvidence: string[];
  resolvedEvidence: string[];
  effect: TradeoffPatternEffect;
  state: TradeoffPatternState;
  hasFreshEvidence: boolean;
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

function withoutTrailingPeriod(value: string): string {
  return value.trim().replace(/[.]+$/u, '');
}

const RESOLVED_TRADEOFF_PATTERN = /bereits|eingeordnet|gemerkt|beibehalten gemerkt|gehandhabt|handled|resolved|geloest|gelöst|erledigt|abgehakt/i;
const FRESH_TRADEOFF_PATTERN = /frisch|fresh|neu|neue evidenz|erneut|seit gemerkter|seit der|seit dem|wieder wochenentscheidung|jetzt wieder/i;

export function classifyTradeoffPattern(
  decisionQuality: PulseDailyDecisionQualityResponse | null | undefined,
): TradeoffPatternClassification | null {
  if (!decisionQuality) return null;
  const tradeoffTheme = decisionQuality.repeatedThemes
    .filter(theme => /tageskonflikt|koerper|körper|ziel|alltag|tradeoff/i.test(`${theme.theme} ${theme.evidence.join(' ')}`))
    .sort((a, b) => b.count - a.count)[0] ?? null;
  if (!tradeoffTheme) return null;

  const themeLabel = withoutTrailingPeriod(tradeoffTheme.theme);
  const suggestedAdjustment = withoutTrailingPeriod(decisionQuality.suggestedAdjustment);
  const resolutionCorpus = [
    decisionQuality.statusLabel,
    decisionQuality.suggestedAdjustment,
    tradeoffTheme.theme,
    ...tradeoffTheme.evidence,
    ...decisionQuality.bestEvidence,
  ].join(' ');
  const freshEvidenceCorpus = [
    decisionQuality.statusLabel,
    tradeoffTheme.theme,
    ...tradeoffTheme.evidence,
    ...decisionQuality.bestEvidence,
  ].join(' ');
  const hasFreshEvidence = FRESH_TRADEOFF_PATTERN.test(freshEvidenceCorpus);
  const freshEvidence = unique([
    decisionQuality.statusLabel,
    ...tradeoffTheme.evidence,
    ...decisionQuality.bestEvidence,
  ].filter(item => FRESH_TRADEOFF_PATTERN.test(item)), 3);
  const resolvedEvidence = unique([
    ...tradeoffTheme.evidence,
    ...decisionQuality.bestEvidence,
  ].filter(item => RESOLVED_TRADEOFF_PATTERN.test(item) && !FRESH_TRADEOFF_PATTERN.test(item)), 3);
  const isResolved = RESOLVED_TRADEOFF_PATTERN.test(resolutionCorpus) && !hasFreshEvidence;
  const repeated = tradeoffTheme.count >= 2;
  const becomesWeeklyDecision = repeated
    && (decisionQuality.status === 'needs_strategy_change' || tradeoffTheme.status === 'stale');
  const changesToday = repeated
    && (decisionQuality.status === 'helpful' || tradeoffTheme.status === 'useful_repetition');
  let effect: TradeoffPatternEffect = 'watch_context';
  if (!isResolved && becomesWeeklyDecision) {
    effect = 'plan_decision';
  } else if (!isResolved && changesToday) {
    effect = 'today_action';
  }
  const state: TradeoffPatternState = isResolved
    ? 'resolved'
    : effect === 'watch_context'
      ? 'evidence_gap'
      : 'active';

  return {
    count: tradeoffTheme.count,
    themeLabel,
    suggestedAdjustment,
    evidence: unique([
      `${tradeoffTheme.count}x ${themeLabel}`,
      ...tradeoffTheme.evidence,
      ...decisionQuality.bestEvidence,
    ], 4),
    freshEvidence,
    resolvedEvidence,
    effect,
    state,
    hasFreshEvidence,
  };
}
