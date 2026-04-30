export type ColorToken = 'green' | 'amber' | 'rose' | 'blue' | 'text-2' | 'text-3';

export interface Bucket {
  min: number;
  label: string;
  shortLabel?: string;
  color: ColorToken;
  description: string;
}

export const TSB_BUCKETS: Bucket[] = [
  {
    min: 25,
    label: 'sehr frisch',
    color: 'amber',
    description: 'Untertraining oder Detraining-Risiko: zu lange in TSB > 25 kann Form kosten.',
  },
  {
    min: 5,
    label: 'frisch',
    color: 'green',
    description: 'Erholt: gute Tage für Schlüsseleinheiten oder Wettkampf.',
  },
  {
    min: -10,
    label: 'optimal',
    color: 'green',
    description: 'Ausgewogen: nominale Trainingszone mit hohem Adaptions-Potenzial.',
  },
  {
    min: -20,
    label: 'aufbauend',
    color: 'amber',
    description: 'Akkumulierte Belastung: funktional, aber Schlüsseleinheiten reduzieren.',
  },
  {
    min: -Infinity,
    label: 'übermüdet',
    color: 'rose',
    description: 'Hohe akute Ermüdung: Verletzungsrisiko, Erholung priorisieren.',
  },
];

export const READINESS_BUCKETS: Bucket[] = [
  {
    min: 80,
    label: 'optimal',
    shortLabel: 'OPTIMAL',
    color: 'green',
    description: 'Vollständig erholt: Z4/Z5 möglich.',
  },
  {
    min: 65,
    label: 'gut',
    shortLabel: 'GUT',
    color: 'green',
    description: 'Gut erholt: Plan wie geplant.',
  },
  {
    min: 45,
    label: 'mäßig',
    shortLabel: 'MÄSSIG',
    color: 'amber',
    description: 'Anzeichen von Müdigkeit: Intensität reduzieren.',
  },
  {
    min: 0,
    label: 'erholen',
    shortLabel: 'ERHOLEN',
    color: 'rose',
    description: 'Erholungs-Tag: Z1, aktive Recovery oder frei.',
  },
];

export const HRV_STATUS_MAP: Record<string, { score: number; label: string; color: ColorToken }> = {
  above_normal: { score: 100, label: 'überdurchschnittlich', color: 'green' },
  balanced:     { score: 80,  label: 'ausgewogen',            color: 'green' },
  normal:       { score: 80,  label: 'normal',                 color: 'green' },
  below_normal: { score: 50,  label: 'unter Norm',             color: 'amber' },
  poor:         { score: 25,  label: 'schwach',                color: 'rose' },
};

export const RPE_BUCKETS: Bucket[] = [
  {
    min: 8,
    label: 'sehr hart',
    color: 'rose',
    description: 'Maximale Anstrengung, Z4/Z5 typisch.',
  },
  {
    min: 6,
    label: 'fordernd',
    color: 'amber',
    description: 'Z3-Tempo-Bereich, für etwa 30 Minuten nachhaltig.',
  },
  {
    min: 4,
    label: 'mittel',
    color: 'green',
    description: 'Z2-Endurance, nachhaltig und kontrolliert.',
  },
  {
    min: 1,
    label: 'locker',
    color: 'blue',
    description: 'Z1/Recovery, leichte Unterhaltung moeglich.',
  },
];

export function bucketize(value: number, buckets: Bucket[]): Bucket {
  for (const bucket of buckets) {
    if (value >= bucket.min) return bucket;
  }
  return buckets[buckets.length - 1]!;
}

export interface HrTargetRange {
  zone: number;
  minBpm: number | null;
  maxBpm: number | null;
  label: string;
  basis: 'lthr' | 'max_hr_estimate';
}

export function estimateLthrBpm(maxHrBpm: number, lthrBpm?: number | null): { value: number; basis: HrTargetRange['basis'] } {
  if (lthrBpm != null && lthrBpm > 0) return { value: lthrBpm, basis: 'lthr' };
  return { value: Math.round(maxHrBpm * 0.92), basis: 'max_hr_estimate' };
}

export function hrTargetRangeForZone(zone: number, maxHrBpm: number, lthrBpm?: number | null): HrTargetRange {
  const normalizedZone = Math.max(1, Math.min(5, Math.round(zone)));
  const lthr = estimateLthrBpm(maxHrBpm, lthrBpm);
  const pct = (value: number) => Math.round(lthr.value * value / 100);

  if (normalizedZone === 1) {
    const maxBpm = pct(81);
    return { zone: normalizedZone, minBpm: null, maxBpm, label: `<${maxBpm} bpm`, basis: lthr.basis };
  }
  if (normalizedZone === 2) {
    const minBpm = pct(82);
    const maxBpm = pct(88);
    return { zone: normalizedZone, minBpm, maxBpm, label: `${minBpm}-${maxBpm} bpm`, basis: lthr.basis };
  }
  if (normalizedZone === 3) {
    const minBpm = pct(89);
    const maxBpm = pct(93);
    return { zone: normalizedZone, minBpm, maxBpm, label: `${minBpm}-${maxBpm} bpm`, basis: lthr.basis };
  }
  if (normalizedZone === 4) {
    const minBpm = pct(94);
    const maxBpm = pct(99);
    return { zone: normalizedZone, minBpm, maxBpm, label: `${minBpm}-${maxBpm} bpm`, basis: lthr.basis };
  }

  const minBpm = lthr.value;
  return { zone: normalizedZone, minBpm, maxBpm: null, label: `>${minBpm} bpm`, basis: lthr.basis };
}
