import type {
  PulseGuidedCheckinResponse,
  PulseNextBestAction,
  PulseNextBestActionPriority,
  PulseNextBestActionSource,
  PulseSuppressedActionState,
} from '@coaching-os/shared/pulse';
import { getActionSuppression, type ActionDecisionRecord } from './decision-closure.js';

export interface NextBestActionsInput {
  today: string;
  todayCheckin: unknown | null;
  activeRiskSignals: Array<{
    severity: 'info' | 'warn' | 'critical';
    title: string;
    recommendation: string;
    ruleId: string;
    triggeredAt?: string;
  }>;
  recentActivities: Array<{
    id: string;
    startTime: Date;
    activityType: string;
    durationSec: number | null;
    rpe: number | null;
    plannedZone: number | null;
  }>;
  upcomingWorkouts: Array<{
    plannedDate: string;
    activityType: string;
    zone: number;
    durationMin: number;
  }>;
  push: {
    configured: boolean;
    activeSubscriptions: number;
  };
  equipmentDueForReplacement: Array<{
    name: string;
    category: string;
    pctConsumed: number;
  }>;
  guidedCheckin?: PulseGuidedCheckinResponse | null;
  actionDecisions?: ActionDecisionRecord[];
}

const PRIORITY_WEIGHT: Record<PulseNextBestActionPriority, number> = {
  critical: 3,
  high: 2,
  normal: 1,
};

export interface ActionVisibilitySummary {
  visible: PulseNextBestAction[];
  suppressed: PulseSuppressedActionState[];
}

function addAction(
  actions: PulseNextBestAction[],
  source: PulseNextBestActionSource,
  priority: PulseNextBestActionPriority,
  title: string,
  reason: string,
  cta: string,
  targetPath: string,
  details: {
    openedAt?: string | null;
    resolvedBy: string;
    evidence?: string[];
  },
): void {
  actions.push({
    id: `${source}:${targetPath}:${actions.length}`,
    source,
    priority,
    title,
    reason,
    cta,
    targetPath,
    openedAt: details.openedAt ?? null,
    resolvedBy: details.resolvedBy,
    evidence: details.evidence ?? [],
  });
}

function hoursSince(startTime: Date, today: string): number {
  const todayNoon = new Date(`${today}T12:00:00.000Z`).getTime();
  return (todayNoon - startTime.getTime()) / 3_600_000;
}

export function rankNextBestActions(input: NextBestActionsInput): PulseNextBestAction[] {
  return rankNextBestActionVisibility(input).visible;
}

export function rankNextBestActionVisibility(input: NextBestActionsInput): ActionVisibilitySummary {
  const actions: PulseNextBestAction[] = [];

  const criticalRisk = input.activeRiskSignals.find(signal => signal.severity === 'critical') ?? null;
  const warningRisk = input.activeRiskSignals.find(signal => signal.severity === 'warn') ?? null;
  const risk = criticalRisk ?? warningRisk;
  if (risk) {
    addAction(
      actions,
      'risk',
      risk.severity === 'critical' ? 'critical' : 'high',
      risk.severity === 'critical' ? 'Kritisches Risk-Signal prüfen' : 'Risk-Signal prüfen',
      `${risk.title}: ${risk.recommendation}`,
      'Risk ansehen',
      '/',
      {
        openedAt: risk.triggeredAt ?? input.today,
        resolvedBy: 'Risk-Signal snoozen oder auflösen.',
        evidence: [risk.ruleId, risk.severity],
      },
    );
  }

  if (!input.todayCheckin) {
    addAction(
      actions,
      'checkin',
      'high',
      'Check-in eintragen',
      'Heute fehlt dein subjektives Signal; Coach, Readiness und Briefing bleiben dadurch vorsichtiger.',
      'Zum Coach',
      '/coach',
      {
        openedAt: input.today,
        resolvedBy: `Check-in für ${input.today} speichern.`,
        evidence: ['Tages-Check-in fehlt'],
      },
    );
  }

  const unratedRecentActivity = input.recentActivities
    .filter(activity => activity.durationSec != null && activity.durationSec > 0)
    .find(activity => activity.rpe == null && hoursSince(activity.startTime, input.today) <= 48);
  if (unratedRecentActivity) {
    addAction(
      actions,
      'rpe',
      'high',
      'RPE nachtragen',
      `Die letzte ${unratedRecentActivity.activityType}-Einheit hat noch kein Belastungsfeedback; das hilft dem nächsten Plan.`,
      'Feedback öffnen',
      `/activity/${unratedRecentActivity.id}`,
      {
        openedAt: unratedRecentActivity.startTime.toISOString(),
        resolvedBy: 'RPE-Feedback für diese Aktivität speichern.',
        evidence: [
          `${Math.max(0, Math.round(hoursSince(unratedRecentActivity.startTime, input.today)))}h offen`,
          unratedRecentActivity.plannedZone != null ? `Plan-Zone ${unratedRecentActivity.plannedZone}` : 'Ohne Plan-Zone',
        ],
      },
    );
  }

  if (input.upcomingWorkouts.length === 0) {
    addAction(
      actions,
      'plan',
      'normal',
      'Plan erzeugen',
      'Es gibt aktuell kein geplantes Training; Pulse kann die nächste Woche aus Zielen, Last, RPE und Risiken ableiten.',
      'Zum Plan',
      '/plan',
      {
        openedAt: input.today,
        resolvedBy: 'Plan erzeugen oder Wochenverfügbarkeit speichern.',
        evidence: ['Keine geplanten Workouts ab heute'],
      },
    );
  }

  if (input.push.configured && input.push.activeSubscriptions === 0) {
    addAction(
      actions,
      'push',
      'normal',
      'Push aktivieren',
      'Der Server ist bereit, aber dieser Account hat noch kein aktives Gerät für Briefings und kritische Hinweise.',
      'Settings öffnen',
      '/settings',
      {
        openedAt: input.today,
        resolvedBy: 'Push in Settings aktivieren.',
        evidence: ['0 aktive Push-Geräte', 'VAPID konfiguriert'],
      },
    );
  }

  const dueEquipment = input.equipmentDueForReplacement[0] ?? null;
  if (dueEquipment) {
    addAction(
      actions,
      'equipment',
      'normal',
      'Equipment prüfen',
      `${dueEquipment.name} ist zu ${dueEquipment.pctConsumed.toFixed(0)}% der Laufleistung verbraucht.`,
      'Settings öffnen',
      '/settings',
      {
        openedAt: input.today,
        resolvedBy: 'Equipment ersetzen oder Limit anpassen.',
        evidence: [dueEquipment.category, `${dueEquipment.pctConsumed.toFixed(0)}% verbraucht`],
      },
    );
  }

  if (input.guidedCheckin?.action) {
    const mentalAction = input.guidedCheckin.action;
    const primaryQuestionId = input.guidedCheckin.questions[0]?.id ?? 'guided-checkin';
    addAction(
      actions,
      'mental',
      'normal',
      mentalAction.label,
      mentalAction.rationale,
      'Im Coach öffnen',
      mentalAction.targetRoute,
      {
        openedAt: input.guidedCheckin.date,
        resolvedBy: 'Mentale Support-Aktion abschließen, verschieben oder bewusst verwerfen.',
        evidence: [mentalAction.closureKind, primaryQuestionId],
      },
    );
  }

  const visible: PulseNextBestAction[] = [];
  const suppressed: PulseSuppressedActionState[] = [];
  const signals = {
      today: input.today,
      checkinDates: input.todayCheckin ? [input.today] : [],
    };

  for (const action of actions.sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])) {
    const suppression = getActionSuppression(action, input.actionDecisions ?? [], signals);
    if (suppression) {
      suppressed.push({
        ...action,
        decisionId: suppression.decisionId,
        status: suppression.status,
        suppressedReason: suppression.reason,
        suppressedUntil: suppression.suppressedUntil,
        resolvedAt: suppression.resolvedAt,
        resolutionReason: suppression.resolutionReason,
      });
      continue;
    }
    visible.push(action);
  }

  return {
    visible: visible.slice(0, 3),
    suppressed: suppressed.slice(0, 6),
  };
}
