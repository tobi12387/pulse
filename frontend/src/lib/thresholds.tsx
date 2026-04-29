import {
  READINESS_BUCKETS,
  TSB_BUCKETS,
  type Bucket,
  type ColorToken,
} from '@coaching-os/shared/pulse-thresholds';

export const COLOR_VAR: Record<ColorToken, string> = {
  green: 'var(--green)',
  amber: 'var(--amber)',
  rose: 'var(--rose)',
  blue: 'var(--blue)',
  'text-2': 'var(--text-2)',
  'text-3': 'var(--text-3)',
};

export interface BucketTooltipDef {
  title: string;
  what: string;
  ranges: Bucket[];
}

export function colorOf(token: ColorToken): string {
  return COLOR_VAR[token];
}

export function bucketTooltip(metric: 'TSB' | 'READINESS'): BucketTooltipDef {
  if (metric === 'TSB') {
    return {
      title: 'Training Stress Balance',
      what: 'Form = CTL minus ATL. Zeigt, ob du frisch, im Aufbau oder akut übermüdet bist.',
      ranges: TSB_BUCKETS,
    };
  }

  return {
    title: 'Readiness',
    what: 'Tagesform aus Schlaf, HRV, TSB, Body Battery, mentalem Check-in und Stress.',
    ranges: READINESS_BUCKETS,
  };
}

export function formatBucketMin(min: number): string {
  if (min === -Infinity) return '< vorherige';
  return min >= 0 ? `>= +${min}` : `>= ${min}`;
}
