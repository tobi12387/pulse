import type { PulseDailyDecisionQualityResponse } from '@coaching-os/shared/pulse';

export type TradeoffPatternEffect = 'today_action' | 'plan_decision' | 'watch_context';
export type TradeoffPatternState = 'active' | 'resolved' | 'evidence_gap';
export type TradeoffReopenSourceId =
  | 'goal_risk'
  | 'plan_load'
  | 'recovery'
  | 'garmin_execution'
  | 'everyday';

export interface TradeoffReopenSourceTrend {
  id: TradeoffReopenSourceId;
  label: string;
  count: number;
  evidence: string[];
}

export interface TradeoffPatternClassification {
  count: number;
  themeLabel: string;
  suggestedAdjustment: string;
  evidence: string[];
  freshEvidence: string[];
  resolvedEvidence: string[];
  receiptFollowupEvidence: string[];
  effect: TradeoffPatternEffect;
  state: TradeoffPatternState;
  hasFreshEvidence: boolean;
  reopenSourceTrends: TradeoffReopenSourceTrend[];
  resolvedReopenSourceTrends: TradeoffReopenSourceTrend[];
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
const FRESH_TRADEOFF_PATTERN = /frisch|fresh|neu|neue evidenz|erneut|seit gemerkter|seit der|seit dem|wieder wochenentscheidung|jetzt wieder|reopen-grund|reopen-source/i;
const NEGATED_FRESH_TRADEOFF_PATTERN = /(?:ohne|keine|kein|nicht)\s+(?:erneute?n?|neue?n?|frische?n?|wiederkehr|reopen)/i;
const RECEIPT_FOLLOWUP_PATTERN = /folgewirkung|follow[-\s]?up|bestaetigt|bestätigt|stabil|ohne\s+erneute|keine\s+erneute/i;
const GENERIC_REOPEN_PATTERN = /reopen|re-open/i;
const REOPEN_SOURCE_REPEAT_PATTERN = /\b([2-9]\d*)x\b|wiederholte?r?|mehrfach|mehrere|quellentrend|reopen-grund|reopen-source|trend/i;

const REOPEN_SOURCE_DEFINITIONS: Array<{
  id: TradeoffReopenSourceId;
  label: string;
  pattern: RegExp;
}> = [
  {
    id: 'goal_risk',
    label: 'Zielrisiko',
    pattern: /ziel|goal|race|kraichgau|70\.3|wahrscheinlichkeit|limiter|long[-\s]?endurance/i,
  },
  {
    id: 'plan_load',
    label: 'Planlast',
    pattern: /planlast|wochenlast|trainingslast|load|tss|umfang|intensitaet|intensität/i,
  },
  {
    id: 'recovery',
    label: 'Recovery',
    pattern: /recovery|erholung|readiness|tsb|hrv|schlaf|ermuedung|ermüdung/i,
  },
  {
    id: 'garmin_execution',
    label: 'Garmin-Ausfuehrung',
    pattern: /garmin|ausfuehrung|ausführung|sync|handoff|uhr|edge|abgebrochen/i,
  },
  {
    id: 'everyday',
    label: 'Alltag',
    pattern: /alltag|zeitfenster|kalender|termin|45 minuten|familie|arbeit|verfuegbar|verfügbar/i,
  },
];

function reopenSourceRepeatCount(value: string): number {
  const explicitCount = value.match(/\b([2-9]\d*)x\b/u)?.[1] ?? null;
  if (explicitCount) return Number.parseInt(explicitCount, 10);
  return REOPEN_SOURCE_REPEAT_PATTERN.test(value) ? 2 : 1;
}

function buildReopenSourceTrends(freshEvidence: string[]): TradeoffReopenSourceTrend[] {
  const trends = new Map<TradeoffReopenSourceId, TradeoffReopenSourceTrend>();

  for (const item of freshEvidence) {
    const count = reopenSourceRepeatCount(item);
    if (count < 2) continue;

    for (const source of REOPEN_SOURCE_DEFINITIONS) {
      if (!source.pattern.test(item)) continue;
      const current = trends.get(source.id) ?? {
        id: source.id,
        label: source.label,
        count: 0,
        evidence: [],
      };
      trends.set(source.id, {
        ...current,
        count: Math.max(current.count, count),
        evidence: unique([...current.evidence, item], 3),
      });
    }
  }

  return [...trends.values()]
    .filter(trend => trend.count >= 2)
    .sort((a, b) => {
      const sourceOrder = (id: TradeoffReopenSourceId) =>
        REOPEN_SOURCE_DEFINITIONS.findIndex(source => source.id === id);
      return b.count - a.count || sourceOrder(a.id) - sourceOrder(b.id);
    });
}

function isFreshTradeoffEvidence(value: string): boolean {
  if (NEGATED_FRESH_TRADEOFF_PATTERN.test(value)) return false;
  if (FRESH_TRADEOFF_PATTERN.test(value)) return true;
  return GENERIC_REOPEN_PATTERN.test(value) && !RESOLVED_TRADEOFF_PATTERN.test(value);
}

function isResolvedTradeoffEvidence(value: string): boolean {
  return RESOLVED_TRADEOFF_PATTERN.test(value) && !isFreshTradeoffEvidence(value);
}

function isReceiptFollowupEvidence(value: string): boolean {
  return RECEIPT_FOLLOWUP_PATTERN.test(value);
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
  const resolutionCorpus = [
    decisionQuality.statusLabel,
    decisionQuality.suggestedAdjustment,
    tradeoffTheme.theme,
    ...tradeoffTheme.evidence,
    ...decisionQuality.bestEvidence,
  ].join(' ');
  const hasFreshEvidence = [
    decisionQuality.statusLabel,
    tradeoffTheme.theme,
    ...tradeoffTheme.evidence,
    ...decisionQuality.bestEvidence,
  ].some(isFreshTradeoffEvidence);
  const freshEvidence = unique([
    decisionQuality.statusLabel,
    ...tradeoffTheme.evidence,
    ...decisionQuality.bestEvidence,
  ].filter(isFreshTradeoffEvidence), 3);
  const resolvedEvidence = unique([
    decisionQuality.statusLabel,
    ...tradeoffTheme.evidence,
    ...decisionQuality.bestEvidence,
  ].filter(isResolvedTradeoffEvidence), 5);
  const receiptFollowupEvidence = unique([
    decisionQuality.statusLabel,
    ...tradeoffTheme.evidence,
    ...decisionQuality.bestEvidence,
  ].filter(isReceiptFollowupEvidence), 3);
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
  const reopenSourceTrends = buildReopenSourceTrends(freshEvidence);
  const resolvedReopenSourceTrends = buildReopenSourceTrends(resolvedEvidence);

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
    receiptFollowupEvidence,
    effect,
    state,
    hasFreshEvidence,
    reopenSourceTrends,
    resolvedReopenSourceTrends,
  };
}
