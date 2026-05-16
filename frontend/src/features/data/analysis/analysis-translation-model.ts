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

export type AnalysisTranslationSignal = {
  label: string;
  title: string;
  summary: string;
  evidence: string[];
  tone: AnalysisTranslationTone;
  actionLabel?: string;
  targetPath?: string;
  resultPreview?: string;
};

export type AnalysisTranslation = {
  primary: AnalysisTranslationSignal;
  watch: AnalysisTranslationSignal;
  supportEvidence: string[];
};

const PLAN_LOAD_PREVIEW_PATH = '/plan?tab=training&source=data-load#plan-scenario-preview';

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

function resultPreviewForTargetPath(targetPath: string): string {
  if (targetPath.startsWith('/plan')) {
    return 'Öffnet die nächste explizite Planentscheidung aus der Analyse. Plan und Garmin bleiben unverändert, bis du dort bewusst anwendest.';
  }
  if (targetPath.startsWith('/data')) {
    return 'Öffnet die passende Datenevidenz aus der Analyse. Plan und Garmin bleiben unverändert; du prüfst dort nur die Grundlage.';
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
  return {
    label: 'Zielwirkung',
    title: intervention.title,
    summary: `${top.title}: ${top.summary} ${intervention.summary}`,
    evidence: unique([...intervention.evidence, ...top.evidence, top.limiterRisk.summary], 4),
    tone: goalTone(top.status),
    actionLabel: intervention.actionLabel,
    targetPath: intervention.targetPath,
    resultPreview: resultPreviewForTargetPath(intervention.targetPath),
  };
}

function primaryFromPlanTrace(planTrace: PulsePlanTrace | null | undefined): AnalysisTranslationSignal | null {
  const limiter = planTrace?.inputSnapshot.goalLimiter ?? null;
  if (!limiter) return null;
  return {
    label: 'Plan-Limiter',
    title: limiter.label,
    summary: limiter.planBias,
    evidence: unique(limiter.evidence, 4),
    tone: 'amber',
    actionLabel: 'Planwirkung prüfen',
    targetPath: PLAN_LOAD_PREVIEW_PATH,
    resultPreview: resultPreviewForTargetPath(PLAN_LOAD_PREVIEW_PATH),
  };
}

function primaryFromDecisionQuality(decisionQuality: PulseDailyDecisionQualityResponse | null | undefined): AnalysisTranslationSignal | null {
  if (!decisionQuality) return null;
  return {
    label: 'Entscheidungsqualität',
    title: decisionQuality.statusLabel,
    summary: decisionQuality.suggestedAdjustment,
    evidence: unique(decisionQuality.bestEvidence, 4),
    tone: qualityTone(decisionQuality.status),
  };
}

function primaryFromPersonalResponse(personalResponse: PulsePersonalResponseResponse | null | undefined): AnalysisTranslationSignal | null {
  const signal = personalResponse?.summary.signals
    .filter(item => item.strength !== 'insufficient')
    .sort((a, b) => signalRank(b) - signalRank(a))[0] ?? null;
  if (!signal) return null;
  return {
    label: 'Reaktionsmodell',
    title: signal.label,
    summary: signal.nextAdjustment,
    evidence: unique(signal.evidence, 4),
    tone: signalTone(signal),
  };
}

function watchFromGoal(goalProjection: PulseGoalProjectionResponse | null | undefined): AnalysisTranslationSignal | null {
  const top = goalProjection?.projections[0] ?? null;
  const gap = top?.missingEvidence[0] ?? goalProjection?.missingEvidence[0] ?? null;
  if (!gap) return null;
  return {
    label: 'Evidenzlücke',
    title: 'Noch nicht trendfähig',
    summary: gap,
    evidence: unique([top?.limiterRisk.label, top?.limiterRisk.summary], 3),
    tone: 'amber',
  };
}

function watchFromTrainingAnalytics(trainingAnalytics: PulseTrainingAnalyticsResponse | null | undefined): AnalysisTranslationSignal | null {
  const quality = trainingAnalytics?.powerDataQuality ?? null;
  if (quality && quality.status !== 'trusted') {
    return {
      label: 'Analysequalität',
      title: quality.status === 'blocked' ? 'Power blockiert' : 'Power nur Hinweis',
      summary: quality.limitations[0] ?? 'Power-Analyse bleibt begrenzt, bis belastbare Stream-Daten vorhanden sind.',
      evidence: unique([`${quality.coveragePct}% Coverage`, `${quality.spikeCount} Spikes`], 3),
      tone: quality.status === 'blocked' ? 'rose' : 'amber',
    };
  }
  const durability = trainingAnalytics?.powerDuration?.durability ?? null;
  if (durability && durability.rating !== 'strong') {
    return {
      label: 'Durability',
      title: 'Durability beobachten',
      summary: trainingAnalytics?.powerDuration?.durabilityLine ?? 'Durability ist interessant, aber noch kein primärer Tageshebel.',
      evidence: unique(durability.evidence, 3),
      tone: durability.rating === 'limited' ? 'rose' : 'amber',
    };
  }
  return null;
}

function watchFromPersonalResponse(personalResponse: PulsePersonalResponseResponse | null | undefined): AnalysisTranslationSignal | null {
  const missing = personalResponse?.summary.missingEvidence[0] ?? null;
  if (missing) {
    return {
      label: 'Reaktionsmodell',
      title: 'Lernsignal offen',
      summary: missing,
      evidence: [],
      tone: 'muted',
    };
  }
  const insufficient = personalResponse?.summary.signals.find(signal => signal.strength === 'insufficient') ?? null;
  if (!insufficient) return null;
  return {
    label: 'Reaktionsmodell',
    title: insufficient.label,
    summary: insufficient.summary,
    evidence: unique(insufficient.evidence, 3),
    tone: 'muted',
  };
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
    ?? {
      label: 'Analyse',
      title: 'Evidenz wird gesammelt',
      summary: 'Noch kein tiefes Signal ist stark genug, um die Tagesentscheidung zu verändern.',
      evidence: [],
      tone: 'muted' as const,
    };

  const watch = watchFromGoal(goalProjection)
    ?? watchFromTrainingAnalytics(trainingAnalytics)
    ?? watchFromPersonalResponse(personalResponse)
    ?? {
      label: 'Beobachtung',
      title: 'Kein Nebenhebel offen',
      summary: 'Die aktuellen Analyse-Signale sind entweder bereits in der Handlung enthalten oder noch nicht geladen.',
      evidence: [],
      tone: 'muted' as const,
    };

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
