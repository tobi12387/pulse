import { beforeEach, describe, it, expect, vi } from 'vitest';

const llmMocks = vi.hoisted(() => ({
  llmComplete: vi.fn(),
}));

const redisMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

const contextMocks = vi.hoisted(() => ({
  buildCachedPulseContextFor: vi.fn(),
}));

const themeMocks = vi.hoisted(() => ({
  listMentalThemes: vi.fn(),
}));

const overlayMocks = vi.hoisted(() => ({
  getMentalLoadOverlay: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  rows: [] as Array<{ date: string; mood: number; energy: number; stress: number; motivation: number }>,
}));

vi.mock('../../lib/llm.js', () => ({
  llmComplete: llmMocks.llmComplete,
  SMART_MODEL: 'test-model',
  FAST_MODEL: 'test-model',
}));

vi.mock('../../lib/env.js', () => ({
  env: { FAST_MODEL: 'test-model', OPENROUTER_API_KEY: 'test', APP_URL: 'http://localhost:3000' },
}));

vi.mock('../../lib/redis.js', () => ({
  redis: redisMocks,
}));

vi.mock('../lib/pulse-context.js', () => ({
  buildCachedPulseContextFor: contextMocks.buildCachedPulseContextFor,
}));

vi.mock('./mental-themes.js', () => ({
  listMentalThemes: themeMocks.listMentalThemes,
}));

vi.mock('./mental-load-overlay.js', () => ({
  getMentalLoadOverlay: overlayMocks.getMentalLoadOverlay,
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve(dbMocks.rows)),
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}));

vi.mock('../../db/pulse-schema.js', () => ({
  pulseInsightsCache: {
    insight: 'insight',
    userId: 'userId',
    metricKey: 'metricKey',
    expiresAt: 'expiresAt',
  },
  pulseDailyMetrics: {
    date: 'date',
    sleepHours: 'sleepHours',
    sleepScore: 'sleepScore',
    bodyBatteryMax: 'bodyBatteryMax',
    stressAvg: 'stressAvg',
    hrvRmssd: 'hrvRmssd',
    restingHr: 'restingHr',
    hrvStatus: 'hrvStatus',
  },
  pulseMentalCheckins: {
    date: 'date',
    mood: 'mood',
    energy: 'energy',
    stress: 'stress',
    motivation: 'motivation',
    userId: 'userId',
  },
  pulseActivities: {
    startTime: 'startTime',
    activityType: 'activityType',
    durationSec: 'durationSec',
    tss: 'tss',
    normalizedPowerW: 'normalizedPowerW',
    userId: 'userId',
  },
  pulseWeightLog: {
    date: 'date',
    weightKg: 'weightKg',
    bodyFatPct: 'bodyFatPct',
    muscleMassKg: 'muscleMassKg',
    userId: 'userId',
  },
  pulseUserProfile: {
    userId: 'userId',
    ftpWatts: 'ftpWatts',
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.rows = [
    { date: '2026-04-29', mood: 5, energy: 4, stress: 8, motivation: 5 },
    { date: '2026-04-30', mood: 6, energy: 6, stress: 7, motivation: 6 },
    { date: '2026-05-01', mood: 6, energy: 5, stress: 6, motivation: 7 },
  ];
  llmMocks.llmComplete.mockResolvedValue('LLM-generierter Insight.');
  redisMocks.get.mockResolvedValue(null);
  redisMocks.set.mockResolvedValue('OK');
  contextMocks.buildCachedPulseContextFor.mockResolvedValue({
    userId: 'user-123',
    date: '2026-05-01',
    todayMetrics: null,
    todayCheckin: null,
    fitnessLoad: { ctl: 42.4, atl: 54.1, tsb: -11.7, date: '2026-05-01' },
    readiness: { score: 63, label: 'mäßig', shortLabel: 'MAESSIG', color: 'amber', components: { sleep: 60, hrv: 60, tsb: 40, battery: 60, mental: 60, stress: 60 } },
    recovery: null,
    profile: null,
    activeHealthStates: [],
    recentActivities: [],
    upcomingWorkouts: [],
    metrics14d: [],
    checkins14d: [
      { date: '2026-04-29', mood: 5, energy: 4, stress: 8, motivation: 5 },
      { date: '2026-04-30', mood: 6, energy: 6, stress: 7, motivation: 6 },
      { date: '2026-05-01', mood: 6, energy: 5, stress: 6, motivation: 7 },
    ],
    latestWeight: null,
    nextRace: null,
    activeRiskSignals: [],
    recentStrengthSessions: [],
    equipmentDueForReplacement: [],
  });
  themeMocks.listMentalThemes.mockResolvedValue({
    totalCheckins: 3,
    themes: [
      {
        theme: 'work-stress',
        count: 3,
        firstSeen: '2026-04-20',
        lastSeen: '2026-05-01',
        weeklyFrequency: [],
        isResurfacing: true,
        isResolved: false,
        occurrences: [
          { id: '1', date: '2026-04-29', mood: 5, energy: 4, stress: 8, motivation: 5, notes: 'viel Arbeit' },
          { id: '2', date: '2026-04-30', mood: 6, energy: 6, stress: 7, motivation: 6, notes: null },
          { id: '3', date: '2026-05-01', mood: 6, energy: 5, stress: 6, motivation: 7, notes: null },
        ],
      },
    ],
  });
  overlayMocks.getMentalLoadOverlay.mockResolvedValue({
    days: 90,
    points: [],
    stats: { checkins: 3, avgMood: 5.7, avgStress: 7, moodTsbCorrelation: -0.4, lowTsbCheckins: 2 },
  });
});

describe('getRuleInsight', () => {
  it('returns insight for hrv_rmssd metric', async () => {
    const { getRuleInsight } = await import('./insight-engine.js');
    const insight = getRuleInsight('hrv_rmssd', 35);
    expect(insight).not.toBeNull();
    expect(typeof insight).toBe('string');
  });

  it('returns insight for sleep_hours metric', async () => {
    const { getRuleInsight } = await import('./insight-engine.js');
    const insight = getRuleInsight('sleep_hours', 5.5);
    expect(insight).toContain('5.5');
  });

  it('returns null for unknown metric', async () => {
    const { getRuleInsight } = await import('./insight-engine.js');
    expect(getRuleInsight('unknown_metric', 42)).toBeNull();
  });
});

describe('generateDeepInsight mental domain', () => {
  it('returns data-missing for sleep when the selected window has no sleep duration', async () => {
    const { generateDeepInsight } = await import('./insight-engine.js');
    const result = await generateDeepInsight('user-123', 'sleep', 30, true);

    expect(result).toMatchObject({
      domain: 'sleep',
      stats: { daysWithData: 0 },
      cached: false,
      status: 'data_missing',
      retryable: false,
      evidence: [
        expect.objectContaining({
          label: 'Schlafdauer',
          status: 'missing',
          window: '30 Tage',
        }),
      ],
      missingData: [
        expect.objectContaining({
          label: 'Schlafdaten',
          reason: 'Keine Schlafdauer im gewählten Zeitraum.',
        }),
      ],
    });
    expect(llmMocks.llmComplete).not.toHaveBeenCalled();
  });

  it('uses PulseContext, themes, load overlay stats, and a days-aware cache key', async () => {
    const { generateDeepInsight } = await import('./insight-engine.js');

    const result = await generateDeepInsight('user-123', 'mental', 90);

    expect(result.analysis).toBe('LLM-generierter Insight.');
    expect(redisMocks.get.mock.calls[0]?.[0]).toContain(':mental:90:');
    expect(contextMocks.buildCachedPulseContextFor).toHaveBeenCalledWith('user-123', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(themeMocks.listMentalThemes).toHaveBeenCalledWith('user-123', 90);
    expect(overlayMocks.getMentalLoadOverlay).toHaveBeenCalledWith('user-123', 90);

    const prompt = llmMocks.llmComplete.mock.calls[0]?.[1] as string;
    expect(prompt).toContain('work-stress');
    expect(prompt).toContain('Analysefenster (90 Tage)');
    expect(prompt).toContain('CTL=42.4');
    expect(prompt).toContain('TSB=-11.7');
    expect(prompt).toContain('r=-0.4');
    expect(prompt).toContain('narrativ-deskriptiv');
    expect(result.stats).toMatchObject({
      ctl: 42,
      tsb: -12,
      topTheme: 'work-stress',
      resurfacingThemes: 1,
      moodTsbCorrelation: -0.4,
    });
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Mental-Check-ins',
        value: '3 Einträge',
        window: '90 Tage',
        status: 'available',
        targetRoute: '/data',
      }),
      expect.objectContaining({
        label: 'Theme-Historie',
        value: '1 Theme',
        window: '90 Tage',
        status: 'available',
      }),
      expect.objectContaining({
        label: 'Mental/TSB-Overlay',
        value: 'r=-0.4',
        window: '90 Tage',
        status: 'available',
        targetRoute: '/insights',
      }),
    ]));
    expect(result.missingData).toEqual([]);
  });

  it('still analyzes historical non-recurring check-ins outside the 14-day PulseContext slice', async () => {
    dbMocks.rows = [
      { date: '2026-03-12', mood: 4, energy: 4, stress: 8, motivation: 5 },
    ];
    contextMocks.buildCachedPulseContextFor.mockResolvedValueOnce({
      ...(await contextMocks.buildCachedPulseContextFor()),
      checkins14d: [],
    });
    themeMocks.listMentalThemes.mockResolvedValueOnce({ totalCheckins: 1, themes: [] });

    const { generateDeepInsight } = await import('./insight-engine.js');
    const result = await generateDeepInsight('user-123', 'mental', 90, true);

    expect(result.analysis).toBe('LLM-generierter Insight.');
    const prompt = llmMocks.llmComplete.mock.calls[0]?.[1] as string;
    expect(prompt).toContain('2026-03-12');
    expect(prompt).toContain('Ø Stimmung 4/10');
  });

  it('returns a non-retryable data-missing result when no mental data exists', async () => {
    dbMocks.rows = [];
    themeMocks.listMentalThemes.mockResolvedValueOnce({ totalCheckins: 0, themes: [] });

    const { generateDeepInsight } = await import('./insight-engine.js');
    const result = await generateDeepInsight('user-123', 'mental', 30, true);

    expect(result).toMatchObject({
      domain: 'mental',
      analysis: 'Noch nicht genug Check-in-Daten für diesen Zeitraum.',
      stats: {},
      cached: false,
      status: 'data_missing',
      action: 'Trage im Coach einen Check-in ein oder wähle 90T.',
      retryable: false,
      evidence: [],
      missingData: [
        expect.objectContaining({
          label: 'Mental-Check-ins',
          reason: 'Keine Check-ins im gewählten Zeitraum.',
        }),
      ],
    });
    expect(llmMocks.llmComplete).not.toHaveBeenCalled();
  });
});
