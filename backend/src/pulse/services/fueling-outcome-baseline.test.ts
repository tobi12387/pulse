import { describe, expect, it } from 'vitest';
import { summarizeFuelingOutcomeBaseline } from './fueling-outcome-baseline.js';

describe('summarizeFuelingOutcomeBaseline', () => {
  it('turns a low-intake GI long ride into a controlled next target with evidence gaps', () => {
    const baseline = summarizeFuelingOutcomeBaseline({
      logs: [{
        date: '2026-05-09',
        context: 'during',
        activityType: 'bike',
        durationMin: 430,
        carbsG: 300,
        bottles750Ml: 4,
        powderG: 300,
        giComfort: 'mild_issue',
        notes: 'Nach 100 km Magenprobleme; Mars half nach ein paar Minuten.',
      }],
    });

    expect(baseline).toMatchObject({
      status: 'learning',
      label: 'Fueling-Baseline lernen',
      latestLogDate: '2026-05-09',
      observedCarbsPerHour: 42,
      targetCarbsPerHour: { min: 50, max: 70 },
      bottles750Ml: 4,
      powderG: 300,
      fluidMlPerHour: 419,
      sodiumMgPerHour: null,
    });
    expect(baseline.summary).toContain('50-70 g/h');
    expect(baseline.evidence).toContain('Sodium nicht geloggt');
  });

  it('keeps a tolerated follow-up as the stable baseline for the next small step', () => {
    const baseline = summarizeFuelingOutcomeBaseline({
      logs: [
        {
          date: '2026-05-12',
          context: 'during',
          activityType: 'bike',
          durationMin: 120,
          carbsG: 110,
          bottles750Ml: 2,
          powderG: 100,
          sodiumMg: 720,
          giComfort: 'ok',
        },
        {
          date: '2026-05-09',
          context: 'during',
          activityType: 'bike',
          durationMin: 430,
          carbsG: 300,
          bottles750Ml: 4,
          powderG: 300,
          giComfort: 'mild_issue',
        },
      ],
    });

    expect(baseline).toMatchObject({
      status: 'stable',
      label: 'Fueling-Baseline vertraeglich',
      latestLogDate: '2026-05-12',
      observedCarbsPerHour: 55,
      targetCarbsPerHour: { min: 55, max: 70 },
      sodiumMgPerHour: 360,
    });
    expect(baseline.summary).toContain('55 g/h');
    expect(baseline.summary).toContain('55-70 g/h');
  });
});
