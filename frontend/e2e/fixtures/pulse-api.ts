import type { Page, Route } from '@playwright/test';

const today = '2026-05-01';

type MockPulseApiOptions = {
  insightError?: boolean;
  insightErrorKind?: 'server' | 'provider' | 'data_missing';
  failEndpoints?: Record<string, {
    error: string;
    status?: number;
    code?: string;
    retryable?: boolean;
    action?: string;
    times?: number;
  }>;
  home?: Partial<typeof home>;
  coverage?: unknown;
  garminCoverage?: unknown;
  garminSignalUsefulness?: unknown;
  planTrace?: unknown;
  planWorkouts?: unknown[];
  raceCommand?: unknown;
  seasonStrategy?: unknown;
  dailyOutcomes?: unknown[];
  decisionQuality?: unknown;
  goals?: unknown[];
  actions?: unknown[];
  suppressedActions?: unknown[];
  recentDecisions?: unknown[];
  coachHistory?: unknown[];
  coachPreferences?: unknown;
  todayProposal?: unknown;
  backfillResult?: unknown | ((body: unknown) => unknown);
  onPlanWorkoutUpdate?: (workoutId: string, body: unknown) => void;
  onGoalUpdate?: (goalId: string, body: unknown) => void;
  onActionPatch?: (decisionId: string, body: unknown) => void;
  onCoachPreferencesPatch?: (body: unknown) => void;
  pushSettings?: unknown;
  healthState?: unknown;
  checkinToday?: unknown;
  checkinHistory?: unknown;
  checkinGuidance?: unknown;
  onCheckinSubmit?: (body: unknown) => void;
  textCheckinResult?: unknown | ((body: unknown) => unknown);
  onTextCheckinSubmit?: (body: unknown) => void;
  metrics?: unknown[];
  sleepSessions?: unknown[];
  profile?: unknown | (() => unknown);
  onProfilePatch?: (body: unknown) => void;
  fuelingGuidance?: unknown | ((workoutId: string | null) => unknown);
  profileSyncResult?: unknown | ((body: unknown) => unknown);
  onProfileSync?: (body: unknown) => void;
  onRequest?: (pathname: string, method: string) => void;
};

const dataStatus = {
  userReady: true,
  profileReady: true,
  garmin: {
    status: 'ready',
    lastMetricDate: today,
    lastMetricSyncAt: `${today}T05:00:00.000Z`,
    lastActivityAt: `${today}T06:00:00.000Z`,
    metricsDays14: 14,
    activitiesDays14: 5,
    issues: [],
  },
};

const coverageDay = {
  date: today,
  dailyMetrics: {
    status: 'present',
    reason: 'present',
    syncedAt: `${today}T05:00:00.000Z`,
    missingFields: [],
  },
  sleep: {
    status: 'present',
    reason: 'present',
    durationH: 7.4,
    hasStages: true,
    missingFields: [],
  },
  activities: {
    status: 'present',
    reason: 'present',
    count: 1,
    weatherCount: 1,
    missingWeatherCount: 0,
    missingFields: [],
  },
  weight: {
    status: 'present',
    reason: 'present',
    hasBodyComposition: true,
    missingFields: [],
  },
};

function garminCoverageResponse(days = 30) {
  return {
    range: { from: today, to: today, days },
    generatedAt: `${today}T08:00:00.000Z`,
    circuit: { status: 'ok', failures: 0, reason: null },
    domains: [
      {
        domain: 'activities',
        label: 'Aktivitäten',
        status: 'fresh',
        reason: 'Aktivitäten sind frisch synchronisiert.',
        lastFreshAt: `${today}T06:00:00.000Z`,
        lastFreshDate: today,
        missingDays: 0,
        partialDays: 0,
        repairableDays: 0,
        repairAction: null,
        evidence: ['1 Aktivitäten', '0 ohne Wetter'],
      },
      {
        domain: 'daily_metrics',
        label: 'Tagesmetriken',
        status: 'fresh',
        reason: 'Tagesmetriken sind aktuell und vollständig.',
        lastFreshAt: `${today}T05:00:00.000Z`,
        lastFreshDate: today,
        missingDays: 0,
        partialDays: 0,
        repairableDays: 0,
        repairAction: null,
        evidence: ['30 Tage mit Tagesmetriken'],
      },
      {
        domain: 'sleep',
        label: 'Schlaf',
        status: 'fresh',
        reason: 'Schlafdaten sind aktuell.',
        lastFreshAt: `${today}T00:00:00.000Z`,
        lastFreshDate: today,
        missingDays: 0,
        partialDays: 0,
        repairableDays: 0,
        repairAction: null,
        evidence: ['30 Tage mit Schlaf'],
      },
      {
        domain: 'hrv',
        label: 'HRV',
        status: 'fresh',
        reason: 'HRV ist aktuell nutzbar.',
        lastFreshAt: `${today}T05:00:00.000Z`,
        lastFreshDate: today,
        missingDays: 0,
        partialDays: 0,
        repairableDays: 0,
        repairAction: null,
        evidence: ['30 Tage mit HRV'],
      },
      {
        domain: 'body_composition',
        label: 'Körperdaten',
        status: 'fresh',
        reason: 'Körperzusammensetzung ist aktuell.',
        lastFreshAt: `${today}T00:00:00.000Z`,
        lastFreshDate: today,
        missingDays: 0,
        partialDays: 0,
        repairableDays: 0,
        repairAction: null,
        evidence: ['4 Gewichtseinträge'],
      },
      {
        domain: 'planned_workouts',
        label: 'Workout-Vorlagen',
        status: 'fresh',
        reason: 'Alle zukünftigen Workouts haben Garmin-Vorlagen.',
        lastFreshAt: null,
        lastFreshDate: today,
        missingDays: 0,
        partialDays: 0,
        repairableDays: 0,
        repairAction: null,
        evidence: ['2 zukünftige Workouts'],
      },
      {
        domain: 'calendar',
        label: 'Garmin-Kalender',
        status: 'fresh',
        reason: 'Alle zukünftigen Workouts sind im Garmin-Kalender geplant.',
        lastFreshAt: null,
        lastFreshDate: today,
        missingDays: 0,
        partialDays: 0,
        repairableDays: 0,
        repairAction: null,
        evidence: ['2 zukünftige Workouts'],
      },
    ],
  };
}

const readiness = {
  date: today,
  score: 78,
  label: 'gut',
  shortLabel: 'gut',
  color: 'green',
  cached: false,
  components: {
    sleep: 80,
    hrv: 74,
    tsb: 76,
    battery: 72,
    mental: 82,
    stress: 78,
  },
};

const load = {
  date: today,
  ctl: 42.4,
  atl: 48.1,
  tsb: -5.7,
  cached: false,
};

const home = {
  date: today,
  readiness,
  todayMetrics: {
    date: today,
    hrvRmssd: 51,
    hrvStatus: 'stable',
    sleepHours: 7.4,
    sleepScore: 82,
    restingHr: 49,
    bodyBatteryMax: 78,
    stressAvg: 24,
    steps: 8400,
  },
  fitnessLoad: load,
  todayWorkout: null,
  recentActivities: [],
  nextWorkout: null,
  prognosis: {
    alert: false,
    message: 'Stabiler Trainingstag.',
    horizon_days: 3,
    factors: ['HRV stabil', 'Schlaf solide'],
  },
  streaks: {
    checkinStreakDays: 4,
    workoutStreakDays: 2,
  },
  recovery: {
    sleepDebt7d: { hours: 1.2, targetH: 7.5, baselineSource: 'fixed_default', status: 'ok' },
    hrvDeviation7d: { pct: 2, recentMs: 51, baselineMs: 50, status: 'stable' },
    rhrDrift7d: { bpmAboveBaseline: 1, recent: 49, baseline: 48, status: 'normal' },
    recoveryScore: 78,
    recommendation: 'Normale Belastung ist vertretbar.',
  },
  dataStatus,
  nextBestActions: [],
};

const checkinGuidance = {
  date: today,
  questions: [
    {
      id: 'rest-boundary',
      label: 'Welche Grenze macht diesen freien Tag wirklich erholsam?',
      rationale: 'Heute ist ein freier Tag; die Frage schützt Erholung und Alltag vor heimlichem Zusatzstress.',
      answerMode: 'short_text',
    },
    {
      id: 'mental-load',
      label: 'Was zieht heute mentale Energie?',
      rationale: 'Basisfrage für den Daily Check-in: sichtbar machen, was gerade Aufmerksamkeit bindet.',
      answerMode: 'short_text',
    },
  ],
  action: null,
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function defaultProfileResponse() {
  return {
    userId: 'user-1',
    ftpWatts: 250,
    maxHrBpm: 185,
    lthrBpm: 170,
    restingHrBpm: 49,
    weeklyHoursTarget: 6,
    trainingPhase: 'base',
    vo2max: 52,
    fuelingEnabled: true,
    dietaryConstraints: [],
    preferredFuelingProducts: 'Ministry',
    carbGuidanceStyle: 'suggest_ranges',
    sodiumGuidanceStyle: 'suggest_ranges',
    bodyWeightGuidanceEnabled: true,
    provenance: {
      fields: {
        ftpWatts: { key: 'ftpWatts', label: 'FTP', value: 250, source: 'manual', sourceLabel: 'Manuell', updatedAt: `${today}T06:00:00.000Z`, warning: null },
        maxHrBpm: { key: 'maxHrBpm', label: 'Max. Puls', value: 185, source: 'activity_derived', sourceLabel: 'Aktivitäten', updatedAt: `${today}T06:00:00.000Z`, warning: null },
        lthrBpm: { key: 'lthrBpm', label: 'LTHR', value: 170, source: 'garmin_settings', sourceLabel: 'Garmin', updatedAt: `${today}T06:00:00.000Z`, warning: null },
        vo2max: { key: 'vo2max', label: 'VO2max', value: 52, source: 'garmin_settings', sourceLabel: 'Garmin', updatedAt: `${today}T06:00:00.000Z`, warning: null },
      },
      warnings: [],
    },
  };
}

function pulseResponse(pathname: string, searchParams: URLSearchParams): unknown {
  if (pathname === '/api/pulse/home') return home;
  if (pathname === '/api/pulse/readiness') return readiness;
  if (pathname === '/api/pulse/load') return load;
  if (pathname === '/api/pulse/metrics') {
    return {
      metrics: [
        {
          date: today,
          hrvRmssd: 51,
          restingHr: 49,
          sleepHours: 7.4,
          sleepScore: 82,
          bodyBatteryMax: 78,
          bodyBatteryAtWake: 72,
          bodyBatteryCharged: 46,
          bodyBatteryDrained: 38,
          stressAvg: 24,
          maxStress: 68,
          highStressSec: 1800,
          moderateIntensityMin: 32,
          vigorousIntensityMin: 12,
          avgWakingRespiration: 14.4,
          latestSpo2: 96,
          steps: 8400,
        },
        {
          date: '2026-04-30',
          hrvRmssd: 49,
          restingHr: 50,
          sleepHours: 7.1,
          sleepScore: 79,
          bodyBatteryMax: 75,
          bodyBatteryAtWake: 68,
          bodyBatteryCharged: 42,
          bodyBatteryDrained: 44,
          stressAvg: 28,
          maxStress: 74,
          highStressSec: 2700,
          moderateIntensityMin: 20,
          vigorousIntensityMin: 0,
          avgWakingRespiration: 14.8,
          latestSpo2: 95,
          steps: 7200,
        },
      ],
    };
  }
  if (pathname === '/api/pulse/briefing') {
    return { briefing: 'Heute solide trainieren, aber hartes Volumen dosieren.', date: today, cached: true };
  }
  if (pathname === '/api/pulse/checkin/today') return { checkin: { id: 'checkin-1', date: today } };
  if (pathname === '/api/pulse/checkin/guidance') return checkinGuidance;
  if (pathname === '/api/pulse/checkin/history') return { checkins: [] };
  if (pathname === '/api/pulse/risk') return { signals: [] };
  if (pathname === '/api/pulse/outcomes/daily') return { items: [] };
  if (pathname === '/api/pulse/decisions/quality') {
    const days = Number(searchParams.get('days') ?? 14);
    return {
      range: { from: '2026-04-18', to: today, days },
      qualityScore: 82,
      status: 'helpful',
      statusLabel: 'Hilfreich',
      repeatedThemes: [],
      bestEvidence: ['Outcome bestätigt: Tages-Loop wurde durch Folge-Daten bestätigt'],
      evidence: [{
        label: 'Outcome bestätigt',
        detail: 'Tages-Loop wurde durch Folge-Daten bestätigt',
        source: 'outcome_learning',
        tone: 'positive',
        date: '2026-04-30',
        targetRoute: '/data',
      }],
      suggestedAdjustment: 'Diesen Entscheidungstyp beibehalten und weiter mit aktueller Evidenz begründen.',
    };
  }
  if (pathname === '/api/pulse/health-state') return { active: [], recent: [] };
  if (pathname === '/api/pulse/plan/today/proposal') return { proposal: null };
  if (pathname === '/api/pulse/races') return { races: [] };
  if (pathname === '/api/pulse/race-command') return { command: null };
  if (pathname === '/api/pulse/season-strategy') {
    return {
      strategy: {
        horizonWeeks: 12,
        primaryGoal: { id: 'race-1', title: '70.3 Kraichgau', category: 'race', targetDate: '2026-07-11', priority: 'A' },
        currentBlock: { kind: 'build', label: 'Build', startWeek: today, endWeek: '2026-06-01', focus: 'Spezifität aufbauen, aber freie Tage schützen.' },
        upcomingBlocks: [],
        guardrails: {
          targetSessions: 4,
          maxHardDays: 1,
          deload: false,
          freeDayRationale: 'Pulse nutzt nicht alle verfügbaren Tage: mindestens ein freier Tag bleibt geschützt.',
          rationale: ['Verfügbarkeit ist größer als sinnvolle Trainingsdichte.'],
          nextBoundary: { label: 'Taper', date: '2026-06-29' },
        },
        evidence: ['A-Race in 10 Wochen', 'TSB 3.0', '6 verfügbare Tage'],
      },
    };
  }
  if (pathname === '/api/pulse/sleep') {
    return {
      sessions: [
        {
          id: 'sleep-1',
          userId: 'user-1',
          date: today,
          startTime: '2026-04-30T21:42:00.000Z',
          endTime: '2026-05-01T05:50:00.000Z',
          durationH: 8.1,
          deepSleepH: 1.5,
          remSleepH: 1.7,
          lightSleepH: 4.4,
          awakeH: 0.5,
          sleepScore: 82,
          sleepNeedMin: 510,
          sleepActualMin: 488,
          avgSleepStress: 17,
          avgSleepHr: 48,
          avgRespiration: 13.8,
          restlessMoments: 24,
          bodyBatteryChange: 51,
          breathingDisruptionIndex: 3.2,
          quality: null,
          source: 'garmin',
        },
      ],
    };
  }
  if (pathname === '/api/pulse/activities') return { activities: [] };
  if (pathname === '/api/pulse/weight') return { entries: [] };
  if (pathname === '/api/pulse/data-coverage') {
    const days = searchParams.get('days');
    const year = searchParams.get('year');
    const rangeDays = days ? Number(days) : 30;
    return {
      range: {
        from: today,
        to: today,
        days: rangeDays,
        year: year ? Number(year) : null,
      },
      summary: {
        dailyMetricsDays: rangeDays,
        sleepDays: rangeDays,
        activityDays: 1,
        activities: 1,
        weatherActivities: 1,
        weightDays: 1,
        completeDays: rangeDays,
      },
      profile: {
        updatedAt: `${today}T05:00:00.000Z`,
        ftpWatts: 250,
        maxHrBpm: 185,
        lthrBpm: 172,
        vo2max: 52,
        missing: [],
      },
      issues: [],
      days: [coverageDay],
    };
  }
  if (pathname === '/api/pulse/garmin/coverage') {
    return garminCoverageResponse(Number(searchParams.get('days') ?? 30));
  }
  if (pathname === '/api/pulse/garmin/signal-usefulness') {
    return {
      range: { from: '2026-04-02', to: today, days: Number(searchParams.get('days') ?? 30) },
      summary: { used: 2, underused: 4, missingOrSparse: 2 },
      topUnderused: [
        {
          signalKey: 'body_battery_depth',
          label: 'Body Battery Tiefe',
          status: 'underused',
          coverageDays: 18,
          sampleDays: [today],
          currentConsumers: ['Data', 'Recovery Depth'],
          recommendedNextConsumer: 'daily_decision',
          whyItMatters: 'Charge, Drain und Wert beim Aufwachen zeigen, ob Erholung wirklich aufgebaut wurde.',
          evidence: ['Aufwachen 68%', 'Charge 42', 'Drain 44'],
        },
        {
          signalKey: 'activity_hr_zones_laps',
          label: 'HR-Zonen + Laps',
          status: 'underused',
          coverageDays: 9,
          sampleDays: [today],
          currentConsumers: ['Activity Detail'],
          recommendedNextConsumer: 'plan_generation',
          whyItMatters: 'HR-Zonen und Laps zeigen Ausführungsqualität.',
          evidence: ['9 Tage mit Detailcache'],
        },
      ],
      recommendedUseCases: ['daily_decision', 'plan_generation'],
      items: [],
    };
  }
  if (pathname === '/api/pulse/coach/history') return { messages: [] };
  if (pathname === '/api/pulse/coach/preferences') {
    return {
      preferences: {
        timeWindows: '',
        dislikedWorkoutPatterns: [],
        preferredLongDays: [],
        injurySensitiveConstraints: [],
        communicationStyle: 'data_first',
        updatedAt: null,
      },
    };
  }
  if (pathname === '/api/pulse/plan') return { workouts: [] };
  if (pathname === '/api/pulse/plan/availability') return { weeks: [] };
  if (pathname.startsWith('/api/pulse/plan/trace/')) return { trace: null };
  if (pathname === '/api/pulse/goals') return { goals: [] };
  if (pathname === '/api/pulse/review/latest') return null;
  if (pathname === '/api/pulse/training-analytics') {
    return {
      weeks: Number(searchParams.get('weeks') ?? 12),
      tssHeatmap: [],
      zoneDistribution: [],
      vo2maxTrend: [],
      rpeByZone: { totalRated: 0, zones: [] },
    };
  }
  if (pathname === '/api/pulse/strength/sessions') return { sessions: [], trends: [] };
  if (pathname === '/api/pulse/mental/themes') return { themes: [], totalCheckins: 0 };
  if (pathname === '/api/pulse/mental/load-overlay') {
    return {
      days: Number(searchParams.get('days') ?? 56),
      points: [],
      stats: { checkins: 0, avgMood: null, avgStress: null, moodTsbCorrelation: null, lowTsbCheckins: 0 },
    };
  }
  if (pathname === '/api/pulse/insights') {
    return {
      domain: searchParams.get('domain') ?? 'overall',
      analysis: 'Keine Auffälligkeiten im Smoke-Test-Datensatz.',
      stats: {},
      date: today,
      cached: true,
      evidence: [
        { label: 'Trainingsdaten', value: '4 Aktivitäten', window: '30 Tage', status: 'available', targetRoute: '/plan', targetLabel: 'Plan öffnen' },
        { label: 'Readiness', value: '78/100', window: 'Heute', status: 'available', targetRoute: '/data', targetLabel: 'Data öffnen' },
      ],
      missingData: [],
    };
  }
  if (pathname === '/api/pulse/profile') {
    return defaultProfileResponse();
  }
  if (pathname === '/api/pulse/sync/status') return dataStatus;
  if (pathname === '/api/pulse/push/settings') {
    return {
      configured: true,
      publicKey: 'test-vapid-key',
      supported: true,
      subscriptions: [],
      topics: {
        briefing: true,
        checkin_reminder: true,
        risk_critical: true,
      },
      quietHours: { start: '21:00', end: '07:00' },
    };
  }
  if (pathname === '/api/pulse/equipment') return { equipment: [], defaults: [] };
  if (pathname === '/api/pulse/nutrition') return { logs: [] };
  if (pathname === '/api/pulse/fueling-recovery/guidance') {
    return {
      shouldShow: false,
      preferenceStatus: 'ready',
      before: [],
      during: [],
      after: [],
      recoveryCautions: [],
      evidence: [],
    };
  }

  return { ok: true };
}

export async function mockPulseApi(page: Page, options: MockPulseApiOptions = {}) {
  const failureCounts = new Map<string, number>();

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (!url.pathname.startsWith('/api/')) return route.continue();
    options.onRequest?.(url.pathname, request.method());
    if (request.method() === 'OPTIONS') return json(route, {});
    const failKey = `${request.method()} ${url.pathname}`;
    const failure = options.failEndpoints?.[failKey] ?? options.failEndpoints?.[url.pathname];
    if (failure) {
      const seen = failureCounts.get(failKey) ?? 0;
      const limit = failure.times ?? Number.POSITIVE_INFINITY;
      if (seen < limit) {
        failureCounts.set(failKey, seen + 1);
        return json(route, {
          error: failure.error,
          code: failure.code ?? 'mock_failure',
          retryable: failure.retryable ?? true,
          action: failure.action ?? null,
        }, failure.status ?? 500);
      }
    }
    if (url.pathname === '/api/pulse/insights' && options.insightErrorKind === 'provider') {
      return json(route, {
        error: 'KI-Provider gerade nicht verfügbar.',
        code: 'provider_unavailable',
        retryable: true,
        action: 'Versuche es später erneut oder nutze den gecachten Stand.',
      }, 503);
    }
    if (url.pathname === '/api/pulse/insights' && options.insightErrorKind === 'data_missing') {
      return json(route, {
        domain: url.searchParams.get('domain') ?? 'mental',
        analysis: 'Noch nicht genug Check-in-Daten für diesen Zeitraum.',
        stats: {},
        date: today,
        cached: false,
        status: 'data_missing',
        action: 'Trage im Coach einen Check-in ein oder wähle 90T.',
        retryable: false,
        evidence: [],
        missingData: [
          { label: 'Mental-Check-ins', reason: 'Keine Check-ins im gewählten Zeitraum.' },
        ],
      });
    }
    if (url.pathname === '/api/pulse/insights' && (options.insightError || options.insightErrorKind === 'server')) {
      return json(route, { error: 'Internal Server Error' }, 500);
    }
    if (url.pathname === '/api/pulse/home') return json(route, { ...home, ...options.home });
    if (url.pathname === '/api/pulse/actions' && request.method() === 'GET') {
      const response: { actions: unknown[]; suppressed?: unknown[]; recentDecisions?: unknown[] } = {
        actions: options.actions ?? [],
      };
      if (url.searchParams.get('includeHistory') === 'true') {
        response.suppressed = options.suppressedActions ?? [];
        response.recentDecisions = options.recentDecisions ?? [];
      }
      return json(route, response);
    }
    if (url.pathname === '/api/pulse/outcomes/daily' && options.dailyOutcomes) {
      return json(route, { items: options.dailyOutcomes });
    }
    if (url.pathname === '/api/pulse/decisions/quality' && options.decisionQuality) {
      return json(route, options.decisionQuality);
    }
    if (url.pathname.startsWith('/api/pulse/actions/') && request.method() === 'PATCH') {
      const decisionId = url.pathname.split('/').at(-1) ?? 'decision-1';
      const body = request.postDataJSON();
      options.onActionPatch?.(decisionId, body);
      return json(route, {
        decision: {
          id: decisionId,
          status: body.status,
          resolvedAt: `${today}T08:00:00.000Z`,
          resolutionReason: body.reason ?? null,
        },
      });
    }
    if (url.pathname === '/api/pulse/coach/history' && options.coachHistory) {
      return json(route, { messages: options.coachHistory });
    }
    if (url.pathname === '/api/pulse/coach/preferences' && request.method() === 'GET') {
      return json(route, {
        preferences: options.coachPreferences ?? {
          timeWindows: '',
          dislikedWorkoutPatterns: [],
          preferredLongDays: [],
          injurySensitiveConstraints: [],
          communicationStyle: 'data_first',
          updatedAt: null,
        },
      });
    }
    if (url.pathname === '/api/pulse/coach/preferences' && request.method() === 'PATCH') {
      const body = request.postDataJSON();
      options.onCoachPreferencesPatch?.(body);
      return json(route, {
        preferences: {
          timeWindows: body.timeWindows ?? '',
          dislikedWorkoutPatterns: body.dislikedWorkoutPatterns ?? [],
          preferredLongDays: body.preferredLongDays ?? [],
          injurySensitiveConstraints: body.injurySensitiveConstraints ?? [],
          communicationStyle: body.communicationStyle ?? 'data_first',
          updatedAt: `${today}T08:00:00.000Z`,
        },
      });
    }
    if (url.pathname === '/api/pulse/checkin/today' && options.checkinToday) return json(route, options.checkinToday);
    if (url.pathname === '/api/pulse/checkin/history' && options.checkinHistory) return json(route, options.checkinHistory);
    if (url.pathname === '/api/pulse/checkin/guidance' && options.checkinGuidance) return json(route, options.checkinGuidance);
    if (url.pathname === '/api/pulse/checkin/text' && request.method() === 'POST') {
      const body = request.postDataJSON();
      options.onTextCheckinSubmit?.(body);
      const result = typeof options.textCheckinResult === 'function'
        ? options.textCheckinResult(body)
        : options.textCheckinResult;
      return json(route, result ?? {
        text: body.text ?? '',
        isCheckin: true,
        extraction: {
          mood: 5,
          energy: 4,
          stress: 7,
          motivation: 6,
          themes: ['Arbeit', 'Muedigkeit'],
        },
        followUpQuestions: ['Was waere heute eine gute Grenze?'],
        reply: 'Ich habe daraus einen Check-in-Vorschlag gemacht.',
      });
    }
    if (url.pathname === '/api/pulse/checkin' && request.method() === 'POST') {
      const body = request.postDataJSON();
      options.onCheckinSubmit?.(body);
      return json(route, {
        id: 'checkin-submitted',
        userId: 'user-1',
        date: today,
        mood: body.mood,
        energy: body.energy,
        stress: body.stress,
        motivation: body.motivation,
        notes: body.notes ?? null,
      });
    }
    if (url.pathname === '/api/pulse/health-state' && 'healthState' in options) return json(route, options.healthState);
    if (url.pathname === '/api/pulse/plan/today/proposal' && 'todayProposal' in options) return json(route, options.todayProposal);
    if (url.pathname === '/api/pulse/metrics' && options.metrics) return json(route, { metrics: options.metrics });
    if (url.pathname === '/api/pulse/sleep' && options.sleepSessions) return json(route, { sessions: options.sleepSessions });
    if (url.pathname === '/api/pulse/profile' && request.method() === 'GET' && 'profile' in options) {
      const profile = typeof options.profile === 'function' ? options.profile() : options.profile;
      return json(route, profile ?? defaultProfileResponse());
    }
    if (url.pathname === '/api/pulse/profile' && request.method() === 'PATCH') {
      const body = request.postDataJSON();
      options.onProfilePatch?.(body);
      return json(route, {
        ...defaultProfileResponse(),
        ...body,
      });
    }
    if (url.pathname === '/api/pulse/garmin/sync-profile' && request.method() === 'POST') {
      const body = request.postDataJSON();
      options.onProfileSync?.(body);
      const result = typeof options.profileSyncResult === 'function'
        ? options.profileSyncResult(body)
        : options.profileSyncResult;
      return json(route, result ?? {
        synced: {
          ftpWatts: { field: 'ftpWatts', value: 250, source: 'manual', status: 'kept_manual', label: 'FTP manuell gesetzt' },
          maxHrBpm: { field: 'maxHrBpm', value: 185, source: 'activity_derived', status: 'updated', label: 'Max. Puls aus Aktivitäten' },
          lthrBpm: { field: 'lthrBpm', value: 170, source: 'garmin_settings', status: 'updated', label: 'LTHR aus Garmin-Einstellungen' },
          vo2max: { field: 'vo2max', value: 52, source: 'garmin_settings', status: 'updated', label: 'VO2max aus Garmin-Einstellungen' },
        },
        diagnostics: { garminSettings: 'ok', activityRows: 20 },
        profile: defaultProfileResponse(),
      });
    }
    if (url.pathname === '/api/pulse/data-coverage' && options.coverage) return json(route, options.coverage);
    if (url.pathname === '/api/pulse/garmin/coverage' && options.garminCoverage) return json(route, options.garminCoverage);
    if (url.pathname === '/api/pulse/garmin/signal-usefulness' && options.garminSignalUsefulness) return json(route, options.garminSignalUsefulness);
    if (url.pathname === '/api/pulse/fueling-recovery/guidance') {
      const result = typeof options.fuelingGuidance === 'function'
        ? options.fuelingGuidance(url.searchParams.get('workoutId'))
        : options.fuelingGuidance;
      return json(route, result ?? {
        shouldShow: false,
        preferenceStatus: 'ready',
        before: [],
        during: [],
        after: [],
        recoveryCautions: [],
        evidence: [],
      });
    }
    if (url.pathname === '/api/pulse/garmin/backfill' && request.method() === 'POST' && options.backfillResult) {
      const body = request.postDataJSON();
      const result = typeof options.backfillResult === 'function' ? options.backfillResult(body) : options.backfillResult;
      return json(route, result);
    }
    if (url.pathname === '/api/pulse/plan') return json(route, { workouts: options.planWorkouts ?? [] });
    if (url.pathname === '/api/pulse/race-command' && 'raceCommand' in options) {
      return json(route, { command: options.raceCommand ?? null });
    }
    if (url.pathname === '/api/pulse/season-strategy' && 'seasonStrategy' in options) {
      return json(route, { strategy: options.seasonStrategy });
    }
    if (url.pathname.startsWith('/api/pulse/plan/workout/') && request.method() === 'PATCH') {
      const workoutId = url.pathname.split('/').at(-1) ?? 'workout-1';
      const body = request.postDataJSON();
      options.onPlanWorkoutUpdate?.(workoutId, body);
      return json(route, {
        workout: {
          id: workoutId,
          userId: 'user-1',
          plannedDate: body.plannedDate ?? today,
          activityType: body.activityType ?? 'bike',
          zone: body.zone ?? 2,
          durationMin: body.durationMin ?? 60,
          distanceKm: null,
          targetTss: null,
          description: body.description ?? null,
          steps: null,
          garminWorkoutId: null,
          garminScheduledId: null,
          status: body.status ?? 'planned',
          workoutFeedback: null,
          complianceScore: null,
          completedActivityId: null,
          executionStatus: body.status === 'skipped' ? 'missed' : 'local_planned',
          executionMatchedAt: null,
          executionMatchConfidence: null,
          executionNotes: 'Workout ist nur lokal in Pulse geplant.',
        },
      });
    }
    if (url.pathname.startsWith('/api/pulse/plan/trace/')) return json(route, { trace: options.planTrace ?? null });
    if (url.pathname === '/api/pulse/goals' && request.method() === 'GET') {
      return json(route, { goals: options.goals ?? [] });
    }
    if (url.pathname.startsWith('/api/pulse/goals/') && request.method() === 'PATCH') {
      const goalId = url.pathname.split('/').at(-1) ?? 'goal-1';
      const body = request.postDataJSON();
      options.onGoalUpdate?.(goalId, body);
      return json(route, {
        id: goalId,
        userId: 'user-1',
        title: body.title ?? 'Ziel',
        description: body.description ?? null,
        targetDate: body.targetDate ?? null,
        status: body.status ?? 'active',
        progress: body.progress ?? 0,
        metrics: body.metrics ?? {},
        category: body.category ?? null,
        raceDiscipline: body.raceDiscipline ?? null,
        raceDistanceKm: body.raceDistanceKm ?? null,
        raceTargetTimeSec: body.raceTargetTimeSec ?? null,
        racePriority: body.racePriority ?? null,
        raceLocation: body.raceLocation ?? null,
        raceNotes: body.raceNotes ?? null,
        createdAt: `${today}T08:00:00.000Z`,
        updatedAt: `${today}T08:00:00.000Z`,
      });
    }
    if (url.pathname === '/api/pulse/push/settings' && options.pushSettings) return json(route, options.pushSettings);
    if (url.pathname.startsWith('/api/pulse/')) return json(route, pulseResponse(url.pathname, url.searchParams));
    if (url.pathname === '/api/auth/me') return json(route, { id: 'user-1', name: 'Tobi', email: 'tobi@example.test' });
    if (url.pathname === '/api/auth/logout') return json(route, {}, 204);
    if (url.pathname === '/api/auth/login') {
      return json(route, { token: 'test-token', user: { id: 'user-1', name: 'Tobi', email: 'tobi@example.test' } });
    }

    return json(route, { ok: true });
  });
}
