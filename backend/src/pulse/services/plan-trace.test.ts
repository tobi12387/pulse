import { describe, expect, it } from 'vitest';
import { buildPlanTrace } from './plan-trace.js';

describe('buildPlanTrace', () => {
  it('summarizes data inputs, free days, sport mix, and hard days', () => {
    const trace = buildPlanTrace({
      phase: 'build',
      mesocycleWeek: 2,
      weeklyHoursTarget: 8,
      availableDays: [0, 2, 4, 5],
      load: { ctl: 42, atl: 50, tsb: -8, date: '2026-05-04' },
      profile: { ftpWatts: 260, maxHrBpm: 185, lthrBpm: 170 },
      goals: [{ title: 'FTP Aufbau', category: 'ftp', targetDate: null, raceDiscipline: null, raceDistanceKm: null, racePriority: null }],
      riskSignals: [{ ruleId: 'sleep_debt_5d', severity: 'warn', title: 'Schlafschuld' }],
      healthStates: [{ type: 'fatigue', severity: 'moderate', bodyPart: null, startDate: '2026-05-02', endDate: null }],
      recentActivities: [
        { date: '2026-05-01', activityType: 'bike', durationMin: 60, tss: 45, rpe: 8, plannedZone: 2 },
      ],
      planDecision: {
        selectedDays: [0, 2, 4],
        skippedAvailableDays: [5],
        targetSessionCount: 3,
        primaryGoal: 'ftp',
        reasons: ['FTP-Ziel: wenige, gezielte Reize statt viele Fülltage.', 'RPE-Signal: eine leichte bike-Einheit fühlte sich mit RPE 8/10 zu hart an.'],
      },
      workouts: [
        { plannedDate: '2026-05-04', activityType: 'bike', zone: 2, durationMin: 75, targetTss: 55 },
        { plannedDate: '2026-05-06', activityType: 'bike', zone: 4, durationMin: 50, targetTss: 80 },
        { plannedDate: '2026-05-08', activityType: 'strength', zone: 1, durationMin: 45, targetTss: 20 },
      ],
    });

    expect(trace.sportMix.bike).toMatchObject({ sessions: 2, totalMinutes: 125, totalTss: 135 });
    expect(trace.hardDays).toEqual([{ date: '2026-05-06', activityType: 'bike', zone: 4, durationMin: 50 }]);
    expect(trace.inputSnapshot.recentRpe).toHaveLength(1);
    expect(trace.inputSnapshot.rpeReasons).toHaveLength(1);
    expect(trace.inputSnapshot.goals[0]).toMatchObject({ title: 'FTP Aufbau', category: 'ftp' });
    expect(trace.inputSnapshot.load).toMatchObject({ ctl: 42, atl: 50, tsb: -8 });
    expect(trace.inputSnapshot.riskSignals[0]).toMatchObject({ ruleId: 'sleep_debt_5d', severity: 'warn' });
    expect(trace.inputSnapshot.healthStates[0]).toMatchObject({ type: 'fatigue', severity: 'moderate' });
    expect(trace.generatedSummary.join(' ')).toContain('1 verfügbare Tag');
  });
});
