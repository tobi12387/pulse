import type { PulseNextBestAction, PulseNextBestActionPriority, PulseNextBestActionSource } from '@coaching-os/shared/pulse';

export interface NextBestActionsInput {
  today: string;
  todayCheckin: unknown | null;
  activeRiskSignals: Array<{
    severity: 'info' | 'warn' | 'critical';
    title: string;
    recommendation: string;
    ruleId: string;
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
}

const PRIORITY_WEIGHT: Record<PulseNextBestActionPriority, number> = {
  critical: 3,
  high: 2,
  normal: 1,
};

function addAction(
  actions: PulseNextBestAction[],
  source: PulseNextBestActionSource,
  priority: PulseNextBestActionPriority,
  title: string,
  reason: string,
  cta: string,
  targetPath: string,
): void {
  actions.push({
    id: `${source}:${targetPath}:${actions.length}`,
    source,
    priority,
    title,
    reason,
    cta,
    targetPath,
  });
}

function hoursSince(startTime: Date, today: string): number {
  const todayNoon = new Date(`${today}T12:00:00.000Z`).getTime();
  return (todayNoon - startTime.getTime()) / 3_600_000;
}

export function rankNextBestActions(input: NextBestActionsInput): PulseNextBestAction[] {
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
    );
  }

  return actions
    .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])
    .slice(0, 3);
}
