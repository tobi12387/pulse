import type {
  PulseGoalProjectionResponse,
  PulsePersonalResponseResponse,
  PulseSeasonStrategyResponse,
} from '@coaching-os/shared/pulse';

export function buildContextualCoachPrompt({
  personalResponse,
  goalProjection,
  seasonStrategy,
}: {
  personalResponse: PulsePersonalResponseResponse | null;
  goalProjection: PulseGoalProjectionResponse | null;
  seasonStrategy: PulseSeasonStrategyResponse | null;
}): string {
  const personalSignal = personalResponse?.summary.signals.find(signal => signal.strength !== 'insufficient')
    ?? personalResponse?.summary.signals[0]
    ?? null;
  const topGoal = goalProjection?.projections[0] ?? null;
  const strategy = seasonStrategy?.strategy ?? null;
  const guardrails = strategy?.guardrails ?? null;

  const lines = [
    'Nutze bitte meinen aktuellen Pulse-Kontext und erklaere mir die naechste sinnvolle Coach-Frage.',
    personalResponse
      ? `Persoenliche Reaktion: ${personalResponse.summary.headline} ${personalSignal ? `${personalSignal.label}: ${personalSignal.nextAdjustment}` : 'Keine starke Einzelspur.'}`
      : 'Persoenliche Reaktion: noch offen.',
    topGoal
      ? `Ziel: ${topGoal.summary} Naechste Intervention: ${topGoal.nextBestIntervention.title} - ${topGoal.nextBestIntervention.summary}`
      : 'Ziel: keine belastbare Projektion.',
    strategy
      ? `Saisonvertrag: ${strategy.currentBlock.label}. ${guardrails ? `${guardrails.targetSessions} Einheiten, max. ${guardrails.maxHardDays} harte Tage. ${guardrails.freeDayRationale}` : 'Guardrails offen.'}`
      : 'Saisonvertrag: noch offen.',
    'Bitte antworte alltagstauglich: was ist jetzt wichtig, warum, welche Grenze schuetzt mich, und welche Frage sollte ich zuerst klaeren?',
  ];

  return lines.join('\n');
}
