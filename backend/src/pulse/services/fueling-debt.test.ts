import { describe, expect, it } from 'vitest';
import { summarizeFuelingDebt } from './fueling-debt.js';

const generatedAt = '2026-05-10T12:00:00.000Z';

describe('summarizeFuelingDebt', () => {
  it('keeps a GI issue open until a controlled tolerated follow-up exists', () => {
    const summary = summarizeFuelingDebt({
      today: '2026-05-10',
      generatedAt,
      logs: [{
        date: '2026-05-09',
        context: 'during',
        activityType: 'bike',
        durationMin: 430,
        carbsG: 300,
        bottles750Ml: 4,
        powderG: 300,
        giComfort: 'mild_issue',
      }],
    });

    expect(summary).toMatchObject({
      status: 'open_gi_issue',
      hasOpenDebt: true,
      label: 'GI-Schutz offen',
      openIssueDate: '2026-05-09',
    });
    expect(summary.closureCondition).toContain('75-120 min locker');
  });

  it('moves to controlled practice planned when an easy fueling workout is scheduled', () => {
    const summary = summarizeFuelingDebt({
      today: '2026-05-10',
      generatedAt,
      logs: [{
        date: '2026-05-09',
        context: 'during',
        activityType: 'bike',
        durationMin: 430,
        carbsG: 300,
        bottles750Ml: 4,
        powderG: 300,
        giComfort: 'issue',
      }],
      plannedWorkouts: [{
        id: 'planned-fueling-practice',
        plannedDate: '2026-05-12',
        activityType: 'bike',
        zone: 2,
        durationMin: 105,
        archetypeId: 'long_endurance_fueling_practice',
        status: 'planned',
      }],
    });

    expect(summary).toMatchObject({
      status: 'controlled_practice_planned',
      hasOpenDebt: true,
      controlledWorkoutId: 'planned-fueling-practice',
    });
    expect(summary.closureCondition).toContain('Magen ok');
  });

  it('closes the blocker when a controlled follow-up was tolerated', () => {
    const summary = summarizeFuelingDebt({
      today: '2026-05-13',
      generatedAt,
      logs: [
        {
          id: 'follow-up-log',
          date: '2026-05-12',
          context: 'during',
          activityId: 'activity-follow-up',
          activityType: 'bike',
          durationMin: 105,
          carbsG: 85,
          bottles750Ml: 2,
          powderG: 80,
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

    expect(summary).toMatchObject({
      status: 'tolerated_follow_up',
      hasOpenDebt: false,
      followUpActivityId: 'activity-follow-up',
    });
    expect(summary.summary).toContain('geschlossen');
  });

  it('reports resolved when no recent GI blocker exists', () => {
    const summary = summarizeFuelingDebt({
      today: '2026-05-10',
      generatedAt,
      logs: [{
        date: '2026-05-08',
        context: 'during',
        activityId: 'activity-ok',
        activityType: 'bike',
        durationMin: 95,
        carbsG: 70,
        bottles750Ml: 2,
        giComfort: 'ok',
      }],
    });

    expect(summary).toMatchObject({
      status: 'resolved',
      hasOpenDebt: false,
      followUpActivityId: 'activity-ok',
    });
  });
});
