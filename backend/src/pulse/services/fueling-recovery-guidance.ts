import type {
  PulseFuelingPreferences,
  PulseFuelingRecoveryEvidence,
  PulseFuelingRecoveryGuidanceItem,
  PulseFuelingRecoveryGuidanceResponse,
} from '@coaching-os/shared/pulse';
import {
  buildCarbPortionEquivalent,
  buildSodiumBottleEquivalent,
} from './fueling-portions.js';
import {
  buildMnstryBicarbProductText,
  buildMnstryDuringCarbProductText,
  buildMnstryPostWorkoutProductText,
  buildMnstryPreWorkoutProductText,
  buildMnstrySodiumProductText,
} from './fueling-products.js';

type FuelingActivityType = 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';

export interface FuelingRecoveryWorkoutInput {
  id?: string;
  plannedDate: string;
  activityType: FuelingActivityType;
  zone: number;
  durationMin: number;
  targetTss?: number | null;
  description?: string | null;
}

export interface FuelingRecoveryProfileInput {
  weightKg?: number | null;
}

export interface FuelingRecoveryRecoveryInput {
  readinessScore?: number | null;
  sleepDebt7dH?: number | null;
  hrvStatus?: string | null;
  bodyBatteryMax?: number | null;
}

export interface FuelingRecoveryRaceInput {
  title: string;
  phase: string;
  daysUntil: number;
}

export type FuelingRecoveryGuidanceItem = PulseFuelingRecoveryGuidanceItem;
export type FuelingRecoveryEvidence = PulseFuelingRecoveryEvidence;
export type FuelingRecoveryGuidance = PulseFuelingRecoveryGuidanceResponse;

export interface BuildFuelingRecoveryGuidanceInput {
  workout: FuelingRecoveryWorkoutInput;
  preferences: PulseFuelingPreferences;
  profile?: FuelingRecoveryProfileInput | null;
  recovery?: FuelingRecoveryRecoveryInput | null;
  race?: FuelingRecoveryRaceInput | null;
}

function activityLabel(activityType: FuelingActivityType): string {
  switch (activityType) {
    case 'bike': return 'Rad';
    case 'run': return 'Lauf';
    case 'swim': return 'Schwimmen';
    case 'strength': return 'Kraft';
    case 'hike': return 'Hike';
    default: return 'Training';
  }
}

function isEnduranceFuelingSport(activityType: FuelingActivityType): boolean {
  return activityType === 'bike' || activityType === 'run' || activityType === 'hike';
}

function weakRecovery(recovery: FuelingRecoveryRecoveryInput | null | undefined): boolean {
  if (!recovery) return false;
  if (recovery.readinessScore != null && recovery.readinessScore < 50) return true;
  if (recovery.sleepDebt7dH != null && recovery.sleepDebt7dH >= 5) return true;
  if (recovery.bodyBatteryMax != null && recovery.bodyBatteryMax < 45) return true;
  return recovery.hrvStatus === 'poor'
    || recovery.hrvStatus === 'below_normal'
    || recovery.hrvStatus === 'declining';
}

function raceWeek(race: FuelingRecoveryRaceInput | null | undefined): boolean {
  return race?.phase === 'race_week' || race?.phase === 'race_day';
}

function formatRange(min: number, max: number): string {
  return `${Math.round(min)}-${Math.round(max)} g`;
}

function bodyWeightCarbs(weightKg: number | null | undefined, minGKg: number, maxGKg: number): string | null {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  return formatRange(weightKg * minGKg, weightKg * maxGKg);
}

function evidenceForRecovery(recovery: FuelingRecoveryRecoveryInput | null | undefined): FuelingRecoveryEvidence | null {
  if (!recovery) return null;
  if (weakRecovery(recovery)) {
    const parts = [
      recovery.readinessScore != null ? `Readiness ${recovery.readinessScore}/100` : null,
      recovery.sleepDebt7dH != null ? `Schlafdefizit ${recovery.sleepDebt7dH.toFixed(1)} h` : null,
      recovery.hrvStatus ? `HRV ${recovery.hrvStatus}` : null,
      recovery.bodyBatteryMax != null ? `Body Battery max ${recovery.bodyBatteryMax}` : null,
    ].filter(Boolean);
    return { label: 'Recovery', value: parts.join(' · ') || 'Recovery vorsichtig', status: 'caution' };
  }
  if (recovery.readinessScore != null) {
    return { label: 'Recovery', value: `Readiness ${recovery.readinessScore}/100`, status: 'supporting' };
  }
  return null;
}

function recoveryCautions(recovery: FuelingRecoveryRecoveryInput | null | undefined): string[] {
  if (!recovery || !weakRecovery(recovery)) return [];
  const cautions: string[] = [];
  if (recovery.sleepDebt7dH != null && recovery.sleepDebt7dH >= 5) {
    cautions.push(`Schlafdefizit ${recovery.sleepDebt7dH.toFixed(1)} h: halte Fueling und Einheit einfach, verträglich und ohne Experimente.`);
  }
  if (recovery.hrvStatus === 'declining' || recovery.hrvStatus === 'poor' || recovery.hrvStatus === 'below_normal') {
    cautions.push('HRV/Recovery schwach: eher untere Carb-Range nutzen und Recovery danach priorisieren.');
  }
  if (recovery.bodyBatteryMax != null && recovery.bodyBatteryMax < 45) {
    cautions.push('Body Battery niedrig: keine aggressiven Fueling- oder Intensitäts-Experimente.');
  }
  return cautions.length > 0 ? cautions : ['Recovery schwach: Fueling einfach halten und Nachbereitung priorisieren.'];
}

function shouldShowGuidance(input: BuildFuelingRecoveryGuidanceInput): boolean {
  const { workout, recovery, race } = input;
  if (!input.preferences.fuelingEnabled) return false;
  if (weakRecovery(recovery)) return true;
  if (raceWeek(race)) return true;
  if (!isEnduranceFuelingSport(workout.activityType)) return workout.durationMin >= 75 || workout.zone >= 3;
  return workout.durationMin >= 75 || (workout.zone >= 3 && workout.durationMin >= 60);
}

function buildBefore(input: BuildFuelingRecoveryGuidanceInput, isWeakRecovery: boolean): FuelingRecoveryGuidanceItem[] {
  const { workout, profile, preferences, race } = input;
  const items: FuelingRecoveryGuidanceItem[] = [];
  if (workout.durationMin < 75 && !isWeakRecovery && !raceWeek(race)) return items;

  const weightRange = preferences.bodyWeightGuidanceEnabled
    ? bodyWeightCarbs(profile?.weightKg, workout.durationMin >= 150 ? 1 : 0.5, workout.durationMin >= 150 ? 2 : 1)
    : null;
  if (weightRange) {
    items.push({
      id: 'pre-carbs-weight',
      text: `2-3 h vorher verträgliche Kohlenhydrate einplanen: ca. ${weightRange} (${workout.durationMin >= 150 ? '1-2' : '0,5-1'} g/kg) als Orientierung.`,
    });
  } else {
    items.push({
      id: 'pre-carbs-simple',
      text: 'Vorher eine verträgliche, kohlenhydratbetonte Mahlzeit oder einen kleinen Snack einplanen.',
    });
  }

  const productText = buildMnstryPreWorkoutProductText(preferences.preferredFuelingProducts);
  if (productText) {
    items.push({
      id: 'pre-mnstry-porridge',
      text: productText,
    });
  }

  if (raceWeek(race)) {
    items.push({
      id: 'race-no-experiments',
      text: 'Race Week: nichts Neues testen, sondern die bekannte Ministry-/Alltagsstrategie stabil halten.',
    });
  }

  return items;
}

function carbRange(input: BuildFuelingRecoveryGuidanceInput, isWeakRecovery: boolean): { min: number; max: number; text: string } | null {
  const { workout, preferences } = input;
  if (preferences.carbGuidanceStyle === 'avoid_amounts') return null;
  if (!isEnduranceFuelingSport(workout.activityType)) return null;
  if (workout.durationMin < 60 && workout.zone < 3) return null;
  if (isWeakRecovery) return { min: 30, max: 45, text: '30-45 g Kohlenhydrate pro Stunde' };
  if (workout.durationMin >= 150) return { min: 60, max: 90, text: '60-90 g Kohlenhydrate pro Stunde' };
  if (workout.durationMin >= 75) return { min: 30, max: 60, text: '30-60 g Kohlenhydrate pro Stunde' };
  return { min: 20, max: 30, text: '20-30 g Kohlenhydrate pro Stunde optional' };
}

function buildDuring(input: BuildFuelingRecoveryGuidanceInput, isWeakRecovery: boolean): FuelingRecoveryGuidanceItem[] {
  const { workout, preferences, race } = input;
  const items: FuelingRecoveryGuidanceItem[] = [];
  const carbs = carbRange(input, isWeakRecovery);

  if (carbs) {
    const portion = buildCarbPortionEquivalent({
      durationMin: workout.durationMin,
      minCarbsPerHour: carbs.min,
      maxCarbsPerHour: carbs.max,
    });
    const portionText = portion.text.replace(`Für ${workout.durationMin} min: `, '');
    const productText = buildMnstryDuringCarbProductText({
      preferredProducts: preferences.preferredFuelingProducts,
      totalMinG: portion.totalMinG,
      totalMaxG: portion.totalMaxG,
    });
    const longSessionNote = workout.durationMin >= 150 && !isWeakRecovery
      ? ' Nur mit geübter Glukose-/Fruktose-Strategie Richtung obere Range gehen.'
      : '';
    items.push({
      id: 'during-carbs',
      text: productText
        ? `${carbs.text} mit ${productText} (${portionText}).${longSessionNote}`
        : `${carbs.text} (${portionText}); ${preferences.preferredFuelingProducts || 'gewohnte Produkte'} als Produktanker nutzen.${longSessionNote}`,
    });
  } else if (isWeakRecovery || workout.durationMin < 75) {
    items.push({
      id: 'during-water',
      text: 'Wasser nach Durst reicht; bei Hitze oder viel Schweiß kleine Elektrolytmenge erwägen.',
    });
  }

  const bicarbText = buildMnstryBicarbProductText({
    preferredProducts: preferences.preferredFuelingProducts,
    isRaceWeek: raceWeek(race),
    isHighIntensity: workout.zone >= 4,
  });
  if (bicarbText) {
    items.push({
      id: 'during-mnstry-bicarb-special',
      text: bicarbText,
    });
  }

  if (workout.durationMin >= 75 && preferences.sodiumGuidanceStyle === 'suggest_ranges') {
    const sodium = buildSodiumBottleEquivalent({ minSodiumMgPerL: 400, maxSodiumMgPerL: 800 });
    const productSodiumText = buildMnstrySodiumProductText(preferences.preferredFuelingProducts);
    items.push({
      id: 'during-sodium',
      text: productSodiumText
        ? `Sodium konservativ starten: ca. 400-800 mg Sodium pro Liter, also grob ${sodium.bottle750MinMg}-${sodium.bottle750MaxMg} mg pro 750 ml Flasche. ${productSodiumText}`
        : `Sodium konservativ starten: ca. 400-800 mg Sodium pro Liter (${sodium.text}), an Hitze und echte Schweißrate anpassen und keine Gewichtszunahme durch Übertrinken riskieren.`,
    });
  }

  return items;
}

function buildAfter(input: BuildFuelingRecoveryGuidanceInput, isWeakRecovery: boolean): FuelingRecoveryGuidanceItem[] {
  const { workout, preferences } = input;
  const items: FuelingRecoveryGuidanceItem[] = [];
  if (workout.durationMin < 75 && !isWeakRecovery) return items;

  items.push({
    id: 'after-recovery',
    text: 'Recovery innerhalb von 2 h starten: trinken, normale Mahlzeit, Kohlenhydrate plus Protein und kurze Notiz zur Vertraeglichkeit.',
  });

  if (workout.durationMin >= 90 || workout.zone >= 3) {
    items.push({
      id: 'after-rapid-refuel',
      text: 'Wenn am nächsten Tag wieder Qualität geplant ist: 0,8-1,0 g/kg Kohlenhydrate in den ersten Stunden als vorsichtige Orientierung nutzen.',
    });
  }

  const productText = buildMnstryPostWorkoutProductText(preferences.preferredFuelingProducts);
  if (productText) {
    items.push({
      id: 'after-mnstry-protein-bar',
      text: productText,
    });
  }

  return items;
}

export function buildFuelingRecoveryGuidance(input: BuildFuelingRecoveryGuidanceInput): FuelingRecoveryGuidance {
  const { workout, preferences, recovery, race } = input;
  const evidence: FuelingRecoveryEvidence[] = [{
    label: 'Workout',
    value: `${workout.durationMin} min Zone ${workout.zone}`,
    status: workout.durationMin >= 75 || workout.zone >= 3 ? 'supporting' : 'supporting',
  }];
  const recoveryEvidence = evidenceForRecovery(recovery);
  if (recoveryEvidence) evidence.push(recoveryEvidence);
  if (raceWeek(race) && race) {
    evidence.push({
      label: 'Race Context',
      value: `${race.title} in ${race.daysUntil} Tagen`,
      status: 'caution',
    });
  }

  if (!preferences.fuelingEnabled) {
    return {
      shouldShow: false,
      preferenceStatus: 'disabled',
      before: [],
      during: [],
      after: [],
      recoveryCautions: [],
      evidence,
    };
  }

  const isWeakRecovery = weakRecovery(recovery);
  const show = shouldShowGuidance(input);
  if (!show) {
    return {
      shouldShow: false,
      preferenceStatus: 'ready',
      before: [],
      during: [],
      after: [],
      recoveryCautions: [],
      evidence,
    };
  }

  const before = buildBefore(input, isWeakRecovery);
  const during = buildDuring(input, isWeakRecovery);
  const after = buildAfter(input, isWeakRecovery);

  if (workout.durationMin >= 150 && isEnduranceFuelingSport(workout.activityType)) {
    evidence.push({
      label: 'Guideline',
      value: `${activityLabel(workout.activityType)} lang: Carb-/Sodium-Plan sinnvoll`,
      status: 'supporting',
    });
  }

  return {
    shouldShow: true,
    preferenceStatus: 'ready',
    before,
    during,
    after,
    recoveryCautions: recoveryCautions(recovery),
    evidence,
  };
}
