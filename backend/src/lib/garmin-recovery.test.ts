import { describe, expect, it } from 'vitest';
import { normalizeGarminDailySummary, normalizeGarminSleepData } from './garmin-recovery.js';

describe('normalizeGarminSleepData', () => {
  it('extracts optional recovery-depth sleep signals without requiring every field', () => {
    const sleep = normalizeGarminSleepData({
      dailySleepDTO: {
        sleepStartTimestampGMT: '2026-04-30T21:42:00.000',
        sleepEndTimestampGMT: '2026-05-01T05:50:00.000',
        sleepTimeSeconds: 29_280,
        deepSleepSeconds: 5_400,
        lightSleepSeconds: 15_800,
        remSleepSeconds: 6_200,
        awakeSleepSeconds: 1_880,
        sleepScores: { overall: { value: 82 } },
        sleepNeedMinutes: 510,
        restlessMomentsCount: 24,
        averageRespiration: 13.8,
        averageHeartRate: 48,
        averageStressLevel: 17,
        bodyBatteryChange: 51,
        breathingDisruptionIndex: 3.2,
      },
      avgOvernightHrv: 54,
      hrvStatus: 'BALANCED',
    });

    expect(sleep.durationH).toBeCloseTo(8.13, 2);
    expect(sleep.startTime?.toISOString()).toBe('2026-04-30T21:42:00.000Z');
    expect(sleep.endTime?.toISOString()).toBe('2026-05-01T05:50:00.000Z');
    expect(sleep.sleepNeedMin).toBe(510);
    expect(sleep.sleepActualMin).toBe(488);
    expect(sleep.avgSleepStress).toBe(17);
    expect(sleep.avgSleepHr).toBe(48);
    expect(sleep.avgRespiration).toBe(13.8);
    expect(sleep.restlessMoments).toBe(24);
    expect(sleep.bodyBatteryChange).toBe(51);
    expect(sleep.breathingDisruptionIndex).toBe(3.2);
    expect(sleep.hrvStatus).toBe('balanced');
  });
});

describe('normalizeGarminDailySummary', () => {
  it('extracts Body Battery, stress distribution, intensity, respiration and SpO2 signals', () => {
    const daily = normalizeGarminDailySummary({
      totalSteps: 8_742,
      activeKilocalories: 612,
      averageStressLevel: 31,
      maxStressLevel: 76,
      lowStressDuration: 14_400,
      mediumStressDuration: 5_400,
      highStressDuration: 2_700,
      minBodyBatteryLevel: 34,
      maxBodyBatteryLevel: 89,
      bodyBatteryMostRecentValue: 62,
      bodyBatteryChargedValue: 47,
      bodyBatteryDrainedValue: 55,
      bodyBatteryAtWake: 74,
      moderateIntensityMinutes: 32,
      vigorousIntensityMinutes: 12,
      averageWakingRespirationValue: 14.6,
      latestSpo2: 96,
    });

    expect(daily.steps).toBe(8742);
    expect(daily.caloriesActive).toBe(612);
    expect(daily.stressAvg).toBe(31);
    expect(daily.maxStress).toBe(76);
    expect(daily.lowStressSec).toBe(14_400);
    expect(daily.mediumStressSec).toBe(5_400);
    expect(daily.highStressSec).toBe(2_700);
    expect(daily.bodyBatteryMin).toBe(34);
    expect(daily.bodyBatteryMax).toBe(62);
    expect(daily.bodyBatteryHighest).toBe(89);
    expect(daily.bodyBatteryLowest).toBe(34);
    expect(daily.bodyBatteryCharged).toBe(47);
    expect(daily.bodyBatteryDrained).toBe(55);
    expect(daily.bodyBatteryAtWake).toBe(74);
    expect(daily.moderateIntensityMin).toBe(32);
    expect(daily.vigorousIntensityMin).toBe(12);
    expect(daily.avgWakingRespiration).toBe(14.6);
    expect(daily.latestSpo2).toBe(96);
  });
});
