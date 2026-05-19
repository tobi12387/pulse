import type {
  PulseDailyDecisionQualityResponse,
  PulseGoalProjection,
  PulseGoalProjectionResponse,
  PulsePersonalResponseResponse,
  PulsePersonalResponseSignal,
  PulsePlanTrace,
  PulseTrainingAnalyticsResponse,
} from '@coaching-os/shared/pulse';

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
  primary: AnalysisTranslationSignal;
  watch: AnalysisTranslationSignal;
  supportEvidence: string[];
};

const PLAN_WEEKLY_DECISION_PATH = '/plan?tab=training&source=data-load#plan-weekly-decision';
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

function signalRank(signal: PulsePersonalResponseSignal): number {
  if (signal.strength === 'useful') return 3;
  if (signal.strength === 'learning') return 2;
  return 1;
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

function resultPreviewForTargetPath(targetPath: string, effect: AnalysisDecisionEffect = effectForTargetPath(targetPath)): string {
  if (targetPath.startsWith('/plan')) {
    return 'Öffnet die Planentscheidung in der Wochenentscheidung aus der Analyse. Plan und Garmin bleiben unverändert, bis du dort bewusst eine Vorschau anwendest.';
  }
  if (targetPath.includes('#data-goal-projection')) {
    return 'Öffnet die Zielprojektion als Watch-Kontext. Plan und Garmin bleiben unverändert; du prüfst dort nur die Grundlage.';
  }
  if (targetPath.includes('#data-decision-quality')) {
    return 'Öffnet die Entscheidungsqualität als Tageshandlung und Lernschleife. Plan und Garmin bleiben unverändert; du prüfst dort nur die Grundlage.';
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

function primaryFromPersonalResponse(personalResponse: PulsePersonalResponseResponse | null | undefined): AnalysisTranslationSignal | null {
  const signal = personalResponse?.summary.signals
    .filter(item => item.strength !== 'insufficient')
    .sort((a, b) => signalRank(b) - signalRank(a))[0] ?? null;
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
  goalProjection,
  personalResponse,
  planTrace,
  trainingAnalytics,
}: Input): AnalysisTranslation {
  const primary = primaryFromGoal(goalProjection)
    ?? primaryFromPlanTrace(planTrace)
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

  return {
    primary,
    watch,
    supportEvidence: unique([
      ...primary.evidence,
      ...watch.evidence,
      decisionQuality?.bestEvidence[0],
      personalResponse?.summary.headline,
      goalProjection?.headline,
    ], 3),
  };
}
