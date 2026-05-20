import type { PulseDailyDecisionQualityResponse } from '@coaching-os/shared/pulse';

export type TradeoffPatternEffect = 'today_action' | 'plan_decision' | 'watch_context';

export interface TradeoffPatternClassification {
  count: number;
  themeLabel: string;
  suggestedAdjustment: string;
  evidence: string[];
  effect: TradeoffPatternEffect;
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
  const repeated = tradeoffTheme.count >= 2;
  const effect: TradeoffPatternEffect = repeated && (decisionQuality.status === 'needs_strategy_change' || tradeoffTheme.status === 'stale')
    ? 'plan_decision'
    : repeated && (decisionQuality.status === 'helpful' || tradeoffTheme.status === 'useful_repetition')
      ? 'today_action'
      : 'watch_context';

  return {
    count: tradeoffTheme.count,
    themeLabel,
    suggestedAdjustment,
    evidence: unique([
      `${tradeoffTheme.count}x ${themeLabel}`,
      ...tradeoffTheme.evidence,
      ...decisionQuality.bestEvidence,
    ], 4),
    effect,
  };
}
