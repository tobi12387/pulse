import { describe, it, expect } from 'vitest';
import {
  READINESS_BUCKETS,
  TSB_BUCKETS,
  bucketize,
  estimateLthrBpm,
  hrTargetRangeForZone,
} from '@coaching-os/shared/pulse-thresholds';

describe('pulse thresholds', () => {
  it('bucketizes readiness with canonical server/frontend boundaries', () => {
    expect(bucketize(62, READINESS_BUCKETS).label).toBe('mäßig');
  });

  it('bucketizes TSB build fatigue consistently', () => {
    expect(bucketize(-15, TSB_BUCKETS).label).toBe('aufbauend');
  });

  it('marks deeply negative TSB as rose', () => {
    expect(bucketize(-25, TSB_BUCKETS).color).toBe('rose');
  });

  it('provides compact readiness labels for tight UI', () => {
    expect(bucketize(80, READINESS_BUCKETS).shortLabel).toBe('OPTIMAL');
  });

  it('derives HR targets from LTHR when available', () => {
    expect(hrTargetRangeForZone(2, 185, 170)).toMatchObject({
      minBpm: 139,
      maxBpm: 150,
      label: '139-150 bpm',
      basis: 'lthr',
    });
  });

  it('falls back to max-HR-derived LTHR estimate', () => {
    expect(estimateLthrBpm(185, null)).toEqual({ value: 170, basis: 'max_hr_estimate' });
    expect(hrTargetRangeForZone(1, 185, null)).toMatchObject({ maxBpm: 138, label: '<138 bpm' });
  });
});
