export type ReadinessColor = 'green' | 'yellow' | 'red';

export interface ReadinessScore {
  score: number;           // 0–100
  color: ReadinessColor;
  components: {
    hrv: number;           // 0–100 Teilscore
    sleep: number;
    restingHr: number;
    checkin: number;
  };
  date: string;            // YYYY-MM-DD
}

export type CoachMessageRole = 'coach' | 'user';
export type CoachTriggerType = 'proactive' | 'daily_briefing' | 'chat' | 'report';

export interface CoachMessage {
  id: string;
  role: CoachMessageRole;
  content: string;
  triggerType: CoachTriggerType;
  triggerReason: string | null;
  evidenceIds: number[];
  createdAt: string;        // ISO datetime
  readAt: string | null;
}

export type TrainingZone = 1 | 2 | 3 | 4 | 5;
export type SportType = 'run' | 'road_cycle' | 'gravel_cycle' | 'swim' | 'strength' | 'other';
export type SessionStatus = 'planned' | 'completed' | 'skipped';

export interface TrainingSession {
  id: string;
  plannedDate: string;      // YYYY-MM-DD
  sportType: SportType;
  zone: TrainingZone;
  durationMin: number;
  distanceKm: number | null;
  status: SessionStatus;
  garminActivityId: string | null;
  actualDurationMin: number | null;
  actualHrAvg: number | null;
}

export interface WeeklyPlan {
  id: string;
  weekStart: string;        // YYYY-MM-DD (Monday)
  phase: 1 | 2 | 3 | 4 | 5;
  weeklyTss: number;
  sessions: TrainingSession[];
  notes: string | null;
  generatedAt: string;
}
