import type { PulseFitnessLoadPoint } from './daily-loop.js';

// Mental fitness, guided check-in and mental load Pulse contracts.
export interface PulseMentalCheckin {
  id: string;
  userId: string;
  date: string;
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
  notes: string | null;
  themes: string[] | null;
  source: string;
  coachQuestions: Array<{ question: string; answer: string | null }> | null;
  createdAt: string;
}

export interface PulseMentalThemeOccurrence {
  id: string;
  date: string;
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
  notes: string | null;
}

export interface PulseMentalThemeSummary {
  theme: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  weeklyFrequency: Array<{ weekStart: string; count: number }>;
  isResurfacing: boolean;
  isResolved: boolean;
  occurrences: PulseMentalThemeOccurrence[];
}

export interface PulseMentalThemesResponse {
  themes: PulseMentalThemeSummary[];
  totalCheckins: number;
}

export interface PulseGuidedCheckinQuestion {
  id: string;
  label: string;
  rationale: string;
  answerMode: 'scale' | 'short_text' | 'choice';
}

export interface PulseGuidedMentalAction {
  id: string;
  label: string;
  rationale: string;
  targetRoute: '/coach' | '/data' | '/plan';
  closureKind: 'reflection' | 'boundary' | 'recovery' | 'movement' | 'support';
}

export interface PulseGuidedCheckinResponse {
  date: string;
  questions: PulseGuidedCheckinQuestion[];
  action: PulseGuidedMentalAction | null;
}
export interface PulseMentalLoadOverlayPoint extends PulseFitnessLoadPoint {
  mood: number | null;
  energy: number | null;
  stress: number | null;
  motivation: number | null;
}

export interface PulseMentalLoadOverlayResponse {
  days: number;
  points: PulseMentalLoadOverlayPoint[];
  stats: {
    checkins: number;
    avgMood: number | null;
    avgStress: number | null;
    moodTsbCorrelation: number | null;
    lowTsbCheckins: number;
  };
}

export type PulseResilienceRadarState = 'learning' | 'steady' | 'watch' | 'protect' | 'rebuild';
export type PulseResilienceRadarSignalId =
  | 'low_mood_trend'
  | 'low_energy_trend'
  | 'stress_pressure'
  | 'load_pressure'
  | 'routine_gap'
  | 'support_plan';

export interface PulseResilienceRadarAction {
  label: string;
  targetPath: string;
  resultPreview: string;
}

export interface PulseResilienceRadarSignal {
  id: PulseResilienceRadarSignalId;
  label: string;
  summary: string;
  evidence: string[];
}

export interface PulseResilienceRadarSupport {
  configured: boolean;
  suggested: boolean;
  preference: 'suggest_only' | 'coach_prompt' | 'manual_only';
  note: string | null;
}

export interface PulseResilienceRadarResponse {
  days: number;
  state: PulseResilienceRadarState;
  title: string;
  summary: string;
  primaryAction: PulseResilienceRadarAction;
  signals: PulseResilienceRadarSignal[];
  support: PulseResilienceRadarSupport;
  evidenceQuality: {
    checkins: number;
    garminDays: number;
    loadDays: number;
    confidence: 'insufficient' | 'learning' | 'usable';
  };
}
