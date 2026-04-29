import { describe, it, expect } from 'vitest';
import {
  READINESS_BUCKETS,
  TSB_BUCKETS,
  bucketize,
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
});
