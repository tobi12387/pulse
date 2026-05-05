export type MentalImpactLevel = 'stable' | 'steady' | 'protect';

export type MentalScores = {
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
};

export function mentalImpactLevel(scores: MentalScores): MentalImpactLevel {
  if (scores.mood <= 4 || scores.energy <= 3 || scores.stress >= 7 || scores.motivation <= 3) return 'protect';
  if (scores.mood <= 6 || scores.energy <= 5 || scores.stress >= 5 || scores.motivation <= 6) return 'steady';
  return 'stable';
}

export function mentalImpactLabels(level: MentalImpactLevel): {
  health: string;
  fitness: string;
  dailyImpact: string;
  planImpact: string;
} {
  if (level === 'protect') {
    return {
      health: 'schuetzen',
      fitness: 'schonen',
      dailyImpact: 'Heute kleinere Schritte, klare Grenze und kein Zusatzdruck.',
      planImpact: 'Plan vorsichtig interpretieren: Intensitaet nur bewusst halten.',
    };
  }
  if (level === 'steady') {
    return {
      health: 'sensibel',
      fitness: 'dosieren',
      dailyImpact: 'Heute hilft ein klarer Rahmen mehr als mehr Optionen.',
      planImpact: 'Plan bleibt moeglich, aber mit enger Belastungsgrenze.',
    };
  }
  return {
    health: 'stabil',
    fitness: 'bereit',
    dailyImpact: 'Heute reicht ein normaler Startimpuls ohne Sonderbremse.',
    planImpact: 'Plan kann normal bewertet werden, solange Garmin/Readiness mitziehen.',
  };
}

export function mentalImpact(scores: MentalScores) {
  const level = mentalImpactLevel(scores);
  return {
    level,
    labels: mentalImpactLabels(level),
  };
}
