import { describe, expect, it } from 'vitest';
import type { PulseFuelingPreferences } from '@coaching-os/shared/pulse';
import {
  buildFuelingRecoveryGuidance,
  type FuelingRecoveryWorkoutInput,
} from './fueling-recovery-guidance.js';

const preferences: PulseFuelingPreferences = {
  fuelingEnabled: true,
  dietaryConstraints: [],
  preferredFuelingProducts: 'Ministry',
  carbGuidanceStyle: 'suggest_ranges',
  sodiumGuidanceStyle: 'suggest_ranges',
  bodyWeightGuidanceEnabled: true,
};

function workout(overrides: Partial<FuelingRecoveryWorkoutInput> = {}): FuelingRecoveryWorkoutInput {
  const base: FuelingRecoveryWorkoutInput = {
    id: 'workout-1',
    plannedDate: '2026-05-06',
    activityType: 'bike',
    zone: 2,
    durationMin: 45,
    targetTss: 35,
    description: 'Locker rollen.',
  };
  return { ...base, ...overrides };
}

describe('buildFuelingRecoveryGuidance', () => {
  it('stays quiet for short easy workouts when recovery is normal', () => {
    const guidance = buildFuelingRecoveryGuidance({
      workout: workout({ durationMin: 40, zone: 2 }),
      preferences,
      profile: { weightKg: 80 },
      recovery: { readinessScore: 78, sleepDebt7dH: 1.5, hrvStatus: 'stable' },
    });

    expect(guidance.shouldShow).toBe(false);
    expect(guidance.before).toHaveLength(0);
    expect(guidance.during).toHaveLength(0);
    expect(guidance.evidence).toContainEqual(expect.objectContaining({
      label: 'Workout',
      value: '40 min Zone 2',
      status: 'supporting',
    }));
  });

  it('shows a recovery-first card for short easy workouts when recovery is poor', () => {
    const guidance = buildFuelingRecoveryGuidance({
      workout: workout({ durationMin: 40, zone: 1 }),
      preferences,
      recovery: { readinessScore: 38, sleepDebt7dH: 6.5, hrvStatus: 'declining', bodyBatteryMax: 34 },
    });

    expect(guidance.shouldShow).toBe(true);
    expect(guidance.recoveryCautions.join(' ')).toContain('Schlafdefizit');
    expect(guidance.after.map(item => item.text).join(' ')).toContain('Recovery');
    expect(guidance.during.map(item => item.text).join(' ')).toContain('Wasser');
  });

  it('builds pre during and post guidance for long bike sessions with Ministry as product anchor', () => {
    const guidance = buildFuelingRecoveryGuidance({
      workout: workout({ durationMin: 180, zone: 3, targetTss: 145 }),
      preferences,
      profile: { weightKg: 80 },
      recovery: { readinessScore: 72, sleepDebt7dH: 2, hrvStatus: 'stable' },
    });

    expect(guidance.shouldShow).toBe(true);
    expect(guidance.before.map(item => item.text).join(' ')).toContain('80-160 g');
    expect(guidance.during.map(item => item.text).join(' ')).toContain('60-90 g Kohlenhydrate pro Stunde');
    expect(guidance.during.map(item => item.text).join(' ')).toContain('180-270 g gesamt');
    expect(guidance.during.map(item => item.text).join(' ')).toContain('7-11 Gel-Äquivalente');
    expect(guidance.during.map(item => item.text).join(' ')).toContain('Ministry');
    expect(guidance.during.map(item => item.text).join(' ')).toContain('400-800 mg Sodium pro Liter');
    expect(guidance.during.map(item => item.text).join(' ')).toContain('300-600 mg pro 750 ml');
    expect(guidance.after.map(item => item.text).join(' ')).toContain('0,8-1,0 g/kg');
  });

  it('calibrates Ministry anchors to Tobi confirmed MNSTRY products without treating BICARB as an everyday gel', () => {
    const guidance = buildFuelingRecoveryGuidance({
      workout: workout({ durationMin: 180, zone: 3, targetTss: 145 }),
      preferences,
      profile: { weightKg: 80 },
      recovery: { readinessScore: 72, sleepDebt7dH: 2, hrvStatus: 'stable' },
    });

    const before = guidance.before.map(item => item.text).join(' ');
    const during = guidance.during.map(item => item.text).join(' ');
    const after = guidance.after.map(item => item.text).join(' ');

    expect(before).toContain('PORRIDGE BAR Sour Cherry');
    expect(during).toContain('POWER CARB Sour Cherry 1:0.8');
    expect(during).toContain('2-3 x 750-ml-Flaschen');
    expect(during).toContain('je ca. 95 g Pulver');
    expect(during).toContain('190-285 g Pulver gesamt');
    expect(during).toContain('ca. 360 mg Natrium pro 750 ml');
    expect(during).not.toContain('500-ml-Flaschen');
    expect(during).not.toContain('pro 500 ml');
    expect(during).not.toContain('BICARB GEL 40 Lemon');
    expect(after).toContain('PROTEIN BAR 8 Peanut & Cranberry');
    expect(after).toContain('14 g Protein');
  });

  it('only offers BICARB GEL Lemon for race week or high intensity contexts', () => {
    const steadyGuidance = buildFuelingRecoveryGuidance({
      workout: workout({ durationMin: 120, zone: 2 }),
      preferences,
    });
    const raceGuidance = buildFuelingRecoveryGuidance({
      workout: workout({ activityType: 'bike', durationMin: 90, zone: 4 }),
      preferences,
      race: { title: 'Kraichgau 70.3', phase: 'race_week', daysUntil: 4 },
    });

    expect(steadyGuidance.during.map(item => item.text).join(' ')).not.toContain('BICARB GEL 40 Lemon');
    expect(raceGuidance.during.map(item => item.text).join(' ')).toContain('BICARB GEL 40 Lemon 1:0.8');
    expect(raceGuidance.during.map(item => item.text).join(' ')).toContain('1 bis maximal 3');
  });

  it('lowers complexity when sleep debt and HRV are weak', () => {
    const guidance = buildFuelingRecoveryGuidance({
      workout: workout({ activityType: 'run', durationMin: 110, zone: 3 }),
      preferences,
      profile: { weightKg: 80 },
      recovery: { readinessScore: 42, sleepDebt7dH: 7.2, hrvStatus: 'declining', bodyBatteryMax: 38 },
    });

    expect(guidance.shouldShow).toBe(true);
    expect(guidance.during.map(item => item.text).join(' ')).toContain('30-45 g Kohlenhydrate pro Stunde');
    expect(guidance.recoveryCautions.join(' ')).toContain('einfach');
    expect(guidance.evidence).toContainEqual(expect.objectContaining({
      label: 'Recovery',
      status: 'caution',
    }));
  });

  it('keeps race-week guidance conservative and avoids new experiments', () => {
    const guidance = buildFuelingRecoveryGuidance({
      workout: workout({ activityType: 'run', durationMin: 95, zone: 2 }),
      preferences,
      profile: { weightKg: 80 },
      race: { title: 'Kraichgau 70.3', phase: 'race_week', daysUntil: 4 },
    });

    expect(guidance.shouldShow).toBe(true);
    expect(guidance.before.map(item => item.text).join(' ')).toContain('nichts Neues');
    expect(guidance.evidence).toContainEqual(expect.objectContaining({
      label: 'Race Context',
      value: 'Kraichgau 70.3 in 4 Tagen',
      status: 'caution',
    }));
  });

  it('returns a disabled preference status without prescription when fueling is off', () => {
    const guidance = buildFuelingRecoveryGuidance({
      workout: workout({ durationMin: 180, zone: 3 }),
      preferences: { ...preferences, fuelingEnabled: false },
    });

    expect(guidance.shouldShow).toBe(false);
    expect(guidance.preferenceStatus).toBe('disabled');
    expect(guidance.during).toHaveLength(0);
  });
});
