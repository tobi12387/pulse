import { desc, eq } from 'drizzle-orm';
import type { PulseActionState, PulseNextBestAction } from '@coaching-os/shared/pulse';
import { db } from '../../lib/db.js';
import { pulseActionDecisions } from '../../db/pulse-schema.js';
import { actionDateMatchesDecision } from './decision-closure.js';

export type ActionDecisionRow = typeof pulseActionDecisions.$inferSelect;

export function buildActionPushUrl(action: PulseNextBestAction, decisionId: string): string {
  const params = new URLSearchParams({
    actionId: action.id,
    decisionId,
  });
  const separator = action.targetPath.includes('?') ? '&' : '?';
  return `${action.targetPath}${separator}${params.toString()}`;
}

export function selectPushJourneyAction(actions: PulseNextBestAction[]): PulseNextBestAction | null {
  return actions.find(action => action.priority === 'critical' || action.priority === 'high') ?? null;
}

export function actionStateFromDecision(action: PulseNextBestAction, row: ActionDecisionRow): PulseActionState {
  return {
    ...action,
    decisionId: row.id,
    status: row.status as PulseActionState['status'],
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionReason: row.resolutionReason ?? null,
  };
}

export function matchesActionDecision(action: PulseNextBestAction, row: ActionDecisionRow): boolean {
  if (!actionDateMatchesDecision(action, {
    kind: row.kind,
    source: row.source,
    createdAt: row.createdAt,
    rawContext: row.rawContext,
  })) {
    return false;
  }

  if (row.sourceId === action.id) return true;
  if (row.kind !== action.source) return false;
  return row.targetRoute === action.targetPath || row.title === action.title;
}

export function selectRecentResolvedActionDecisions(
  rows: ActionDecisionRow[],
  today: string,
  limit = 10,
): ActionDecisionRow[] {
  const cutoff = new Date(`${today}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 13);

  return rows
    .filter(row => row.status !== 'open')
    .filter(row => (row.resolvedAt ?? row.createdAt).getTime() >= cutoff.getTime())
    .slice(0, limit);
}

export async function listActionDecisionRows(userId: string): Promise<ActionDecisionRow[]> {
  return db.select().from(pulseActionDecisions)
    .where(eq(pulseActionDecisions.userId, userId))
    .orderBy(desc(pulseActionDecisions.createdAt))
    .limit(100);
}

export async function ensureActionDecisionForAction(
  userId: string,
  action: PulseNextBestAction,
  existingRows: ActionDecisionRow[] = [],
): Promise<ActionDecisionRow> {
  const existing = existingRows.find(row => matchesActionDecision(action, row));
  if (existing) return existing;

  const [created] = await db.insert(pulseActionDecisions).values({
    userId,
    source: 'next_best_action',
    sourceId: action.id,
    kind: action.source,
    title: action.title,
    status: 'open',
    targetRoute: action.targetPath,
    rawContext: {
      actionId: action.id,
      openedAt: action.openedAt ?? null,
      priority: action.priority,
      evidence: action.evidence ?? [],
    },
  }).returning();

  return created!;
}
