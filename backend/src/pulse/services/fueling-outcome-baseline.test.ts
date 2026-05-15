import { describe, expect, it } from 'vitest';
import { summarizeFuelingOutcomeBaseline } from './fueling-outcome-baseline.js';

describe('summarizeFuelingOutcomeBaseline', () => {
  it('counts comparable complete during logs before allowing trend summaries', () => {
    const baseline = summarizeFuelingOutcomeBaseline({
      logs: [{
        date: '2026-05-09',
        context: 'during',
        activityType: 'bike',
        durationMin: 398,
        carbsG: 356,
        sodiumMg: 1300,
        notes: '4 x 750 ml getrunken; leichte Magenprobleme nach ca. 100 km.',
      }],
    });

    const readiness = baseline.learningReadiness!;
    expect(readiness).toMatchObject({
      comparableCompleteLogs: 0,
      requiredComparableCompleteLogs: 3,
      readyForTrendSummary: false,
    });
    expect(readiness.missingEvidence.join(' ')).toContain('GI-Komfort');
    expect(readiness.missingEvidence.join(' ')).toContain('drei vergleichbare');
  });

  it('marks trend summaries ready after three comparable complete during logs', () => {
    const baseline = summarizeFuelingOutcomeBaseline({
      logs: [
        { date: '2026-05-13', context: 'during', activityType: 'bike', durationMin: 130, carbsG: 125, giComfort: 'ok' },
        { date: '2026-05-10', context: 'during', activityType: 'bike', durationMin: 115, carbsG: 105, giComfort: 'ok' },
        { date: '2026-05-04', context: 'during', activityType: 'run', durationMin: 80, carbsG: 50, giComfort: 'mild_issue' },
      ],
    });

    expect(baseline.learningReadiness!).toMatchObject({
      comparableCompleteLogs: 3,
      requiredComparableCompleteLogs: 3,
      readyForTrendSummary: true,
      missingEvidence: [],
    });
    expect(baseline.trendSummary).toBe(
      'Fueling-Trend: 3/3 komplette During-Logs, Schnitt 50 g/h; 2x Magen ok, 1x unruhig.',
    );
  });

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

  it('keeps sodium, heat and sweat-rate as explicit hydration context gaps', () => {
    const baseline = summarizeFuelingOutcomeBaseline({
      logs: [{
        date: '2026-05-09',
        context: 'during',
        activityType: 'bike',
        durationMin: 240,
        carbsG: 242,
        bottles750Ml: 4,
        powderG: 300,
        giComfort: 'ok',
      }],
    });

    const hydrationGaps = baseline.hydrationEvidenceGaps ?? [];
    expect(hydrationGaps).toContain('Sodium nicht strukturiert geloggt.');
    expect(hydrationGaps).toContain('Hitze und Schweißrate nicht gemessen.');
  });

  it('closes hydration context gaps when sodium, heat and sweat-rate are measured', () => {
    const baseline = summarizeFuelingOutcomeBaseline({
      logs: [{
        date: '2026-05-09',
        context: 'during',
        activityType: 'bike',
        durationMin: 240,
        carbsG: 242,
        sodiumMg: 1300,
        ambientTempC: 28,
        sweatRateLPerHour: 0.9,
        bottles750Ml: 4,
        powderG: 300,
        giComfort: 'ok',
      }],
    });

    expect(baseline.hydrationEvidenceGaps ?? []).toEqual([]);
    expect(baseline.evidence).toContain('Sodium ca. 325 mg/h');
    expect(baseline.evidence).toContain('Hydration-Kontext: 28°C, Schweißrate 0.9 l/h');
  });

  it('summarizes measured hydration context for daily decisions', () => {
    const baseline = summarizeFuelingOutcomeBaseline({
      logs: [{
        date: '2026-05-09',
        context: 'during',
        activityType: 'bike',
        durationMin: 240,
        carbsG: 242,
        sodiumMg: 1300,
        ambientTempC: 28,
        sweatRateLPerHour: 0.9,
        bottles750Ml: 4,
        powderG: 300,
        giComfort: 'ok',
      }],
    });

    expect(baseline.hydrationContextSummary).toBe(
      'Hydration-Kontext gemessen: Sodium ca. 325 mg/h, 28°C, Schweißrate 0.9 l/h',
    );
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
