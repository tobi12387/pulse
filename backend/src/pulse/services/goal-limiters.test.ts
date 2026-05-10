import { describe, expect, it } from 'vitest';
import type { PulseTrainingCapabilitySummary } from '@coaching-os/shared/pulse';
import { deriveGoalLimiter } from './goal-limiters.js';

const capabilitySummary: PulseTrainingCapabilitySummary = {
  generatedAt: '2026-05-09T12:00:00.000Z',
  lookbackDays: 90,
  fitLegend: {
    recovery: 'Recovery',
    maintenance: 'Maintenance',
    productive: 'Productive',
    stretch: 'Stretch',
    too_hard_today: 'Too hard today',
  },
  signals: [],
  recommendations: [],
  levels: [
    { energySystem: 'endurance', label: 'Endurance', level: 4.6, confidence: 'high', evidence: [], updatedAt: '2026-05-09T12:00:00.000Z' },
    { energySystem: 'long_endurance', label: 'Long Endurance', level: 2.4, confidence: 'medium', evidence: [], updatedAt: '2026-05-09T12:00:00.000Z' },
    { energySystem: 'threshold', label: 'Threshold', level: 3.8, confidence: 'medium', evidence: [], updatedAt: '2026-05-09T12:00:00.000Z' },
    { energySystem: 'vo2', label: 'VO2', level: 3.1, confidence: 'low', evidence: [], updatedAt: '2026-05-09T12:00:00.000Z' },
  ],
};

describe('deriveGoalLimiter', () => {
  it('prioritizes long endurance and fueling for long events with GI evidence', () => {
    const limiter = deriveGoalLimiter({
      goals: [{
        title: '155 km Rennrad',
        category: 'race',
        targetDate: '2026-06-20',
        raceDiscipline: 'bike',
        raceDistanceKm: 155,
        racePriority: 'A',
      }],
      trainingCapabilities: capabilitySummary,
      recentActivities: [
        { date: '2026-05-08', activityType: 'bike', durationMin: 420, tss: 285, rpe: 7, plannedZone: null },
      ],
      fuelingHistory: [
        { date: '2026-05-08', activityType: 'bike', durationMin: 420, giComfort: 'minor_issues', powderG: 300 },
      ],
    });

    expect(limiter?.kind).toBe('long_endurance_fueling');
    expect(limiter?.planBias).toContain('lange Ausdauer');
    expect(limiter?.evidence.join(' ')).toContain('155 km');
    expect(limiter?.evidence.join(' ')).toContain('GI');
  });

  it('prioritizes threshold and VO2 when intensity capability lags endurance', () => {
    const limiter = deriveGoalLimiter({
      goals: [{
        title: 'FTP verbessern',
        category: 'ftp',
        targetDate: '2026-07-01',
        raceDiscipline: null,
        raceDistanceKm: null,
        racePriority: null,
      }],
      trainingCapabilities: {
        ...capabilitySummary,
        levels: capabilitySummary.levels.map(level => (
          level.energySystem === 'threshold' ? { ...level, level: 2.2 } :
          level.energySystem === 'vo2' ? { ...level, level: 2.1 } :
          level
        )),
      },
      recentActivities: [
        { date: '2026-05-07', activityType: 'bike', durationMin: 55, tss: 85, rpe: 8, plannedZone: 4 },
      ],
      fuelingHistory: [],
    });

    expect(limiter?.kind).toBe('threshold_vo2');
    expect(limiter?.workoutFocus).toEqual(['threshold', 'vo2']);
    expect(limiter?.evidence.join(' ')).toContain('Schwelle/VO2');
  });

  it('uses limited durability as a goal limiter when power quality is usable', () => {
    const limiter = deriveGoalLimiter({
      goals: [{
        title: 'Radmarathon stark finishen',
        category: 'race',
        targetDate: '2026-07-01',
        raceDiscipline: 'bike',
        raceDistanceKm: 155,
        racePriority: 'A',
      }],
      trainingCapabilities: capabilitySummary,
      recentActivities: [
        { date: '2026-05-07', activityType: 'bike', durationMin: 240, tss: 180, rpe: 7, plannedZone: 2 },
      ],
      fuelingHistory: [],
      durability: {
        rating: 'limited',
        evidence: ['Power -21%', 'HR +3 bpm', '240 min'],
        qualitySource: 'lap_approximation',
        qualityStatus: 'usable_with_caution',
      },
    });

    expect(limiter?.kind).toBe('durability');
    expect(limiter?.confidence).toBe('medium');
    expect(limiter?.evidence.join(' ')).toContain('Quelle: lap_approximation');
  });

  it('stays quiet when there is no goal or capability evidence', () => {
    const limiter = deriveGoalLimiter({
      goals: [],
      trainingCapabilities: null,
      recentActivities: [],
      fuelingHistory: [],
    });

    expect(limiter).toBeNull();
  });
});
