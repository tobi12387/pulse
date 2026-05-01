import { RPE_BUCKETS, bucketize } from '@coaching-os/shared/pulse-thresholds';
import { colorOf } from '@/lib/thresholds';

export function rpeColor(rpe: number): string {
  return colorOf(bucketize(rpe, RPE_BUCKETS).color);
}
