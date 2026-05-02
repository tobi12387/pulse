import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/llm.js', () => ({
  llmComplete:  vi.fn().mockResolvedValue('{}'),
  llmChat:      vi.fn().mockResolvedValue('Coach-Antwort'),
  FAST_MODEL:   'test-model',
  SMART_MODEL:  'test-model',
}));

vi.mock('../../lib/env.js', () => ({
  env: {
    FAST_MODEL: 'test-model', SMART_MODEL: 'test-model',
    OPENROUTER_API_KEY: 'test', APP_URL: 'http://localhost:3000',
  },
}));

describe('buildRichSystemPrompt', () => {
  it('includes readiness and today date', async () => {
    const { buildRichSystemPrompt } = await import('./coach-engine.js');
    const prompt = buildRichSystemPrompt({
      today: '2026-04-27',
      readiness: { score: 75, label: 'good' },
      todayMetrics: { sleepHours: 7.2, sleepScore: 82, hrvRmssd: 48, hrvStatus: 'normal', restingHr: 55, bodyBatteryMax: 72, stressAvg: 28, steps: 8500 },
      todayCheckin: { mood: 7, energy: 8, stress: 3, motivation: 9, notes: null },
      load: { ctl: 52, atl: 58, tsb: -6 },
      profile: { ftpWatts: 171, maxHrBpm: 182, vo2max: 52, trainingPhase: 'base' },
      recentActivities: [],
      upcomingWorkouts: [],
      metrics14: [],
      checkins14: [],
      latestWeight: { weightKg: 78.2, date: '2026-04-27', trend30d: -0.4 },
    });
    expect(prompt).toContain('2026-04-27');
    expect(prompt).toContain('75/100');
    expect(prompt).toContain('CTL 52');
    expect(prompt).toContain('FTP 171W');
    expect(prompt).toContain('78.2kg');
  });

  it('handles null metrics gracefully', async () => {
    const { buildRichSystemPrompt } = await import('./coach-engine.js');
    const prompt = buildRichSystemPrompt({
      today: '2026-04-27',
      readiness: { score: 50, label: 'moderate' },
      todayMetrics: null,
      todayCheckin: null,
      load: { ctl: 30, atl: 35, tsb: -5 },
      profile: null,
      recentActivities: [],
      upcomingWorkouts: [],
      metrics14: [],
      checkins14: [],
      latestWeight: null,
    });
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('50/100');
  });

  it('includes RPE feedback for recent activities', async () => {
    const { buildRichSystemPrompt } = await import('./coach-engine.js');
    const prompt = buildRichSystemPrompt({
      today: '2026-04-27',
      readiness: { score: 72, label: 'good' },
      todayMetrics: null,
      todayCheckin: null,
      load: { ctl: 44, atl: 50, tsb: -6 },
      profile: null,
      recentActivities: [
        {
          date: '2026-04-26',
          activityType: 'bike',
          durationSec: 3600,
          tss: 48,
          normalizedPowerW: 140,
          avgHr: 132,
          plannedZone: 2,
          rpe: 8,
          rpeNote: 'Beine zäh',
        },
        {
          date: '2026-04-25',
          activityType: 'run',
          durationSec: 1800,
          tss: 35,
          normalizedPowerW: null,
          avgHr: 140,
          plannedZone: null,
          rpe: null,
          rpeNote: null,
        },
      ],
      upcomingWorkouts: [],
      metrics14: [],
      checkins14: [],
      latestWeight: null,
    });
    expect(prompt).toContain('RPE=8/10');
    expect(prompt).toContain('Beine zäh');
    expect(prompt).toContain('kein RPE');
  });

  it('includes active risk signals in coach context', async () => {
    const { buildRichSystemPrompt } = await import('./coach-engine.js');
    const prompt = buildRichSystemPrompt({
      today: '2026-04-27',
      readiness: { score: 45, label: 'mäßig' },
      todayMetrics: null,
      todayCheckin: null,
      load: { ctl: 44, atl: 50, tsb: -6 },
      profile: null,
      recentActivities: [],
      upcomingWorkouts: [],
      metrics14: [],
      checkins14: [],
      latestWeight: null,
      activeRiskSignals: [{
        id: 'risk-1',
        ruleId: 'ctl_ramp_overshoot',
        severity: 'critical',
        status: 'active',
        title: 'CTL-Ramp +9.2 pro Woche',
        description: 'Die Trainingslast steigt schneller als empfohlen.',
        recommendation: 'Diese Woche TSS reduzieren.',
        metric: { rampPerWeek: 9.2 },
        triggeredAt: '2026-04-27T06:00:00.000Z',
        resolvedAt: null,
        snoozedUntil: null,
      }],
    });
    expect(prompt).toContain('Risk-Signal critical');
    expect(prompt).toContain('== RISIKO-SIGNALE');
    expect(prompt).toContain('[CRITICAL] CTL-Ramp +9.2 pro Woche (ctl_ramp_overshoot)');
    expect(prompt).toContain('Diese Woche TSS reduzieren.');
  });

  it('includes next best actions in the coach context', async () => {
    const { buildRichSystemPrompt } = await import('./coach-engine.js');
    const prompt = buildRichSystemPrompt({
      today: '2026-05-01',
      readiness: { score: 68, label: 'mäßig' },
      todayMetrics: null,
      todayCheckin: null,
      load: { ctl: 44, atl: 50, tsb: -6 },
      profile: null,
      recentActivities: [],
      upcomingWorkouts: [],
      metrics14: [],
      checkins14: [],
      latestWeight: null,
      nextBestActions: [{
        id: 'checkin:/coach:0',
        source: 'checkin',
        priority: 'high',
        title: 'Check-in eintragen',
        reason: 'Heute fehlt dein subjektives Signal.',
        cta: 'Zum Coach',
        targetPath: '/coach',
        resolvedBy: 'Check-in speichern.',
        evidence: ['Tages-Check-in fehlt'],
      }],
    });

    expect(prompt).toContain('== NÄCHSTE AKTIONEN ==');
    expect(prompt).toContain('[HIGH] Check-in eintragen');
    expect(prompt).toContain('Erledigt durch: Check-in speichern.');
    expect(prompt).toContain('Evidence: Tages-Check-in fehlt');
    expect(prompt).toContain('Zum Coach (/coach)');
  });

  it('includes visible hidden-action history without reopening it', async () => {
    const { buildRichSystemPrompt } = await import('./coach-engine.js');
    const prompt = buildRichSystemPrompt({
      today: '2026-05-01',
      readiness: { score: 68, label: 'mäßig' },
      todayMetrics: null,
      todayCheckin: null,
      load: { ctl: 44, atl: 50, tsb: -6 },
      profile: null,
      recentActivities: [],
      upcomingWorkouts: [],
      metrics14: [],
      checkins14: [],
      latestWeight: null,
      suppressedNextBestActions: [{
        id: 'checkin:/coach:0',
        decisionId: 'decision-1',
        source: 'checkin',
        priority: 'high',
        title: 'Check-in eintragen',
        reason: 'Heute fehlt dein subjektives Signal.',
        cta: 'Zum Coach',
        targetPath: '/coach',
        suppressedReason: 'already_completed_today',
        suppressedUntil: null,
        status: 'completed',
        resolvedAt: '2026-05-01T08:00:00.000Z',
        resolutionReason: 'Check-in für 2026-05-01 wurde gespeichert.',
      }],
    });

    expect(prompt).toContain('== SICHTBARE ACTION-HISTORIE ==');
    expect(prompt).toContain('Ausgeblendet: Check-in eintragen (already_completed_today)');
    expect(prompt).toContain('nicht erneut als offene Aufgabe');
  });

  it('includes visible coach preferences without inferring hidden traits', async () => {
    const { buildRichSystemPrompt } = await import('./coach-engine.js');
    const prompt = buildRichSystemPrompt({
      today: '2026-05-02',
      readiness: { score: 70, label: 'gut' },
      todayMetrics: null,
      todayCheckin: null,
      load: { ctl: 44, atl: 48, tsb: -4 },
      profile: null,
      recentActivities: [],
      upcomingWorkouts: [],
      metrics14: [],
      checkins14: [],
      latestWeight: null,
      coachPreferences: {
        timeWindows: 'Werktags vor 07:30 oder nach 18:30.',
        dislikedWorkoutPatterns: ['lange Sweetspot-Blöcke'],
        preferredLongDays: [6],
        injurySensitiveConstraints: ['Achillessehne vorsichtig steigern'],
        communicationStyle: 'data_first',
        updatedAt: '2026-05-02T06:00:00.000Z',
      },
    });

    expect(prompt).toContain('== SICHTBARE COACH-PRÄFERENZEN ==');
    expect(prompt).toContain('Werktags vor 07:30 oder nach 18:30.');
    expect(prompt).toContain('lange Sweetspot-Blöcke');
    expect(prompt).toContain('Lange Tage bevorzugt: Sa');
    expect(prompt).toContain('Achillessehne vorsichtig steigern');
    expect(prompt).toContain('Kommunikation: datenorientiert');
    expect(prompt).not.toContain('Persönlichkeitsprofil');
  });

  it('includes guided mental-fitness questions and keeps future workouts out of today framing', async () => {
    const { buildRichSystemPrompt } = await import('./coach-engine.js');
    const prompt = buildRichSystemPrompt({
      today: '2026-05-01',
      readiness: { score: 64, label: 'moderat' },
      todayMetrics: null,
      todayCheckin: null,
      load: { ctl: 44, atl: 48, tsb: -4 },
      profile: null,
      recentActivities: [],
      upcomingWorkouts: [{
        plannedDate: '2026-05-04',
        activityType: 'bike',
        zone: 2,
        durationMin: 80,
        description: 'Aerobe Grundlage.',
      }],
      metrics14: [],
      checkins14: [],
      latestWeight: null,
      guidedCheckin: {
        date: '2026-05-01',
        questions: [{
          id: 'rest-boundary',
          label: 'Welche Grenze macht diesen freien Tag wirklich erholsam?',
          rationale: 'Heute ist ein freier Tag; die Frage schützt Erholung und Alltag vor heimlichem Zusatzstress.',
          answerMode: 'short_text',
        }],
        action: {
          id: 'mental-boundary',
          label: 'Eine Grenze für heute setzen',
          rationale: 'Stress ist hoch und Motivation niedrig.',
          targetRoute: '/coach',
          closureKind: 'boundary',
        },
      },
    });

    expect(prompt).toContain('== MENTAL-FITNESS CHECK-IN ==');
    expect(prompt).toContain('Welche Grenze macht diesen freien Tag wirklich erholsam?');
    expect(prompt).toContain('Heute geplantes Training: keines');
    expect(prompt).toContain('Zukünftige Workouts nicht als heutige Aufgabe formulieren');
    expect(prompt).toContain('keine Diagnosen');
    expect(prompt).toContain('Selbstverletzung');
  });
});

describe('getCoachReplyRich', () => {
  it('calls llmChat with system prompt and history', async () => {
    const { llmChat }          = await import('../../lib/llm.js');
    const { getCoachReplyRich } = await import('./coach-engine.js');
    await getCoachReplyRich('Was sollte ich heute trainieren?', 'System-Prompt', [
      { role: 'user', content: 'Hallo' },
      { role: 'assistant', content: 'Hallo Tobi!' },
    ]);
    expect(llmChat).toHaveBeenCalled();
    const calls = vi.mocked(llmChat).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const messages = calls[0]![0] as Array<{ role: string; content: string }>;
    expect(messages[0]!.role).toBe('system');
    expect(messages[messages.length - 1]!.content).toBe('Was sollte ich heute trainieren?');
  });
});

describe('classifyAndExtractCheckin', () => {
  it('erkennt einen Check-in und extrahiert Scores', async () => {
    const { llmComplete } = await import('../../lib/llm.js');
    vi.mocked(llmComplete).mockResolvedValueOnce(JSON.stringify({
      isCheckin: true,
      extraction: {
        mood: 4, energy: 3, stress: 5, motivation: 4,
        themes: ['Schlaf', 'Rücken'],
        followUpQuestions: ['Seit wann hast du Rückenschmerzen?'],
      },
      coachReply: 'Ich höre, dass du dich heute müde fühlst.',
    }));
    const { classifyAndExtractCheckin } = await import('./coach-engine.js');
    const result = await classifyAndExtractCheckin('Ich fühl mich heute ziemlich müde, Rücken schmerzt.');
    expect(result.isCheckin).toBe(true);
    expect(result.extraction?.themes).toContain('Schlaf');
  });

  it('erkennt eine Frage als kein Check-in', async () => {
    const { llmComplete } = await import('../../lib/llm.js');
    vi.mocked(llmComplete).mockResolvedValueOnce(JSON.stringify({
      isCheckin: false,
      coachReply: 'Diese Woche solltest du etwa 40-50 km laufen.',
    }));
    const { classifyAndExtractCheckin } = await import('./coach-engine.js');
    const result = await classifyAndExtractCheckin('Wie viele km sollte ich diese Woche laufen?');
    expect(result.isCheckin).toBe(false);
    expect(result.extraction).toBeUndefined();
  });
});
