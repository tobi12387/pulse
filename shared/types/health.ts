export type NutritionQualityTier = 1 | 2 | 3;  // 1=verarbeitet, 2=gemischt, 3=vollwertig
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface NutritionLog {
  id: string;
  loggedAt: string;          // ISO datetime
  mealType: MealType;
  qualityTier: NutritionQualityTier;
  description: string | null;
}

export interface WeightLog {
  id: string;
  date: string;              // YYYY-MM-DD
  weightKg: number;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  source: 'garmin' | 'manual';
  note: string | null;
}

export interface GarminDailyHealth {
  date: string;              // YYYY-MM-DD
  hrvRmssd: number | null;
  hrvStatus: string | null;
  sleepDurationH: number | null;
  sleepScore: number | null;
  restingHr: number | null;
  steps: number | null;
  caloriesActive: number | null;
  bodyBatteryMin: number | null;
  bodyBatteryMax: number | null;
  stressAvg: number | null;
}

export interface HealthTrend {
  days: GarminDailyHealth[];
  weightLogs: WeightLog[];
  nutritionLogs: NutritionLog[];
}

export interface HealthSummaryTrendDay {
  date: string;
  sleepDurationH: number | null;
  restingHr: number | null;
  bodyBatteryMax: number | null;
  steps: number | null;
}

export interface HealthSummaryResponse {
  today: GarminDailyHealth | null;
  trend7d: HealthSummaryTrendDay[];
  lastSync: string | null;
  circuitOpen: boolean;
}
