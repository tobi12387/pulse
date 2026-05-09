import { describe, expect, it } from 'vitest';
import { buildPlanTrace } from './plan-trace.js';

describe('buildPlanTrace', () => {
  it('summarizes data inputs, free days, sport mix, and hard days', () => {
    const adjustedWorkout = {
      plannedDate: '2026-05-04',
      activityType: 'bike',
      zone: 2,
      durationMin: 60,
      targetTss: 40,
      adjustedReason: 'fatigue',
    };
    const trace = buildPlanTrace({
      weekStart: '2026-05-04',
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
      planLearning: {
        lookbackWeeks: 6,
        weeks: [{
          weekStart: '2026-04-27',
          plannedSessions: 4,
          completedSessions: 2,
          skippedSessions: 1,
          completionRate: 0.5,
          avgComplianceScore: 0.62,
          avgRpe: 8.2,
          sportMix: { bike: { sessions: 2, totalMinutes: 130, totalTss: 120 } },
          hardDays: [{ date: '2026-04-30', activityType: 'bike', zone: 4, durationMin: 50 }],
          skippedAvailableDays: [5],
        }],
        previousWeek: {
          weekStart: '2026-04-27',
          plannedSessions: 4,
          completedSessions: 2,
          skippedSessions: 1,
          completionRate: 0.5,
          avgComplianceScore: 0.62,
          avgRpe: 8.2,
          sportMix: { bike: { sessions: 2, totalMinutes: 130, totalTss: 120 } },
          hardDays: [{ date: '2026-04-30', activityType: 'bike', zone: 4, durationMin: 50 }],
          skippedAvailableDays: [5],
        },
        learnedFromLastWeek: ['Compliance lag bei 62%; diese Woche weniger dicht planen.'],
        variationComparedToLastWeek: [],
        flags: ['low_compliance'],
      },
      planDecision: {
        selectedDays: [0, 2, 4],
        skippedAvailableDays: [5],
        targetSessionCount: 3,
        primaryGoal: 'ftp',
        reasons: ['FTP-Ziel: wenige, gezielte Reize statt viele Fülltage.', 'RPE-Signal: eine leichte bike-Einheit fühlte sich mit RPE 8/10 zu hart an.'],
      },
      workouts: [
        adjustedWorkout,
        { plannedDate: '2026-05-06', activityType: 'bike', zone: 4, durationMin: 50, targetTss: 80 },
        { plannedDate: '2026-05-08', activityType: 'strength', zone: 1, durationMin: 45, targetTss: 20 },
      ],
    });

    expect(trace.sportMix.bike).toMatchObject({ sessions: 2, totalMinutes: 110, totalTss: 120 });
    expect(trace.hardDays).toEqual([{ date: '2026-05-06', activityType: 'bike', zone: 4, durationMin: 50 }]);
    expect(trace.inputSnapshot.recentRpe).toHaveLength(1);
    expect(trace.inputSnapshot.rpeReasons).toHaveLength(1);
    expect(trace.inputSnapshot.goals[0]).toMatchObject({ title: 'FTP Aufbau', category: 'ftp' });
    expect(trace.inputSnapshot.load).toMatchObject({ ctl: 42, atl: 50, tsb: -8 });
    expect(trace.inputSnapshot.riskSignals[0]).toMatchObject({ ruleId: 'sleep_debt_5d', severity: 'warn' });
    expect(trace.inputSnapshot.healthStates[0]).toMatchObject({ type: 'fatigue', severity: 'moderate' });
    expect(trace.inputSnapshot.learningSnapshot?.learnedFromLastWeek[0]).toContain('Compliance');
    expect(trace.inputSnapshot.learningSnapshot?.variationComparedToLastWeek.join(' ')).toContain('Harte Tage');
    expect(trace.generatedSummary.join(' ')).toContain('1 verfügbare Tag');
    expect(trace.generatedSummary.join(' ')).toContain('Gelernt');
    expect(trace.generatedSummary.join(' ')).toContain('Variation');
    expect(trace.generatedSummary.join(' ')).toContain('Angepasst');
    expect(trace.generatedSummary.join(' ')).toContain('fatigue');
  });

  it('carries execution-review adaptation and deliberate rest-day rationale into trace output', () => {
    const trace = buildPlanTrace({
      weekStart: '2026-05-04',
      phase: 'build',
      mesocycleWeek: 2,
      weeklyHoursTarget: 8,
      availableDays: [0, 1, 2, 3],
      load: { ctl: 42, atl: 40, tsb: 5, date: '2026-05-04' },
      profile: { ftpWatts: 260, maxHrBpm: 185, lthrBpm: 170 },
      goals: [{ title: 'FTP Aufbau', category: 'ftp', targetDate: null, raceDiscipline: null, raceDistanceKm: null, racePriority: null }],
      riskSignals: [],
      healthStates: [],
      recentActivities: [],
      planLearning: null,
      executionReview: {
        signals: ['matched', 'maintain_structure'],
        learnedFromLastWeek: ['Ausführung stabil: 2/2 Einheiten abgeglichen.'],
        variationComparedToLastWeek: ['Planstruktur bleibt bewusst ähnlich.'],
        restDayRationale: [
          { date: '2026-05-07', reason: 'Bewusster freier Tag: stabile Ausführung und gute Erholung.' },
        ],
        recommendedHardDayAvoidance: [],
        intents: ['stable'],
      },
      planDecision: {
        selectedDays: [0, 2],
        skippedAvailableDays: [1, 3],
        targetSessionCount: 2,
        primaryGoal: 'ftp',
        reasons: ['FTP-Ziel: wenige, gezielte Reize statt viele Fülltage.'],
      },
      workouts: [
        { plannedDate: '2026-05-04', activityType: 'bike', zone: 2, durationMin: 60, targetTss: 40 },
        { plannedDate: '2026-05-06', activityType: 'bike', zone: 4, durationMin: 50, targetTss: 80 },
      ],
    } as Parameters<typeof buildPlanTrace>[0] & { executionReview: unknown });

    expect(trace.adaptation?.learnedFromExecution[0]).toContain('Ausführung stabil');
    expect(trace.adaptation?.variationRationale[0]).toContain('ähnlich');
    expect(trace.restDayRationale).toEqual([
      { date: '2026-05-07', reason: 'Bewusster freier Tag: stabile Ausführung und gute Erholung.' },
    ]);
    expect(trace.generatedSummary.join(' ')).toContain('Ausführung');
  });

  it('adds plan quality warnings when the generated week repeats the previous pattern', () => {
    const trace = buildPlanTrace({
      weekStart: '2026-05-11',
      phase: 'build',
      mesocycleWeek: 3,
      weeklyHoursTarget: 7,
      availableDays: [0, 1, 2, 3, 4, 5],
      load: { ctl: 42, atl: 40, tsb: 5, date: '2026-05-11' },
      profile: { ftpWatts: 260, maxHrBpm: 185, lthrBpm: 170 },
      goals: [{ title: 'FTP Aufbau', category: 'ftp', targetDate: null, raceDiscipline: null, raceDistanceKm: null, racePriority: null }],
      riskSignals: [],
      healthStates: [],
      recentActivities: [],
      planLearning: {
        lookbackWeeks: 6,
        weeks: [],
        previousWeek: {
          weekStart: '2026-05-04',
          plannedSessions: 3,
          completedSessions: 3,
          skippedSessions: 0,
          completionRate: 1,
          avgComplianceScore: 0.9,
          avgRpe: 6,
          sportMix: { bike: { sessions: 3, totalMinutes: 315, totalTss: 287 } },
          hardDays: [{ date: '2026-05-06', activityType: 'bike', zone: 4, durationMin: 75 }],
          skippedAvailableDays: [1, 3, 4],
        },
        learnedFromLastWeek: ['Vorwoche stabil.'],
        variationComparedToLastWeek: [],
        flags: [],
      },
      planDecision: {
        selectedDays: [0, 2, 5],
        skippedAvailableDays: [1, 3, 4],
        targetSessionCount: 3,
        primaryGoal: 'ftp',
        reasons: ['FTP-Ziel: wenige, gezielte Reize statt viele Fülltage.'],
      },
      workouts: [
        { plannedDate: '2026-05-11', activityType: 'bike', zone: 2, durationMin: 90, targetTss: 74 },
        { plannedDate: '2026-05-13', activityType: 'bike', zone: 4, durationMin: 75, targetTss: 90 },
        { plannedDate: '2026-05-16', activityType: 'bike', zone: 2, durationMin: 150, targetTss: 123 },
      ],
    });

    expect(trace.generatedSummary.join(' ')).toContain('Planqualität');
    expect(trace.generatedSummary.join(' ')).toContain('wiederholt');
  });
});
