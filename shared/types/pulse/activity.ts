// Activity, RPE, strength and equipment Pulse contracts.
export const RPE_SORENESS_AREAS = [
  'neck',
  'shoulders',
  'upper_back',
  'lower_back',
  'hip',
  'glutes',
  'quad',
  'hamstring',
  'calf',
  'knee_left',
  'knee_right',
  'achilles',
  'foot',
  'general_fatigue',
] as const;

export type RpeSorenessArea = typeof RPE_SORENESS_AREAS[number];

export interface ActivityFeedbackInput {
  rpe: number;
  rpeNote?: string | null;
  sorenessAreas?: RpeSorenessArea[] | null;
}
export interface PulseActivity {
  id: string;
  userId: string;
  externalId: string | null;
  source: string;
  startTime: string;
  activityType: 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';
  name: string | null;
  durationSec: number | null;
  distanceM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgPowerW: number | null;
  normalizedPowerW: number | null;
  tss: number | null;
  calories: number | null;
  elevationGainM: number | null;
  trainingEffectAerobic: number | null;
  trainingEffectAnaerobic: number | null;
  vo2maxEstimate: number | null;
  rpe: number | null;
  rpeNote: string | null;
  sorenessAreas: RpeSorenessArea[] | null;
  feedbackLoggedAt: string | null;
  plannedWorkoutId?: string | null;
}
export type EquipmentCategory =
  | 'chain'
  | 'tire'
  | 'brake_pad'
  | 'cassette'
  | 'running_shoe'
  | 'bike'
  | 'wetsuit'
  | 'other';

export type PulseActivityType = PulseActivity['activityType'];

export interface PulseStrengthSet {
  id: string;
  sessionId: string;
  exercise: string;
  setNumber: number;
  reps: number;
  weightKg: number | null;
  rpe: number | null;
  e1rmKg: number | null;
}

export interface PulseStrengthSession {
  id: string;
  userId: string;
  plannedWorkoutId: string | null;
  date: string;
  durationMin: number | null;
  notes: string | null;
  createdAt: string | null;
  sets: PulseStrengthSet[];
}

export interface PulseStrengthTrendPoint {
  date: string;
  exercise: string;
  e1rmKg: number;
}

export interface PulseEquipment {
  id: string;
  userId: string;
  name: string;
  category: EquipmentCategory;
  parentEquipmentId: string | null;
  activityTypes: PulseActivityType[];
  installedDate: string;
  initialKm: number | null;
  retirementKm: number | null;
  retirementDate: string | null;
  retiredAt: string | null;
  notes: string | null;
  createdAt: string | null;
  totalKm: number;
  pctConsumed: number | null;
  warning: boolean;
}

export interface PulseEquipmentDefault {
  activityType: PulseActivityType;
  equipmentId: string;
}
