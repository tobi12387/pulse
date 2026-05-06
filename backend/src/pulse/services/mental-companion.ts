import type {
  PulseGuidedCheckinQuestion,
  PulseGuidedMentalAction,
} from '@coaching-os/shared/pulse';

export type GuidedCheckinQuestion = PulseGuidedCheckinQuestion;
export type GuidedMentalAction = PulseGuidedMentalAction;

export interface MentalCompanionWorkout {
  plannedDate: string;
  activityType: string;
  zone: number;
  durationMin: number;
}

export interface MentalCompanionTheme {
  theme: string;
  count: number;
  lastSeen: string;
}

export interface MentalCompanionCheckin {
  date: string;
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
  themes?: string[] | null;
}

export interface SelectMentalCompanionInput {
  today: string;
  todayWorkout?: MentalCompanionWorkout | null;
  nextWorkout?: MentalCompanionWorkout | null;
  readinessScore?: number | null;
  stressAvg?: number | null;
  recentThemes?: MentalCompanionTheme[];
  recentCheckins?: MentalCompanionCheckin[];
}

export interface MentalCompanionGuidance {
  questions: GuidedCheckinQuestion[];
  action: GuidedMentalAction | null;
}

const DEFAULT_QUESTION: GuidedCheckinQuestion = {
  id: 'mental-load',
  label: 'Was zieht heute mentale Energie?',
  rationale: 'Basisfrage für den Daily Check-in: sichtbar machen, was gerade Aufmerksamkeit bindet.',
  answerMode: 'short_text',
};

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function latestLowMotivation(checkins: MentalCompanionCheckin[]): boolean {
  const latest = [...checkins].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  return latest != null && latest.motivation <= 4;
}

function firstTheme(themes: MentalCompanionTheme[]): MentalCompanionTheme | null {
  return [...themes].sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen))[0] ?? null;
}

function addQuestion(questions: GuidedCheckinQuestion[], question: GuidedCheckinQuestion): void {
  if (questions.some(item => item.id === question.id)) return;
  if (questions.length >= 3) return;
  questions.push(question);
}

function buildAction(input: SelectMentalCompanionInput, highStress: boolean, lowMotivation: boolean, theme: MentalCompanionTheme | null): GuidedMentalAction | null {
  if (highStress && lowMotivation) {
    return {
      id: 'mental-boundary',
      label: 'Eine Grenze für heute setzen',
      rationale: 'Stress ist hoch und Motivation niedrig; ein kleiner Schutzrahmen ist heute hilfreicher als mehr Druck.',
      targetRoute: '/coach',
      closureKind: 'boundary',
    };
  }

  if (!input.todayWorkout && highStress) {
    return {
      id: 'mental-recovery',
      label: 'Erholung bewusst sichern',
      rationale: 'Freier Tag plus hohes Stresssignal: Erholung konkret blocken, nicht nur hoffen.',
      targetRoute: '/data',
      closureKind: 'recovery',
    };
  }

  if (theme && theme.count >= 3) {
    return {
      id: 'mental-reflection',
      label: 'Wiederkehrendes Thema kurz einordnen',
      rationale: `Das Thema "${theme.theme}" taucht wiederholt auf; sichtbar notieren, was heute schützt.`,
      targetRoute: '/coach',
      closureKind: 'reflection',
    };
  }

  return null;
}

export function selectMentalCompanionGuidance(input: SelectMentalCompanionInput): MentalCompanionGuidance {
  const questions: GuidedCheckinQuestion[] = [];
  const recentCheckins = input.recentCheckins ?? [];
  const stressAvg = input.stressAvg ?? avg(recentCheckins.map(checkin => checkin.stress * 10)) ?? null;
  const highStress = stressAvg != null && stressAvg >= 70;
  const lowMotivation = latestLowMotivation(recentCheckins);
  const theme = firstTheme(input.recentThemes ?? []);
  const todayWorkout = input.todayWorkout?.plannedDate === input.today ? input.todayWorkout : null;

  if (todayWorkout) {
    addQuestion(questions, {
      id: 'today-readiness',
      label: `Wie bereit fühlst du dich heute für ${todayWorkout.activityType}?`,
      rationale: `Heute steht ${todayWorkout.activityType} Z${todayWorkout.zone} an; subjektive Bereitschaft ergänzt Garmin und Readiness.`,
      answerMode: 'scale',
    });
    addQuestion(questions, {
      id: 'workout-confidence',
      label: 'Was würde dir Sicherheit geben, die heutige Einheit passend zu steuern?',
      rationale: 'Die Frage richtet sich nur auf das Training von heute und öffnet Raum für Anpassung statt Durchziehen.',
      answerMode: 'short_text',
    });
  } else {
    addQuestion(questions, {
      id: 'rest-boundary',
      label: 'Welche Grenze macht diesen freien Tag wirklich erholsam?',
      rationale: 'Heute ist ein freier Tag; die Frage schützt Erholung und Alltag vor heimlichem Zusatzstress.',
      answerMode: 'short_text',
    });
    addQuestion(questions, DEFAULT_QUESTION);
  }

  if (highStress) {
    addQuestion(questions, {
      id: 'stress-boundary',
      label: 'Was darf heute bewusst kleiner bleiben?',
      rationale: `Stresssignal ist erhöht${stressAvg != null ? ` (${Math.round(stressAvg)}/100)` : ''}; ein kleinerer Anspruch kann Stabilität schützen.`,
      answerMode: 'short_text',
    });
  }

  if (theme && theme.count >= 2) {
    addQuestion(questions, {
      id: 'theme-reflection',
      label: `Was brauchst du heute im Umgang mit "${theme.theme}"?`,
      rationale: `Sichtbares Muster: "${theme.theme}" kam ${theme.count}x vor, zuletzt am ${theme.lastSeen}.`,
      answerMode: 'short_text',
    });
  }

  if (questions.length === 0) addQuestion(questions, DEFAULT_QUESTION);

  return {
    questions,
    action: buildAction(input, highStress, lowMotivation, theme),
  };
}
