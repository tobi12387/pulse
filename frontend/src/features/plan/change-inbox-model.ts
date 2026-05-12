import type { PulseAdaptationEvent, PulsePlanRefreshPreview, PulsePlannedWorkout } from '@coaching-os/shared/pulse';
import { executionStatusFor } from './plan-utils';

export type PlanChangeInboxPriority = 'action' | 'watch' | 'info';

export type PlanChangeInboxAction =
  | 'open_refresh_preview'
  | 'review_scenario'
  | 'open_execution'
  | 'open_feedback'
  | 'keep_plan';

export interface PlanChangeInboxItem {
  id: string;
  priority: PlanChangeInboxPriority;
  title: string;
  summary: string;
  whyNow: string;
  resultPreview: string;
  actionLabel: string;
  action: PlanChangeInboxAction;
  evidence: string[];
}

export interface PlanChangeInbox {
  summary: string;
  hasAction: boolean;
  items: PlanChangeInboxItem[];
}

export interface PlanChangeInboxInput {
  today: string;
  workouts: PulsePlannedWorkout[];
  adaptationEvents: PulseAdaptationEvent[];
  refreshPreview: PulsePlanRefreshPreview | null;
}

function priorityRank(priority: PlanChangeInboxPriority): number {
  if (priority === 'action') return 3;
  if (priority === 'watch') return 2;
  return 1;
}

function eventPriority(event: PulseAdaptationEvent): PlanChangeInboxPriority {
  if (event.severity === 'action') return 'action';
  if (event.severity === 'watch') return 'watch';
  return 'info';
}

function refreshPriority(preview: PulsePlanRefreshPreview): PlanChangeInboxPriority {
  if (preview.triggers.some(trigger => trigger.severity === 'action')) return 'action';
  if (preview.stale || preview.triggers.some(trigger => trigger.severity === 'watch') || preview.comparisons.length > 0) return 'watch';
  return 'info';
}

function eventAction(event: PulseAdaptationEvent): Pick<PlanChangeInboxItem, 'action' | 'actionLabel' | 'resultPreview'> {
  if (event.recommendation === 'sync_garmin') {
    return {
      action: 'open_execution',
      actionLabel: 'Garmin prüfen',
      resultPreview: 'Du öffnest den Ausführungs-Check; Reparatur-Buttons schreiben erst nach deinem Klick zu Garmin.',
    };
  }
  if (event.recommendation === 'log_feedback') {
    return {
      action: 'open_feedback',
      actionLabel: 'Feedback öffnen',
      resultPreview: 'Du öffnest die passende Aktivität oder die Analyse; Feedback verbessert die nächste Planentscheidung.',
    };
  }
  if (event.recommendation === 'keep_plan') {
    return {
      action: 'keep_plan',
      actionLabel: 'Beibehalten',
      resultPreview: 'Du blendest die Inbox lokal aus; am Plan und an Garmin ändert sich nichts.',
    };
  }
  return {
    action: 'review_scenario',
    actionLabel: 'Szenario prüfen',
    resultPreview: 'Pulse öffnet die Szenario-Vorschau; erst Anwenden würde Plan oder Garmin verändern.',
  };
}

function titleForEvent(event: PulseAdaptationEvent): string {
  if (event.recommendation === 'sync_garmin') return 'Garmin-Handoff prüfen';
  if (event.recommendation === 'log_feedback') return 'Feedback nachtragen';
  if (event.recommendation === 'protect_recovery') return 'Recovery schützen';
  if (event.recommendation === 'move_workout') return 'Einheit verschieben prüfen';
  if (event.recommendation === 'reduce_intensity') return 'Intensität reduzieren prüfen';
  if (event.recommendation === 'reduce_volume') return 'Umfang reduzieren prüfen';
  if (event.recommendation === 'regenerate_week') return 'Planabweichung bewerten';
  return 'Plan beibehalten prüfen';
}

function buildRefreshItem(preview: PulsePlanRefreshPreview | null): PlanChangeInboxItem | null {
  if (!preview) return null;
  const shouldShow = preview.stale || preview.triggers.length > 0 || preview.comparisons.length > 0;
  if (!shouldShow) return null;

  const triggerEvidence = preview.triggers.map(trigger => `${trigger.label}: ${trigger.detail}`);
  const comparisonEvidence = preview.comparisons.length > 0
    ? [`${preview.comparisons.length} Tag(e) mit konkretem Vorschlag`]
    : [];

  return {
    id: 'refresh-preview',
    priority: refreshPriority(preview),
    title: 'Wochenplan prüfen',
    summary: preview.summary,
    whyNow: preview.triggers[0]?.detail ?? 'Neue Daten können den aktuellen Wochenplan verändern.',
    resultPreview: 'Du öffnest die Refresh-Vorschau; sie schreibt nichts in Plan oder Garmin.',
    actionLabel: 'Vorschau prüfen',
    action: 'open_refresh_preview',
    evidence: [
      ...triggerEvidence,
      ...comparisonEvidence,
      `TSS ${preview.loadImpact.tssDelta >= 0 ? '+' : ''}${preview.loadImpact.tssDelta}`,
      preview.garminImpact.summary,
      preview.mutationBoundary,
    ],
  };
}

function buildGarminDebtItem(workouts: PulsePlannedWorkout[], today: string): PlanChangeInboxItem | null {
  const future = workouts.filter(workout => workout.status === 'planned' && workout.plannedDate >= today);
  if (future.length === 0) return null;

  const localOnly = future.filter(workout => executionStatusFor(workout) === 'local_planned').length;
  const templateOnly = future.filter(workout => executionStatusFor(workout) === 'garmin_template').length;
  const degraded = future.filter(workout => workout.garminSyncContract?.status === 'degraded').length;
  const blocked = future.filter(workout => workout.garminSyncContract?.status === 'blocked').length;
  const debt = localOnly + templateOnly + degraded + blocked;
  if (debt === 0) return null;

  return {
    id: 'garmin-sync-debt',
    priority: blocked > 0 ? 'action' : 'watch',
    title: 'Garmin absichern',
    summary: `${debt} geplante Einheit(en) brauchen noch Ausführungs- oder Sync-Sicherheit.`,
    whyNow: 'Ein Plan ist erst fertig, wenn Uhr oder Edge die Struktur, Kalenderlage und Wiederholungen sauber bekommen.',
    resultPreview: 'Du öffnest den Ausführungs-Check; Reparatur-Buttons schreiben erst nach deinem Klick zu Garmin.',
    actionLabel: 'Garmin prüfen',
    action: 'open_execution',
    evidence: [
      localOnly > 0 ? `${localOnly} nur in Pulse geplant` : null,
      templateOnly > 0 ? `${templateOnly} nur als Garmin-Vorlage` : null,
      degraded > 0 ? `${degraded} mit Sync-Einschränkung` : null,
      blocked > 0 ? `${blocked} blockiert` : null,
    ].filter((item): item is string => item != null),
  };
}

function buildEventItem(event: PulseAdaptationEvent): PlanChangeInboxItem | null {
  if (event.severity === 'info') return null;
  const action = eventAction(event);
  return {
    id: `adaptation-${event.id}`,
    priority: eventPriority(event),
    title: titleForEvent(event),
    summary: event.summary,
    whyNow: event.evidence[0] ?? 'Pulse hat ein offenes Adaptionssignal gefunden.',
    evidence: event.evidence,
    ...action,
  };
}

function sourceOrder(item: PlanChangeInboxItem): number {
  if (item.id === 'refresh-preview') return 0;
  if (item.id.startsWith('adaptation-') && item.priority === 'action') return 1;
  if (item.id === 'garmin-sync-debt') return 2;
  if (item.id.startsWith('adaptation-')) return 3;
  return 4;
}

function summaryFor(items: PlanChangeInboxItem[]): string {
  if (items.length === 0) {
    return 'Keine offenen Planänderungen. Woche, Garmin-Handoff und Adaptionssignale wirken aktuell geschlossen.';
  }
  const categories = [
    items.some(item => item.id === 'refresh-preview') ? 'Wochenplan prüfen' : null,
    items.some(item => item.id.startsWith('adaptation-')) ? 'Planabweichung bewerten' : null,
    items.some(item => item.id === 'garmin-sync-debt') ? 'Garmin absichern' : null,
  ].filter(Boolean);
  return `${items.length} offene Planpunkte: ${categories.join(', ')}.`;
}

export function buildPlanChangeInbox(input: PlanChangeInboxInput): PlanChangeInbox {
  const items = [
    buildRefreshItem(input.refreshPreview),
    buildGarminDebtItem(input.workouts, input.today),
    ...input.adaptationEvents.map(buildEventItem),
  ]
    .filter((item): item is PlanChangeInboxItem => item != null)
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || sourceOrder(a) - sourceOrder(b));

  return {
    summary: summaryFor(items),
    hasAction: items.some(item => item.priority === 'action'),
    items,
  };
}
