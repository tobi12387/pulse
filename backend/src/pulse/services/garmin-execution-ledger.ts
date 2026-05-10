import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, desc, eq } from 'drizzle-orm';
import type {
  PulseGarminExecutionLedgerEntry,
  PulseGarminExecutionOperation,
  PulseGarminExecutionOutcome,
  PulseGarminPayloadSnapshot,
  PulseGarminSyncContract,
  PulseGarminSyncContractIssue,
} from '@coaching-os/shared/pulse';
import { pulseGarminExecutionLedger } from '../../db/pulse-schema.js';

export interface RecordGarminExecutionInput {
  userId: string;
  plannedWorkoutId: string;
  operation: PulseGarminExecutionOperation;
  outcome: PulseGarminExecutionOutcome;
  localContract: PulseGarminSyncContract | null;
  remoteWorkoutId?: string | null;
  remoteScheduledId?: string | null;
  payloadSnapshot?: PulseGarminPayloadSnapshot | null;
  issues?: PulseGarminSyncContractIssue[];
  errorMessage?: string | null;
}

function summaryFor(input: Pick<RecordGarminExecutionInput, 'outcome' | 'errorMessage'>): string {
  if (input.outcome === 'ready') return 'Garmin-Ausfuehrung bereit und lokal verifiziert.';
  if (input.outcome === 'degraded') return 'Garmin-Ausfuehrung bereit, aber mit Einschraenkung.';
  if (input.outcome === 'blocked') return 'Garmin-Ausfuehrung blockiert; Payload vor Upload reparieren.';
  if (input.outcome === 'deleted') return 'Garmin-Remote fuer dieses Workout wurde entfernt.';
  return input.errorMessage
    ? `Garmin-Ausfuehrung fehlgeschlagen: ${input.errorMessage}`
    : 'Garmin-Ausfuehrung fehlgeschlagen.';
}

export async function recordGarminExecution(
  db: NodePgDatabase<any>,
  input: RecordGarminExecutionInput,
): Promise<void> {
  await db.insert(pulseGarminExecutionLedger).values({
    userId: input.userId,
    plannedWorkoutId: input.plannedWorkoutId,
    operation: input.operation,
    outcome: input.outcome,
    localContract: input.localContract,
    remoteWorkoutId: input.remoteWorkoutId ?? null,
    remoteScheduledId: input.remoteScheduledId ?? null,
    payloadSnapshot: input.payloadSnapshot ?? null,
    issues: input.issues ?? input.localContract?.issues ?? [],
    errorMessage: input.errorMessage ?? null,
  });
}

export async function listLatestGarminExecutionEntries(
  db: NodePgDatabase<any>,
  userId: string,
  plannedWorkoutId: string,
  limit = 5,
): Promise<PulseGarminExecutionLedgerEntry[]> {
  const rows = await db
    .select()
    .from(pulseGarminExecutionLedger)
    .where(and(
      eq(pulseGarminExecutionLedger.userId, userId),
      eq(pulseGarminExecutionLedger.plannedWorkoutId, plannedWorkoutId),
    ))
    .orderBy(desc(pulseGarminExecutionLedger.attemptedAt))
    .limit(limit);

  return rows.map(row => ({
    id: row.id,
    plannedWorkoutId: row.plannedWorkoutId,
    attemptedAt: row.attemptedAt.toISOString(),
    operation: row.operation,
    outcome: row.outcome,
    summary: summaryFor({ outcome: row.outcome, errorMessage: row.errorMessage }),
    payloadSnapshot: row.payloadSnapshot ?? null,
    issues: row.issues ?? [],
    errorMessage: row.errorMessage,
  }));
}
