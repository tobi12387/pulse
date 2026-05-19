import type {
  PulseAdaptationEvent,
  PulseFitnessLoad,
  PulseGoalProjection,
  PulseGoalProjectionResponse,
  PulsePersonalResponseResponse,
  PulsePlanRefreshPreview,
  PulsePlannedWorkout,
  PulseWeeklyReview,
} from '@coaching-os/shared/pulse';
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

export interface PlanWeeklyDecisionContractInput {
  today: string;
  workouts: PulsePlannedWorkout[];
  adaptationEvents: PulseAdaptationEvent[];
  refreshPreview: PulsePlanRefreshPreview | null;
  currentLoad: PulseFitnessLoad | null;
  goalProjection: PulseGoalProjectionResponse | null;
  personalResponse: PulsePersonalResponseResponse | null;
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

function changedBody(input: PlanWeeklyDecisionContractInput): string {
  if (hasRefreshSignal(input.refreshPreview)) return input.refreshPreview.summary;
  const inbox = buildPlanChangeInbox({
    today: input.today,
    workouts: input.workouts,
    adaptationEvents: input.adaptationEvents,
    refreshPreview: input.refreshPreview,
  });
  const first = inbox.items.find(item => item.id.startsWith('adaptation-')) ?? inbox.items[0] ?? null;
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

function buildOptions(input: PlanWeeklyDecisionContractInput, hasOpenChange: boolean): PlanWeeklyDecisionOption[] {
  const preview = hasRefreshSignal(input.refreshPreview) ? input.refreshPreview : null;
  const impact = preview
    ? `Vorschau: TSS ${sign(preview.loadImpact.tssDelta)}, Dauer ${sign(preview.loadImpact.durationDeltaMin)} min; ${preview.garminImpact.summary}`
    : 'Vorschau: Woche bleibt strukturell unveraendert, bis ein Szenario geoeffnet wird.';
  return [
    {
      kind: 'accept_current',
      label: 'Beibehalten',
      title: hasOpenChange ? 'Aktuelle Woche bewusst akzeptieren' : 'Aktuelle Woche weiterfahren',
      weekImpact: hasOpenChange
        ? 'Aktuelle Planlast bleibt bestehen; offene Vorschlaege werden nicht angewendet.'
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
      targetPath: preview ? '#plan-refresh-preview-card' : '#plan-scenario-preview',
    },
    {
      kind: 'defer_decision',
      label: 'Spaeter',
      title: 'Entscheidung bewusst vertagen',
      weekImpact: hasOpenChange
        ? 'Die Woche bleibt vorerst wie geplant; das offene Signal bleibt Watch-Kontext.'
        : 'Keine Wochenlast-Aenderung; Pulse beobachtet weiter.',
      resultPreview: 'Du verschiebst nur die Entscheidung in dieser Ansicht; keine Plan- oder Garmin-Aenderung passiert hier.',
      readOnly: true,
      targetPath: null,
    },
  ];
}

export function buildPlanWeeklyDecisionContract(input: PlanWeeklyDecisionContractInput): PlanWeeklyDecisionContract {
  const inbox = buildPlanChangeInbox({
    today: input.today,
    workouts: input.workouts,
    adaptationEvents: input.adaptationEvents,
    refreshPreview: input.refreshPreview,
  });
  const learned = firstUsefulSignal(input.personalResponse)
    ?? reviewRecommendation(input.review)
    ?? 'Noch nicht genug verdichtete Wochen-Evidenz. Pulse sammelt weiter Ausfuehrung, Feedback und Check-ins, bevor daraus eine harte Planregel wird.';
  const changed = changedBody(input);
  const risk = riskBody(input);
  const hasOpenChange = inbox.items.length > 0 || hasRefreshSignal(input.refreshPreview);
  const tone: PlanWeeklyDecisionTone = inbox.hasAction || risk.hasAttention
    ? 'attention'
    : hasOpenChange || risk.hasWatch
      ? 'watch'
      : 'ok';
  const nextBody = hasOpenChange
    ? 'Prüfen, ob du diese Woche anpassen, beibehalten oder verschieben solltest; erst die Vorschau macht daraus eine Aenderung.'
    : 'Aktuelle Woche beibehalten und nur reagieren, wenn Check-in, Ausfuehrung oder Zielrisiko ein neues Signal liefern.';

  const sections: PlanWeeklyDecisionSection[] = [
    {
      id: 'learned',
      label: 'Gelernt',
      title: 'Was Pulse mitnimmt',
      body: learned,
      evidence: input.personalResponse?.summary.signals[0]?.evidence.slice(0, 2) ?? [],
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

  const options = buildOptions(input, hasOpenChange);
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
      ...risk.evidence.slice(0, 3),
    ],
  };
}
