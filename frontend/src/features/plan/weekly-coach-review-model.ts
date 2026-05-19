import type {
  PulseAdaptationEvent,
  PulseFitnessLoad,
  PulseGoalProjectionResponse,
  PulsePersonalResponseResponse,
  PulsePlanRefreshPreview,
  PulsePlannedWorkout,
  PulseSeasonStrategyResponse,
  PulseWeeklyReview,
} from '@coaching-os/shared/pulse';
import { buildPlanWeeklyDecisionContract, type PlanWeeklyDecisionContract } from './weekly-decision-contract';

export type WeeklyCoachReviewTone = 'attention' | 'ok' | 'info';
export type WeeklyCoachReviewActionKind = 'open_plan_inbox' | 'read_review' | 'generate_review';
export type WeeklyCoachReviewLaneId = 'learned' | 'plan_change' | 'decision';

export interface WeeklyCoachReviewLane {
  id: WeeklyCoachReviewLaneId;
  label: string;
  title: string;
  body: string;
  tone: WeeklyCoachReviewTone;
}

export interface WeeklyCoachReviewAction {
  kind: WeeklyCoachReviewActionKind;
  label: string;
  targetPath: string | null;
  resultPreview: string;
}

export interface WeeklyCoachReviewSummary {
  tone: WeeklyCoachReviewTone;
  title: string;
  summary: string;
  primaryAction: WeeklyCoachReviewAction;
  lanes: WeeklyCoachReviewLane[];
  evidence: string[];
  weeklyDecision: PlanWeeklyDecisionContract;
}

function firstUsefulSignal(response: PulsePersonalResponseResponse | null): string | null {
  const summary = response?.summary;
  if (!summary) return null;
  const useful = summary.signals.find(signal => signal.strength !== 'insufficient') ?? summary.signals[0] ?? null;
  if (useful) return `${useful.label}: ${useful.nextAdjustment}`;
  return summary.headline;
}

function topGoalSummary(goalProjection: PulseGoalProjectionResponse | null): string | null {
  const projection = goalProjection?.projections[0] ?? null;
  if (!projection) return goalProjection?.headline ?? null;
  const pct = projection.probabilityPct != null ? ` (${projection.probabilityPct}% Zielwahrscheinlichkeit)` : '';
  return `${projection.title}${pct}: ${projection.nextBestIntervention.summary}`;
}

function actionEvent(events: PulseAdaptationEvent[]): PulseAdaptationEvent | null {
  return events.find(event => event.resolvedAt == null && event.severity === 'action')
    ?? events.find(event => event.resolvedAt == null && event.recommendation !== 'keep_plan')
    ?? null;
}

function cleanRecommendation(review: PulseWeeklyReview | null): string | null {
  return review?.recommendations.find(item => item.trim().length > 0)?.trim() ?? null;
}

export function buildWeeklyCoachReview(input: {
  review: PulseWeeklyReview | null;
  adaptationEvents: PulseAdaptationEvent[];
  personalResponse: PulsePersonalResponseResponse | null;
  goalProjection: PulseGoalProjectionResponse | null;
  seasonStrategy: PulseSeasonStrategyResponse | null;
  today?: string;
  workouts?: PulsePlannedWorkout[];
  refreshPreview?: PulsePlanRefreshPreview | null;
  currentLoad?: PulseFitnessLoad | null;
}): WeeklyCoachReviewSummary {
  const openAction = actionEvent(input.adaptationEvents);
  const learned = firstUsefulSignal(input.personalResponse);
  const goal = topGoalSummary(input.goalProjection);
  const seasonFocus = input.seasonStrategy?.strategy?.currentBlock?.focus ?? null;
  const recommendation = cleanRecommendation(input.review);
  const weeklyDecision = buildPlanWeeklyDecisionContract({
    today: input.today ?? input.review?.weekStart ?? new Date().toISOString().slice(0, 10),
    workouts: input.workouts ?? [],
    adaptationEvents: input.adaptationEvents,
    refreshPreview: input.refreshPreview ?? null,
    currentLoad: input.currentLoad ?? null,
    goalProjection: input.goalProjection,
    personalResponse: input.personalResponse,
    review: input.review,
  });
  const learnedLane = weeklyDecision.sections.find(section => section.id === 'learned');
  const changedLane = weeklyDecision.sections.find(section => section.id === 'changed');
  const nextActionLane = weeklyDecision.sections.find(section => section.id === 'next_action');

  if (openAction) {
    return {
      tone: 'attention',
      title: 'Wochenentscheidung offen',
      summary: goal ?? 'Pulse hat eine Planabweichung gefunden, die vor der nächsten harten Einheit geprüft werden sollte.',
      primaryAction: {
        kind: 'open_plan_inbox',
        label: 'Planpunkte prüfen',
        targetPath: '/plan?tab=training&source=weekly-review#plan-change-inbox',
        resultPreview: 'Du öffnest die Plan-Inbox; Schreiben in Plan oder Garmin passiert erst nach einem weiteren bewussten Klick.',
      },
      lanes: [
        {
          id: 'learned',
          label: 'Gelernt',
          title: learnedLane?.title ?? 'Was Pulse mitnimmt',
          body: learnedLane?.body ?? learned ?? 'Noch nicht genug Wochenmuster. Pulse bewertet zuerst Ausführung, Check-in und Ziel-Evidenz.',
          tone: 'info',
        },
        {
          id: 'plan_change',
          label: 'Planänderung',
          title: changedLane?.title ?? 'Was geprüft werden soll',
          body: changedLane?.body ?? openAction.summary,
          tone: 'attention',
        },
        {
          id: 'decision',
          label: 'Entscheidung',
          title: nextActionLane?.title ?? 'Was du tun solltest',
          body: nextActionLane?.body ?? 'Prüfen, ob der Wochenplan angepasst, bewusst beibehalten oder auf später verschoben wird.',
          tone: 'attention',
        },
      ],
      evidence: [
        ...openAction.evidence.slice(0, 2),
        seasonFocus ? `Saison: ${seasonFocus}` : null,
      ].filter((item): item is string => item != null),
      weeklyDecision,
    };
  }

  if (!input.review) {
    return {
      tone: 'info',
      title: 'Review fehlt noch',
      summary: 'Es gibt noch kein gespeichertes Wochenreview. Pulse kann eins explizit erzeugen, ohne automatisch Plan oder Garmin zu verändern.',
      primaryAction: {
        kind: 'generate_review',
        label: 'Review erstellen',
        targetPath: null,
        resultPreview: 'Pulse erzeugt ein neues Wochenreview; danach bleibt die Entscheidung bei dir.',
      },
      lanes: [
        {
          id: 'learned',
          label: 'Gelernt',
          title: learnedLane?.title ?? 'Noch offen',
          body: learnedLane?.body ?? learned ?? 'Noch nicht genug verdichtete Wochen-Evidenz für eine Review-Zusammenfassung.',
          tone: 'info',
        },
        {
          id: 'plan_change',
          label: 'Planänderung',
          title: changedLane?.title ?? 'Keine offene Aktion',
          body: changedLane?.body ?? 'Ohne gespeichertes Review zeigt Pulse nur aktuelle Plan- und Evidenzsignale.',
          tone: 'info',
        },
        {
          id: 'decision',
          label: 'Entscheidung',
          title: nextActionLane?.title ?? 'Review bewusst starten',
          body: nextActionLane?.body ?? 'Erst Review erstellen, dann akzeptieren, ablehnen oder auf später verschieben.',
          tone: 'info',
        },
      ],
      evidence: input.personalResponse?.summary.missingEvidence.slice(0, 2) ?? [],
      weeklyDecision,
    };
  }

  return {
    tone: 'ok',
    title: 'Woche stabil halten',
    summary: goal ?? input.review.narrative.split('\n').find(line => line.trim().length > 0)?.trim() ?? 'Die Woche wirkt geschlossen; Details stehen im Review darunter.',
    primaryAction: {
      kind: 'read_review',
      label: 'Review lesen',
      targetPath: '#weekly-review-narrative',
      resultPreview: 'Du springst zur gespeicherten Wochenanalyse; Plan und Garmin bleiben unverändert.',
    },
    lanes: [
      {
        id: 'learned',
        label: 'Gelernt',
        title: learnedLane?.title ?? 'Was Pulse mitnimmt',
        body: learnedLane?.body ?? learned ?? input.review.narrative,
        tone: 'ok',
      },
      {
        id: 'plan_change',
        label: 'Planänderung',
        title: changedLane?.title ?? 'Was sich ableitet',
        body: changedLane?.body ?? recommendation ?? seasonFocus ?? 'Keine offene Änderung; aktuelle Woche weiter beobachten.',
        tone: 'ok',
      },
      {
        id: 'decision',
        label: 'Entscheidung',
        title: nextActionLane?.title ?? 'Was du tun solltest',
        body: nextActionLane?.body ?? 'Beibehalten, solange Check-in, Warm-up und Garmin-Ausführung keine neuen Gegenzeichen liefern.',
        tone: 'ok',
      },
    ],
    evidence: [
      input.review.weekStart && input.review.weekEnd ? `${input.review.weekStart} bis ${input.review.weekEnd}` : null,
      seasonFocus ? `Saison: ${seasonFocus}` : null,
      input.personalResponse?.summary.strength ? `Response: ${input.personalResponse.summary.strength}` : null,
    ].filter((item): item is string => item != null),
    weeklyDecision,
  };
}
