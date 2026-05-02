import { describe, expect, it } from 'vitest';
import { selectMentalCompanionGuidance } from './mental-companion.js';

const forbiddenClinicalTerms = [
  'depression',
  'anxiety disorder',
  'burnout diagnosis',
  'ADHD',
  'trauma',
  'insomnia',
  'addiction',
  'clinical risk score',
];

function outputText(result: ReturnType<typeof selectMentalCompanionGuidance>): string {
  return [
    ...result.questions.flatMap(question => [question.label, question.rationale]),
    ...(result.action ? [result.action.label, result.action.rationale] : []),
  ].join(' ');
}

describe('selectMentalCompanionGuidance', () => {
  it('asks about recovery boundary and mental load on rest days without framing future workouts as today', () => {
    const result = selectMentalCompanionGuidance({
      today: '2026-05-01',
      nextWorkout: { plannedDate: '2026-05-04', activityType: 'bike', zone: 2, durationMin: 75 },
      recentThemes: [],
    });

    expect(result.questions.map(q => q.id)).toEqual(expect.arrayContaining(['rest-boundary', 'mental-load']));
    expect(outputText(result)).toContain('freier Tag');
    expect(outputText(result)).not.toContain('heutige Einheit am 2026-05-04');
    expect(result.questions.length).toBeLessThanOrEqual(3);
  });

  it('asks about readiness and confidence for today only on workout days', () => {
    const result = selectMentalCompanionGuidance({
      today: '2026-05-01',
      todayWorkout: { plannedDate: '2026-05-01', activityType: 'run', zone: 4, durationMin: 50 },
      nextWorkout: { plannedDate: '2026-05-01', activityType: 'run', zone: 4, durationMin: 50 },
      readinessScore: 58,
      recentThemes: [],
    });

    expect(result.questions.map(q => q.id)).toEqual(expect.arrayContaining(['today-readiness', 'workout-confidence']));
    expect(outputText(result)).toContain('heute');
    expect(outputText(result)).toContain('run');
  });

  it('suggests a small boundary action for high stress with low motivation', () => {
    const result = selectMentalCompanionGuidance({
      today: '2026-05-01',
      stressAvg: 78,
      recentCheckins: [{ date: '2026-04-30', mood: 5, energy: 4, stress: 8, motivation: 3, themes: ['arbeit'] }],
      recentThemes: [{ theme: 'arbeit', count: 3, lastSeen: '2026-04-30' }],
    });

    expect(result.action).toMatchObject({
      closureKind: 'boundary',
      targetRoute: '/coach',
    });
    expect(result.action?.rationale).toContain('Stress');
  });

  it('uses resurfacing themes as visible rationale rather than hidden inference', () => {
    const result = selectMentalCompanionGuidance({
      today: '2026-05-01',
      recentThemes: [{ theme: 'Schlafdruck', count: 4, lastSeen: '2026-04-30' }],
    });

    expect(result.questions).toContainEqual(expect.objectContaining({
      id: 'theme-reflection',
      rationale: expect.stringContaining('Schlafdruck'),
    }));
  });

  it('stays non-clinical in questions, rationale, and actions', () => {
    const result = selectMentalCompanionGuidance({
      today: '2026-05-01',
      stressAvg: 90,
      recentCheckins: [{ date: '2026-04-30', mood: 3, energy: 3, stress: 9, motivation: 2, themes: ['ueberlastung'] }],
      recentThemes: [{ theme: 'ueberlastung', count: 5, lastSeen: '2026-04-30' }],
    });
    const text = outputText(result).toLowerCase();

    for (const term of forbiddenClinicalTerms) {
      expect(text).not.toContain(term.toLowerCase());
    }
  });
});
