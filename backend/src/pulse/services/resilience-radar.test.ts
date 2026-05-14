import { describe, expect, it } from 'vitest';
import { buildResilienceRadar, type ResilienceRadarInput } from './resilience-radar.js';

function baseInput(overrides: Partial<ResilienceRadarInput> = {}): ResilienceRadarInput {
  return {
    today: '2026-05-14',
    days: 14,
    checkins: [],
    daily: [],
    load: [],
    support: {
      warningSigns: [],
      stabilizingActions: [],
      contactNote: '',
      activationPreference: 'suggest_only',
    },
    ...overrides,
  };
}

describe('buildResilienceRadar', () => {
  it('suggests the configured support plan when repeated mental and load pressure are visible', () => {
    const result = buildResilienceRadar(baseInput({
      checkins: [
        { date: '2026-05-14', mood: 3, energy: 3, stress: 8, motivation: 3, themes: ['Rueckzug'] },
        { date: '2026-05-13', mood: 4, energy: 3, stress: 8, motivation: 4, themes: ['Arbeit'] },
        { date: '2026-05-12', mood: 3, energy: 4, stress: 7, motivation: 3, themes: ['muedigkeit'] },
        { date: '2026-05-10', mood: 4, energy: 4, stress: 7, motivation: 4, themes: [] },
      ],
      daily: [
        { date: '2026-05-14', sleepHours: 5.8, sleepScore: 54, bodyBatteryAtWake: 28, bodyBatteryMax: 36, stressAvg: 74 },
        { date: '2026-05-13', sleepHours: 6.1, sleepScore: 58, bodyBatteryAtWake: 32, bodyBatteryMax: 44, stressAvg: 68 },
      ],
      load: [
        { date: '2026-05-14', tsb: -15.4 },
        { date: '2026-05-13', tsb: -12.1 },
      ],
      support: {
        warningSigns: ['Rueckzug'],
        stabilizingActions: ['10 Minuten rausgehen'],
        contactNote: 'Max kurz schreiben.',
        activationPreference: 'coach_prompt',
      },
    }));

    expect(result.state).toBe('protect');
    expect(result.support).toMatchObject({ configured: true, suggested: true, preference: 'coach_prompt' });
    expect(result.signals.map(signal => signal.id)).toEqual(expect.arrayContaining([
      'low_mood_trend',
      'low_energy_trend',
      'stress_pressure',
      'load_pressure',
      'support_plan',
    ]));
    expect(result.primaryAction.label).toBe('Supportplan vorbereiten');
    expect(result.primaryAction.targetPath).toMatch(/^\/coach\?prompt=/);
    const prompt = decodeURIComponent(result.primaryAction.targetPath.split('prompt=')[1] ?? '');
    expect(prompt).toContain('Supportplan');
    expect(prompt).toContain('Max kurz schreiben.');
    expect(prompt).toContain('keine automatische Kontaktaufnahme');
  });

  it('rebuilds the smallest routine when check-ins disappeared after earlier use', () => {
    const result = buildResilienceRadar(baseInput({
      checkins: [
        { date: '2026-05-08', mood: 6, energy: 5, stress: 5, motivation: 5, themes: ['routine'] },
        { date: '2026-05-06', mood: 5, energy: 4, stress: 6, motivation: 4, themes: ['routine'] },
        { date: '2026-05-04', mood: 6, energy: 6, stress: 4, motivation: 6, themes: [] },
      ],
    }));

    expect(result.state).toBe('rebuild');
    expect(result.signals.map(signal => signal.id)).toContain('routine_gap');
    expect(result.primaryAction).toMatchObject({
      label: 'Check-in neu starten',
      targetPath: '/data?tab=today#data-mental',
    });
  });

  it('stays in learning mode when evidence is not sufficient yet', () => {
    const result = buildResilienceRadar(baseInput({
      checkins: [
        { date: '2026-05-14', mood: 4, energy: 4, stress: 7, motivation: 4, themes: ['stress'] },
      ],
    }));

    expect(result.state).toBe('learning');
    expect(result.evidenceQuality).toMatchObject({ checkins: 1, confidence: 'insufficient' });
    expect(result.primaryAction).toMatchObject({
      label: 'Check-in speichern',
      targetPath: '/data?tab=today#data-mental',
    });
    expect(result.support.suggested).toBe(false);
  });
});
