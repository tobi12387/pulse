import { describe, expect, it } from 'vitest';
import { evaluateRiskSignalsFromData } from './risk-engine.js';

function dailyRow(i: number, overrides: Partial<{ restingHr: number; hrvRmssd: number; sleepHours: number }> = {}) {
  const d = new Date('2026-03-01T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + i);
  return {
    date: d.toISOString().split('T')[0]!,
    restingHr: overrides.restingHr ?? 48,
    hrvRmssd: overrides.hrvRmssd ?? 60,
    sleepHours: overrides.sleepHours ?? 7.5,
  };
}

describe('evaluateRiskSignalsFromData', () => {
  it('triggers RHR drift warning and critical thresholds', () => {
    const baseline = Array.from({ length: 30 }, (_, i) => dailyRow(i, { restingHr: 48 }));
    const recentWarn = Array.from({ length: 7 }, (_, i) => dailyRow(30 + i, { restingHr: 52.5 }));
    const warn = evaluateRiskSignalsFromData({
      today: '2026-04-06',
      daily: [...baseline, ...recentWarn],
      mental: [],
      ctlNow: 40,
      ctl7dAgo: 38,
    });
    expect(warn.find(s => s.ruleId === 'rhr_drift_7d')?.severity).toBe('warn');

    const recentCritical = Array.from({ length: 7 }, (_, i) => dailyRow(30 + i, { restingHr: 55 }));
    const critical = evaluateRiskSignalsFromData({
      today: '2026-04-06',
      daily: [...baseline, ...recentCritical],
      mental: [],
      ctlNow: 40,
      ctl7dAgo: 38,
    });
    expect(critical.find(s => s.ruleId === 'rhr_drift_7d')?.severity).toBe('critical');
  });

  it('triggers HRV decline when recent values fall below baseline', () => {
    const daily = [
      ...Array.from({ length: 76 }, (_, i) => dailyRow(i, { hrvRmssd: 60 })),
      ...Array.from({ length: 14 }, (_, i) => dailyRow(76 + i, { hrvRmssd: 45 - i * 0.8 })),
    ];
    const signals = evaluateRiskSignalsFromData({
      today: '2026-05-30',
      daily,
      mental: [],
      ctlNow: 40,
      ctl7dAgo: 38,
    });
    expect(signals.find(s => s.ruleId === 'hrv_trend_decline')?.severity).toBe('critical');
  });

  it('triggers CTL ramp critical above +9 per week', () => {
    const signals = evaluateRiskSignalsFromData({
      today: '2026-04-06',
      daily: [],
      mental: [],
      ctlNow: 50,
      ctl7dAgo: 40.5,
    });
    expect(signals.find(s => s.ruleId === 'ctl_ramp_overshoot')?.severity).toBe('critical');
  });

  it('triggers sleep debt critical', () => {
    const daily = Array.from({ length: 5 }, (_, i) => dailyRow(i, { sleepHours: 5 }));
    const signals = evaluateRiskSignalsFromData({
      today: '2026-03-05',
      daily,
      mental: [],
      ctlNow: 40,
      ctl7dAgo: 38,
      sleepTargetH: 8,
    });
    expect(signals.find(s => s.ruleId === 'sleep_debt_5d')?.severity).toBe('critical');
  });

  it('triggers mental warning but never critical', () => {
    const mental = Array.from({ length: 4 }, (_, i) => ({
      date: dailyRow(i).date,
      mood: 3,
      stress: 8,
    }));
    const signals = evaluateRiskSignalsFromData({
      today: '2026-03-04',
      daily: [],
      mental,
      ctlNow: 40,
      ctl7dAgo: 38,
    });
    expect(signals.find(s => s.ruleId === 'mental_negative_streak')?.severity).toBe('warn');
    expect(signals.find(s => s.ruleId === 'mental_negative_streak')?.severity).not.toBe('critical');
  });
});
