export const ACTIVITY_LABEL: Record<string, string> = {
  run: 'Laufen',
  bike: 'Radfahren',
  swim: 'Schwimmen',
  strength: 'Kraft',
  hike: 'Wandern',
  other: 'Sonstiges',
};

export function activityLabel(activityType: string | null | undefined): string {
  if (!activityType) return 'Training';
  return ACTIVITY_LABEL[activityType] ?? activityType;
}

export interface WorkoutArchetypeCopy {
  label: string;
  purpose: string;
}

export const WORKOUT_ARCHETYPE_COPY: Record<string, WorkoutArchetypeCopy> = {
  recovery_spin: {
    label: 'Recovery Spin',
    purpose: 'Sehr leichter Durchblutungsreiz ohne Trainingsdruck.',
  },
  mobility_flush: {
    label: 'Mobility Flush',
    purpose: 'Mobility und lockere Durchblutung ohne Ausdauerstress.',
  },
  endurance_steady: {
    label: 'Steady Endurance',
    purpose: 'Aerober Standardbaustein fuer ruhige, wiederholbare Wochen.',
  },
  endurance_cadence: {
    label: 'Endurance Cadence',
    purpose: 'Aerober Reiz mit kurzen Kadenzfenstern, ohne echte Intensitaet.',
  },
  endurance_progressive: {
    label: 'Progressive Endurance',
    purpose: 'Ruhiger Start mit spaeter stabilem Z2-Druck.',
  },
  endurance_hills: {
    label: 'Endurance Hills',
    purpose: 'Aerober Ausdauerblock mit kontrollierten Anstiegen.',
  },
  long_endurance: {
    label: 'Long Endurance',
    purpose: 'Langer Ausdauerreiz mit Fueling- und Ermuedungsrelevanz.',
  },
  long_endurance_fueling_practice: {
    label: 'Long Fueling Practice',
    purpose: 'Langer Z2-Reiz mit bewusst gleichmaessigem Fueling.',
  },
  long_endurance_durability: {
    label: 'Long Durability',
    purpose: 'Langer Ausdauerreiz mit spaetem stabilem Druck.',
  },
  tempo_sustained: {
    label: 'Sustained Tempo',
    purpose: 'Kontrollierter Dauerleistungsreiz unterhalb der Schwelle.',
  },
  tempo_over_distance: {
    label: 'Tempo Over Distance',
    purpose: 'Laengerer Tempo-Reiz mit kontrollierter Ermuedung.',
  },
  gravel_specificity: {
    label: 'Gravel Specificity',
    purpose: 'Variable Belastung mit Tempo, Druckphasen und Fueling-Praxis.',
  },
  threshold_intervals: {
    label: 'Threshold Intervals',
    purpose: 'Gezielte Schwellenarbeit mit klaren Erholungspausen.',
  },
  threshold_cruise: {
    label: 'Threshold Cruise',
    purpose: 'Laengere kontrollierte Schwellenabschnitte.',
  },
  sweet_spot_builder: {
    label: 'Sweet Spot Builder',
    purpose: 'Z3/Z4-Mischreiz fuer Schwellennaehe ohne Spitzenreiz.',
  },
  vo2_repeats: {
    label: 'VO2 Repeats',
    purpose: 'Kurze harte Wiederholungen fuer VO2max.',
  },
  vo2_short_sharp: {
    label: 'VO2 Short Sharp',
    purpose: 'Kurze VO2-Spitzen mit wenig Zusatzumfang.',
  },
  anaerobic_sharpening: {
    label: 'Anaerobic Sharpening',
    purpose: 'Kurze Spitzen bei guter Erholung und Race-Bezug.',
  },
  strength_support: {
    label: 'Strength Support',
    purpose: 'Kraft und Stabilitaet als Belastbarkeitsbaustein.',
  },
  strength_prehab: {
    label: 'Strength Prehab',
    purpose: 'Mobility, Core und Prehab ohne Trainingsstress.',
  },
};

export function workoutArchetypeCopy(archetypeId: string | null | undefined): WorkoutArchetypeCopy | null {
  if (!archetypeId) return null;
  return WORKOUT_ARCHETYPE_COPY[archetypeId] ?? {
    label: archetypeId.replaceAll('_', ' '),
    purpose: 'Trainingsbaustein aus der Pulse-Bibliothek.',
  };
}
