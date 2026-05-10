import { describe, expect, it } from 'vitest';
import { buildTodayOptions } from './today-options.js';
import type { PulseTrainingCapabilitySummary } from '@coaching-os/shared/pulse';

function capabilitySummary(overrides: Partial<PulseTrainingCapabilitySummary['levels'][number]> = {}): PulseTrainingCapabilitySummary {
  return {
    generatedAt: '2026-05-09T06:00:00.000Z',
    lookbackDays: 90,
    levels: [{
      energySystem: 'endurance',
      label: 'Endurance',
      level: 3.8,
      nextRecommendedWorkoutLevel: 4.1,
      lastProgressionReason: 'Endurance sauber abgeschlossen; nächster produktiver Reiz darf leicht steigen.',
      staleReason: null,
      confidence: 'medium',
      evidence: ['bike Z2 90min mit gutem Fit abgeschlossen.'],
      updatedAt: '2026-05-08T12:00:00.000Z',
      ...overrides,
    }],
    signals: [],
    recommendations: [],
    fitLegend: {
      recovery: 'Aktive Erholung',
      maintenance: 'Erhaltung',
      productive: 'Produktiv',
      stretch: 'Stretch',
      too_hard_today: 'Zu hart heute',
    },
  };
}

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
    expect(result.options[0]?.signalLabels?.map(label => label.label)).toEqual([
      'Fueling schützen',
      'Mental schützen',
      'Recovery',
    ]);
  });

  it('shows the closure condition when a GI fueling debt is open', () => {
    const result = buildTodayOptions({
      date: '2026-05-09',
      readinessScore: 82,
      tsb: 4,
      plannedToday: {
        id: 'vo2-bike',
        activityType: 'bike',
        zone: 5,
        durationMin: 55,
        targetTss: 92,
        capabilityFit: 'productive',
      },
      completedTodayActivities: [],
      recentSportMix: { bike: 2, run: 1 },
      riskSignals: [],
      mental: { mood: 8, energy: 8, stress: 2, motivation: 8 },
      fueling: {
        recentGiIssue: true,
        loggedToday: false,
        debtSummary: {
          status: 'open_gi_issue',
          hasOpenDebt: true,
          label: 'GI-Schutz offen',
          summary: 'GI-Hinweis offen.',
          closureCondition: 'Schließen: 75-120 min locker mit frühem Fueling und danach Magen ok loggen.',
          evidence: ['GI-Hinweis: 2026-05-08'],
          openIssueDate: '2026-05-08',
          controlledWorkoutId: null,
          followUpActivityId: null,
          updatedAt: '2026-05-09T06:00:00.000Z',
        },
      },
      capabilitySummary: null,
    });

    expect(result.state).toBe('recovery_protect');
    expect(result.options[0]?.detail).toContain('Schließen: 75-120 min locker');
    expect(result.options[0]?.evidence).toContain('Fueling: GI-Schutz offen');
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

  it('uses endurance capability progression for productive short free-day options', () => {
    const result = buildTodayOptions({
      date: '2026-05-09',
      readinessScore: 82,
      tsb: 3,
      plannedToday: null,
      completedTodayActivities: [],
      recentSportMix: { bike: 1, run: 2 },
      riskSignals: [],
      mental: { mood: 8, energy: 8, stress: 2, motivation: 8 },
      fueling: { recentGiIssue: false, loggedToday: true },
      capabilitySummary: capabilitySummary(),
    });

    expect(result.state).toBe('unplanned_trainable');
    expect(result.options[0]).toMatchObject({
      kind: 'workout',
      priority: 'primary',
      durationMin: 60,
      capabilityFit: 'productive',
    });
    expect(result.options[0]?.signalLabels?.[0]).toMatchObject({
      kind: 'productive',
      label: 'Produktiv',
    });
    expect(result.options[0]?.detail).toContain('produktiver aerober Reiz');
    expect(result.options[0]?.evidence).toContain('Capability: Endurance 3.8 -> 4.1');
  });

  it('does not offer a hard planned VO2 workout after recent GI discomfort', () => {
    const result = buildTodayOptions({
      date: '2026-05-09',
      readinessScore: 82,
      tsb: 4,
      plannedToday: {
        id: 'vo2-bike',
        activityType: 'bike',
        zone: 5,
        durationMin: 55,
        targetTss: 92,
        capabilityFit: 'productive',
      },
      completedTodayActivities: [],
      recentSportMix: { bike: 2, run: 1 },
      riskSignals: [],
      mental: { mood: 8, energy: 8, stress: 2, motivation: 8 },
      fueling: { recentGiIssue: true, loggedToday: false },
      capabilitySummary: capabilitySummary({ energySystem: 'vo2', label: 'VO2', level: 3.2, nextRecommendedWorkoutLevel: 3.2 }),
    });

    expect(result.state).toBe('recovery_protect');
    expect(result.options.some(option => option.kind === 'workout' && (option.zone ?? 0) >= 3)).toBe(false);
    expect(result.summary).toContain('Erholung');
    expect(result.options[0]?.signalLabels?.[0]).toMatchObject({
      kind: 'fueling_protect',
      label: 'Fueling schützen',
    });
  });

  it('does not block a planned workout when the fueling debt is resolved', () => {
    const result = buildTodayOptions({
      date: '2026-05-09',
      readinessScore: 82,
      tsb: 4,
      plannedToday: {
        id: 'tempo-bike',
        activityType: 'bike',
        zone: 4,
        durationMin: 55,
        targetTss: 82,
        capabilityFit: 'productive',
      },
      completedTodayActivities: [],
      recentSportMix: { bike: 2, run: 1 },
      riskSignals: [],
      mental: { mood: 8, energy: 8, stress: 2, motivation: 8 },
      fueling: {
        recentGiIssue: true,
        loggedToday: true,
        debtSummary: {
          status: 'tolerated_follow_up',
          hasOpenDebt: false,
          label: 'Toleranz bestätigt',
          summary: 'GI-Hinweis geschlossen.',
          closureCondition: 'Blocker geschlossen.',
          evidence: ['Follow-up ok'],
          openIssueDate: '2026-05-06',
          controlledWorkoutId: null,
          followUpActivityId: 'activity-ok',
          updatedAt: '2026-05-09T06:00:00.000Z',
        },
      },
      capabilitySummary: capabilitySummary({ energySystem: 'tempo', label: 'Tempo', level: 3.2, nextRecommendedWorkoutLevel: 3.4 }),
    });

    expect(result.state).toBe('planned_workout');
    expect(result.options[0]?.title).toBe('Plan ausführen: Rad');
  });

  it('turns planned workout capability fit into understandable daily signal labels', () => {
    const result = buildTodayOptions({
      date: '2026-05-09',
      readinessScore: 78,
      tsb: 1,
      plannedToday: {
        id: 'stretch-threshold',
        activityType: 'bike',
        zone: 4,
        durationMin: 70,
        targetTss: 88,
        capabilityFit: 'stretch',
      },
      completedTodayActivities: [],
      recentSportMix: { bike: 2, run: 1 },
      riskSignals: [],
      mental: { mood: 7, energy: 7, stress: 3, motivation: 7 },
      fueling: { recentGiIssue: false, loggedToday: true },
      capabilitySummary: capabilitySummary({ energySystem: 'threshold', label: 'Threshold', level: 3.4, nextRecommendedWorkoutLevel: 3.6 }),
    });

    expect(result.state).toBe('planned_workout');
    expect(result.options[0]?.signalLabels?.[0]).toMatchObject({
      kind: 'fit_stretch',
      label: 'Stretch',
      tone: 'amber',
    });
    expect(result.options[0]?.evidence).toContain('Level-Fit: Stretch');
  });

  it('marks too-hard planned workouts with a clear daily signal label before recovery blocks', () => {
    const result = buildTodayOptions({
      date: '2026-05-09',
      readinessScore: 74,
      tsb: 0,
      plannedToday: {
        id: 'too-hard-vo2',
        activityType: 'bike',
        zone: 5,
        durationMin: 75,
        targetTss: 112,
        capabilityFit: 'too_hard_today',
      },
      completedTodayActivities: [],
      recentSportMix: { bike: 2 },
      riskSignals: [],
      mental: { mood: 7, energy: 7, stress: 3, motivation: 7 },
      fueling: { recentGiIssue: false, loggedToday: true },
      capabilitySummary: capabilitySummary({ energySystem: 'vo2', label: 'VO2', level: 3.1, nextRecommendedWorkoutLevel: 3.1 }),
    });

    expect(result.state).toBe('recovery_protect');
    expect(result.options.some(option => option.kind === 'workout' && (option.zone ?? 0) >= 3)).toBe(false);
    expect(result.options[0]?.evidence).toContain('Level-Fit: Zu hart heute');
    expect(result.options[0]?.signalLabels?.map(label => label.label)).toContain('Zu hart heute');
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
    expect(result.options[0]?.signalLabels?.[0]).toMatchObject({
      kind: 'fit_maintenance',
      label: 'Machbar',
    });
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
