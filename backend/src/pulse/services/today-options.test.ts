import { describe, expect, it } from 'vitest';
import { buildTodayOptions } from './today-options.js';

describe('buildTodayOptions', () => {
  it('turns a completed Garmin activity into recovery, fueling and feedback options', () => {
    const result = buildTodayOptions({
      date: '2026-05-09',
      readinessScore: 72,
      tsb: -4,
      plannedToday: null,
      completedTodayActivities: [{
        id: 'activity-1',
        activityType: 'bike',
        durationMin: 185,
        distanceKm: 92,
        tss: 145,
        rpe: null,
        feedbackLoggedAt: null,
      }],
      recentSportMix: { bike: 2, run: 1 },
      riskSignals: [],
      mental: null,
      fueling: { recentGiIssue: false, loggedToday: false },
      capabilitySummary: null,
    });

    expect(result.state).toBe('completed_activity');
    expect(result.options).toHaveLength(3);
    expect(result.options.every(option => option.kind !== 'workout')).toBe(true);
    expect(result.options.map(option => option.kind)).toEqual(['feedback', 'fueling', 'recovery']);
    expect(result.summary).toContain('abgeschlossen');
  });

  it('closes the planned workout decision after the planned activity is completed', () => {
    const result = buildTodayOptions({
      date: '2026-05-09',
      readinessScore: 76,
      tsb: 1,
      plannedToday: {
        id: 'planned-bike',
        activityType: 'bike',
        zone: 2,
        durationMin: 80,
        targetTss: 65,
        capabilityFit: 'productive',
      },
      completedTodayActivities: [{
        id: 'activity-planned-bike',
        activityType: 'bike',
        durationMin: 82,
        distanceKm: 33,
        tss: 68,
        rpe: 5,
        feedbackLoggedAt: '2026-05-09T10:00:00.000Z',
      }],
      recentSportMix: { bike: 2, run: 1 },
      riskSignals: [],
      mental: { mood: 7, energy: 7, stress: 3, motivation: 8 },
      fueling: { recentGiIssue: false, loggedToday: true },
      capabilitySummary: null,
    });

    expect(result.state).toBe('completed_activity');
    expect(result.summary).toContain('Geplantes Training erledigt');
    expect(result.options.every(option => option.kind !== 'workout')).toBe(true);
    expect(result.options[0]?.evidence).toEqual(expect.arrayContaining([
      'Geplant: Rad 80 min Z2',
      'Abgeschlossen: Rad 82 min · 33 km',
    ]));
  });

  it('makes rest the first-class option when recovery risk is high', () => {
    const result = buildTodayOptions({
      date: '2026-05-09',
      readinessScore: 38,
      tsb: -18,
      plannedToday: {
        id: 'workout-1',
        activityType: 'bike',
        zone: 4,
        durationMin: 75,
        targetTss: 90,
        capabilityFit: 'stretch',
      },
      completedTodayActivities: [],
      recentSportMix: { bike: 3 },
      riskSignals: [{ severity: 'critical', title: 'HRV-Trend fällt' }],
      mental: { mood: 5, energy: 3, stress: 8, motivation: 4 },
      fueling: { recentGiIssue: true, loggedToday: false },
      capabilitySummary: null,
    });

    expect(result.state).toBe('recovery_protect');
    expect(result.options[0]).toMatchObject({
      kind: 'rest',
      priority: 'primary',
    });
    expect(result.options.some(option => option.kind === 'workout' && (option.zone ?? 0) >= 3)).toBe(false);
    expect(result.options[0]?.evidence).toEqual(expect.arrayContaining([
      'Readiness 38/100',
      'TSB -18.0',
      'Risiko: HRV-Trend fällt',
    ]));
  });

  it('returns stable explainable workout options on unplanned trainable days', () => {
    const input = {
      date: '2026-05-09',
      readinessScore: 78,
      tsb: 2,
      plannedToday: null,
      completedTodayActivities: [],
      recentSportMix: { bike: 1, run: 2 },
      riskSignals: [],
      mental: { mood: 7, energy: 7, stress: 3, motivation: 8 },
      fueling: { recentGiIssue: false, loggedToday: true },
      capabilitySummary: null,
    };

    const first = buildTodayOptions(input);
    const second = buildTodayOptions(input);

    expect(first).toEqual(second);
    expect(first.state).toBe('unplanned_trainable');
    expect(first.options).toHaveLength(3);
    expect(first.options[0]).toMatchObject({
      kind: 'workout',
      priority: 'primary',
      activityType: 'bike',
      zone: 2,
    });
    expect(first.options[0]?.targetPath).toContain('/plan?');
    expect(first.options[0]?.targetPath).toContain('source=today-options');
    expect(first.options[0]?.targetPath).toContain('scenario=workout');
    expect(first.options[0]?.targetPath).toContain('activityType=bike');
    expect(first.options[0]?.targetPath).toContain('durationMin=60');
    expect(first.options[0]?.targetPath).toContain('archetypeId=endurance_cadence');
    expect(first.options[0]?.archetypeId).toBe('endurance_cadence');
    expect(first.options[0]?.targetPath).toContain('#plan-scenario-preview');
    expect(first.options[0]?.evidence.length).toBeGreaterThanOrEqual(2);
  });

  it('does not turn a short GI-aware spontaneous option into long fueling practice', () => {
    const result = buildTodayOptions({
      date: '2026-05-09',
      readinessScore: 85,
      tsb: 8,
      plannedToday: null,
      completedTodayActivities: [],
      recentSportMix: { bike: 0, run: 2 },
      riskSignals: [],
      mental: { mood: 8, energy: 8, stress: 2, motivation: 8 },
      fueling: { recentGiIssue: true, loggedToday: false },
      goals: { activeCount: 1, preferredSports: ['bike'] },
      capabilitySummary: null,
    });

    expect(result.state).toBe('unplanned_trainable');
    expect(result.options[0]).toMatchObject({
      activityType: 'bike',
      archetypeId: 'endurance_cadence',
    });
    expect(result.options[0]?.targetPath).toContain('archetypeId=endurance_cadence');
    expect(result.options[0]?.evidence).toContain('Fueling: letzte Einheit mit GI-Hinweis');
  });

  it('makes the support option concrete and downshifts near recovery risk', () => {
    const result = buildTodayOptions({
      date: '2026-05-09',
      readinessScore: 58,
      tsb: -4,
      plannedToday: null,
      completedTodayActivities: [],
      recentSportMix: { bike: 2 },
      riskSignals: [],
      mental: { mood: 6, energy: 5, stress: 5, motivation: 6 },
      fueling: { recentGiIssue: false, loggedToday: true },
      capabilitySummary: null,
    });

    const support = result.options.find(option => option.kind === 'skills');
    expect(support).toMatchObject({
      title: 'Mobility leicht',
      detail: '15-20 min Beweglichkeit und Atmung, ohne Trainingsstress.',
      durationMin: 20,
      archetypeId: 'strength_prehab',
    });
    expect(support?.targetPath).toContain('durationMin=20');
  });
});
