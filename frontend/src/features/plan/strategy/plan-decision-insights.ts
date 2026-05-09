import type { PulsePlanDecision } from '@coaching-os/shared/pulse';

export type PlanDecisionEvidenceGroupId =
  | 'fueling'
  | 'recovery'
  | 'capability'
  | 'variation'
  | 'availability'
  | 'goal'
  | 'other';

export type PlanDecisionEvidenceTone = 'accent' | 'green' | 'amber' | 'rose' | 'muted';

export interface PlanDecisionEvidenceGroup {
  id: PlanDecisionEvidenceGroupId;
  label: string;
  tone: PlanDecisionEvidenceTone;
  reasons: string[];
}

export interface PlanDecisionEvidence {
  summary: string;
  groups: PlanDecisionEvidenceGroup[];
}

interface PlanDecisionRule {
  id: PlanDecisionEvidenceGroupId;
  patterns: RegExp[];
}

const GROUP_RULES: PlanDecisionRule[] = [
  {
    id: 'fueling',
    patterns: [/fuel/i, /verpflegung/i, /nutrition/i, /magen/i, /\bgi\b/i, /carb/i, /kohlenhydrat/i, /pulver/i, /flasche/i, /gel/i],
  },
  {
    id: 'recovery',
    patterns: [/tsb/i, /\brpe\b/i, /erholung/i, /recovery/i, /schlaf/i, /\bhrv\b/i, /body battery/i, /ruhe/i, /belastung/i, /mued/i, /müd/i, /fatigue/i, /risk/i, /risiko/i],
  },
  {
    id: 'capability',
    patterns: [/level-fit/i, /capability/i, /produkt/i, /stretch/i, /erhaltung/i, /zu hart/i, /workout-level/i],
  },
  {
    id: 'variation',
    patterns: [/variation/i, /vorwoche/i, /ähnlich/i, /aehnlich/i, /anders/i, /rotation/i, /rotiert/i, /sportmix/i, /archetyp/i, /lernsignal/i],
  },
  {
    id: 'availability',
    patterns: [/verfüg/i, /verfueg/i, /\bfrei\b/i, /reserve/i, /ruhetag/i, /freie tage/i],
  },
  {
    id: 'goal',
    patterns: [/zieltermin/i, /ziel:\s/i, /race/i, /wettkampf/i, /\ba-race\b/i, /\bb-race\b/i, /\bc-race\b/i, /taper/i, /peak/i, /saisonlast/i, /saisonlinie/i, /limiter/i],
  },
];

const GROUP_LABELS: Record<PlanDecisionEvidenceGroupId, Omit<PlanDecisionEvidenceGroup, 'reasons'>> = {
  fueling: { id: 'fueling', label: 'Fueling', tone: 'amber' },
  recovery: { id: 'recovery', label: 'Erholung', tone: 'rose' },
  capability: { id: 'capability', label: 'Level-Fit', tone: 'green' },
  variation: { id: 'variation', label: 'Variation', tone: 'accent' },
  availability: { id: 'availability', label: 'Freie Tage', tone: 'muted' },
  goal: { id: 'goal', label: 'Zielbezug', tone: 'green' },
  other: { id: 'other', label: 'Weitere Gründe', tone: 'muted' },
};

function categoryForReason(reason: string): PlanDecisionEvidenceGroupId {
  return GROUP_RULES.find(rule => rule.patterns.some(pattern => pattern.test(reason)))?.id ?? 'other';
}

function skippedAvailableDaysLabel(count: number): string | null {
  if (count === 0) return null;
  if (count === 1) return '1 freier verfügbarer Tag';
  return `${count} freie verfügbare Tage`;
}

export function buildPlanDecisionEvidence(decision: PulsePlanDecision): PlanDecisionEvidence {
  const grouped = new Map<PlanDecisionEvidenceGroupId, string[]>();

  for (const reason of decision.reasons) {
    const category = categoryForReason(reason);
    grouped.set(category, [...(grouped.get(category) ?? []), reason]);
  }

  const groups = (Object.keys(GROUP_LABELS) as PlanDecisionEvidenceGroupId[])
    .map(id => ({ ...GROUP_LABELS[id], reasons: grouped.get(id) ?? [] }))
    .filter(group => group.reasons.length > 0);

  const summaryParts = [
    `${decision.targetSessionCount} ${decision.targetSessionCount === 1 ? 'Einheit' : 'Einheiten'}`,
    decision.primaryGoal ? `Ziel: ${decision.primaryGoal}` : null,
    skippedAvailableDaysLabel(decision.skippedAvailableDays.length),
  ].filter((part): part is string => Boolean(part));

  return {
    summary: summaryParts.join(' · '),
    groups,
  };
}
