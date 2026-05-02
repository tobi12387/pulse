import { describe, expect, it } from 'vitest';
import { buildRaceCommandSummary } from './race-command.js';

function baseInput(overrides: Partial<Parameters<typeof buildRaceCommandSummary>[0]> = {}): Parameters<typeof buildRaceCommandSummary>[0] {
  return {
    today: '2026-05-02',
    races: [],
    fitnessLoad: { ctl: 48.2, atl: 44.1, tsb: 4.1 },
    plannedWorkouts: [],
    healthStates: [],
    riskSignals: [],
    ...overrides,
  };
}

describe('buildRaceCommandSummary', () => {
  it('highlights next key workout and recovery boundary for an A-race in taper', () => {
    const command = buildRaceCommandSummary(baseInput({
      races: [{
        goalId: 'race-1',
        title: '70.3 Kraichgau',
        date: '2026-05-12',
        daysUntil: 10,
        phase: 'taper',
        discipline: 'triathlon_70_3',
        distanceKm: 113,
        targetTimeSec: 18_000,
        priority: 'A',
        predictedTimeSec: null,
        predictionConfidence: null,
        location: 'Kraichgau',
        notes: 'A-Rennen',
      }],
      plannedWorkouts: [
        { id: 'easy-1', plannedDate: '2026-05-03', activityType: 'run', zone: 2, durationMin: 45, targetTss: 35, description: 'Locker' },
        { id: 'key-1', plannedDate: '2026-05-05', activityType: 'bike', zone: 4, durationMin: 75, targetTss: 82, description: 'Race-pace Intervalle' },
      ],
    }));

    expect(command).not.toBeNull();
    expect(command?.phase.label).toBe('Taper');
    expect(command?.nextKeyWorkout).toMatchObject({
      id: 'key-1',
      plannedDate: '2026-05-05',
      zone: 4,
      reason: expect.stringContaining('Schlüsselreiz'),
    });
    expect(command?.recoveryBoundary.label).toContain('Taper');
    expect(command?.readinessLabel).toBe('Bereit');
  });

  it('lowers readiness when illness and critical risk signals are active', () => {
    const command = buildRaceCommandSummary(baseInput({
      races: [{
        goalId: 'race-1',
        title: 'Marathon',
        date: '2026-05-20',
        daysUntil: 18,
        phase: 'peak',
        discipline: 'run',
        distanceKm: 42.2,
        targetTimeSec: 13_500,
        priority: 'A',
        predictedTimeSec: 13_800,
        predictionConfidence: 'medium',
        location: null,
        notes: null,
      }],
      healthStates: [{ type: 'illness', severity: 'moderate', startDate: '2026-05-01', notes: 'Infekt' }],
      riskSignals: [{ severity: 'critical', title: 'Ruhepuls stark erhöht', recommendation: 'Heute kein intensives Training.' }],
    }));

    expect(command?.readinessStatus).toBe('compromised');
    expect(command?.riskImpact.status).toBe('blocked');
    expect(command?.riskImpact.reasons.join(' ')).toContain('Ruhepuls stark erhöht');
    expect(command?.riskImpact.reasons.join(' ')).toContain('illness');
  });

  it('returns null when no active race exists', () => {
    expect(buildRaceCommandSummary(baseInput())).toBeNull();
  });

  it('uses CTL and TSB values as evidence instead of static copy', () => {
    const command = buildRaceCommandSummary(baseInput({
      fitnessLoad: { ctl: 52.4, atl: 64.5, tsb: -12.1 },
      races: [{
        goalId: 'race-1',
        title: '10k Test',
        date: '2026-06-01',
        daysUntil: 30,
        phase: 'build',
        discipline: 'run',
        distanceKm: 10,
        targetTimeSec: 2_700,
        priority: 'B',
        predictedTimeSec: 2_760,
        predictionConfidence: 'high',
        location: 'Berlin',
        notes: null,
      }],
    }));

    expect(command?.evidence).toContain('CTL 52.4');
    expect(command?.evidence).toContain('TSB -12.1');
    expect(command?.readinessLabel).toBe('Beobachten');
  });
});
