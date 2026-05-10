import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Skeleton } from '@/components/Skeleton';
import { RangeControl } from '@/components/PulseChrome';
import { ThemeTimeline } from '@/components/ThemeTimeline';
import { InlineFeedback, errorMessage } from '@/components/Feedback';
import { useCheckinGuidance, useCheckinHistory, useCheckinToday, usePulseCheckin, usePulseCheckinTextPreview, usePulseHome } from '@/pulse/hooks';
import { GarminDomainHint } from '@/features/data/coverage/coverage-components';
import { mentalImpactLabels, mentalImpactLevel, type MentalImpactLevel } from '@/features/mental/mental-impact';
import type { PulseHomeScreenData } from '@coaching-os/shared/pulse';
import { MENTAL_CHECKIN_SUGGESTION_THRESHOLDS } from '@coaching-os/shared/pulse-thresholds';
import type { PulseCheckinTextPreview } from '@/pulse/api-client';

const RANGE_OPTS = [
  { value: 7, label: '7T' },
  { value: 30, label: '30T' },
  { value: 90, label: '90T' },
];

type HeadChoice = 'easy' | 'middle' | 'hard';
type EnergyChoice = 'easy' | 'middle' | 'hard';
type PressureChoice = 'easy' | 'middle' | 'hard';
type NeedChoice = 'activation' | 'structure' | 'rest';
type StateProfile = MentalImpactLevel;

type QuickChoices = {
  head: HeadChoice;
  energy: EnergyChoice;
  pressure: PressureChoice;
  need: NeedChoice;
};

type CheckinForm = {
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
  notes: string;
};

type CheckinScoreKey = keyof Omit<CheckinForm, 'notes'>;

type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  hint: string;
};

type StateProfileOption = ChoiceOption<StateProfile> & {
  choices: QuickChoices;
};

const CHECKIN_NOTES_MAX_LENGTH = 500;

const DEFAULT_QUICK_CHOICES: QuickChoices = {
  head: 'middle',
  energy: 'middle',
  pressure: 'middle',
  need: 'structure',
};

const HEAD_OPTIONS: Array<ChoiceOption<HeadChoice>> = [
  { value: 'easy', label: 'klar', hint: 'Gedanken sind geordnet.' },
  { value: 'middle', label: 'gemischt', hint: 'Ein paar offene Fäden.' },
  { value: 'hard', label: 'schwer', hint: 'Heute braucht der Kopf Schutz.' },
];

const ENERGY_OPTIONS: Array<ChoiceOption<EnergyChoice>> = [
  { value: 'easy', label: 'bereit', hint: 'Genug Reserve für den Tag.' },
  { value: 'middle', label: 'begrenzt', hint: 'Energie bewusst einteilen.' },
  { value: 'hard', label: 'leer', hint: 'Heute klein und stabil halten.' },
];

const PRESSURE_OPTIONS: Array<ChoiceOption<PressureChoice>> = [
  { value: 'easy', label: 'ruhig', hint: 'Druck ist gut steuerbar.' },
  { value: 'middle', label: 'spürbar', hint: 'Ein klarer Rahmen hilft.' },
  { value: 'hard', label: 'hoch', hint: 'Entlastung aktiv einplanen.' },
];

const NEED_OPTIONS: Array<ChoiceOption<NeedChoice>> = [
  { value: 'activation', label: 'Aktivierung', hint: 'Etwas Schwung tut gut.' },
  { value: 'structure', label: 'Struktur', hint: 'Der Tag braucht Leitplanken.' },
  { value: 'rest', label: 'Ruhe', hint: 'Erholung hat Vorrang.' },
];

const NEED_TAGS: Record<NeedChoice, string> = {
  activation: 'Bedarf: Aktivierung',
  structure: 'Bedarf: Struktur',
  rest: 'Bedarf: Ruhe',
};

const NEED_SCORE: Record<NeedChoice, number> = {
  activation: 7,
  structure: 5,
  rest: 3,
};

const STATE_PROFILES: Record<StateProfile, StateProfileOption> = {
  stable: {
    value: 'stable',
    label: 'Stabil starten',
    hint: 'Mental Health ruhig, Mental Fitness bereit. Einfach speichern reicht.',
    choices: { head: 'easy', energy: 'easy', pressure: 'easy', need: 'activation' },
  },
  steady: {
    value: 'steady',
    label: 'Dosiert bleiben',
    hint: 'Etwas Reibung, aber steuerbar. Der Tag braucht Leitplanken.',
    choices: { head: 'middle', energy: 'middle', pressure: 'middle', need: 'structure' },
  },
  protect: {
    value: 'protect',
    label: 'Schutzmodus',
    hint: 'Kopf und Reserven schützen. Heute kleiner planen.',
    choices: { head: 'hard', energy: 'hard', pressure: 'hard', need: 'rest' },
  },
};

const STATE_PROFILE_OPTIONS: StateProfileOption[] = [
  STATE_PROFILES.stable,
  STATE_PROFILES.steady,
  STATE_PROFILES.protect,
];

const SCORE_LABELS: Record<CheckinScoreKey, string> = {
  mood: 'Stimmung',
  energy: 'Energie',
  stress: 'Stress',
  motivation: 'Motivation',
};

function focusRadioAtIndex(currentButton: HTMLButtonElement, index: number) {
  const buttons = currentButton
    .closest('[role="radiogroup"]')
    ?.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
  window.requestAnimationFrame(() => buttons?.[index]?.focus());
}

function handleRadioArrowKey(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  optionCount: number,
  selectIndex: (index: number) => void,
) {
  const direction =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -1
        : 0;

  if (direction === 0 || optionCount === 0) return;

  event.preventDefault();
  const nextIndex = (index + direction + optionCount) % optionCount;
  selectIndex(nextIndex);
  focusRadioAtIndex(event.currentTarget, nextIndex);
}

function scoresFromQuickChoices(choices: QuickChoices): Omit<CheckinForm, 'notes'> {
  return {
    mood: choices.head === 'easy' ? 8 : choices.head === 'middle' ? 6 : 3,
    energy: choices.energy === 'easy' ? 8 : choices.energy === 'middle' ? 5 : 2,
    stress: choices.pressure === 'easy' ? 2 : choices.pressure === 'middle' ? 5 : 8,
    motivation: NEED_SCORE[choices.need],
  };
}

function buildInitialForm(choices: QuickChoices = DEFAULT_QUICK_CHOICES): CheckinForm {
  return { ...scoresFromQuickChoices(choices), notes: '' };
}

function appendUniqueLine(notes: string, line: string): string {
  const trimmed = notes.trim().slice(0, CHECKIN_NOTES_MAX_LENGTH);
  if (trimmed.includes(line)) return trimmed;
  const next = trimmed.length > 0 ? `${trimmed}\n${line}` : line;
  return next.length <= CHECKIN_NOTES_MAX_LENGTH ? next : trimmed;
}

function stateProfileFromChoices(choices: QuickChoices): StateProfile {
  if (choices.head === 'hard' || choices.energy === 'hard' || choices.pressure === 'hard' || choices.need === 'rest') {
    return 'protect';
  }
  if (choices.head === 'middle' || choices.energy === 'middle' || choices.pressure === 'middle' || choices.need === 'structure') {
    return 'steady';
  }
  return 'stable';
}

function stateProfileFromScores(scores: Omit<CheckinForm, 'notes'>): StateProfile {
  return mentalImpactLevel(scores);
}

function needFromMotivation(motivation: number): NeedChoice {
  if (motivation <= 3) return 'rest';
  if (motivation <= 6) return 'structure';
  return 'activation';
}

function buildCheckinNotes(notes: string, scores: Omit<CheckinForm, 'notes'>): string {
  const labels = mentalImpactLabels(stateProfileFromScores(scores));
  const withNeed = appendUniqueLine(notes, NEED_TAGS[needFromMotivation(scores.motivation)]);
  return [`Mental Health: ${labels.health}`, `Mental Fitness: ${labels.fitness}`].reduce(
    (nextNotes, line) => appendUniqueLine(nextNotes, line),
    withNeed,
  );
}

function buildSuggestion(home?: PulseHomeScreenData) {
  const metrics = home?.todayMetrics;
  const readiness = home?.readiness;
  const sleepScore = metrics?.sleepScore ?? null;
  const sleepHours = metrics?.sleepHours ?? null;
  const bodyBattery = metrics?.bodyBatteryMax ?? metrics?.bodyBatteryAtWake ?? null;
  const stressAvg = metrics?.stressAvg ?? null;
  const hrvStatus = metrics?.hrvStatus ?? null;
  const readinessScore = readiness?.score ?? null;
  const thresholds = MENTAL_CHECKIN_SUGGESTION_THRESHOLDS;

  const sleepHard =
    (sleepScore != null && sleepScore < thresholds.sleepScoreHardBelow) ||
    (sleepHours != null && sleepHours < thresholds.sleepHoursHardBelow);
  const sleepGood =
    (sleepScore != null && sleepScore >= thresholds.sleepScoreGoodAtLeast) ||
    (sleepHours != null && sleepHours >= thresholds.sleepHoursGoodAtLeast);
  const batteryHard = bodyBattery != null && bodyBattery < thresholds.bodyBatteryHardBelow;
  const batteryGood = bodyBattery != null && bodyBattery >= thresholds.bodyBatteryGoodAtLeast;
  const stressHard = stressAvg != null && stressAvg >= thresholds.stressHardAtLeast;
  const stressGood = stressAvg != null && stressAvg <= thresholds.stressGoodAtMost;
  const readinessHard = readinessScore != null && readinessScore < thresholds.readinessHardBelow;
  const readinessGood = readinessScore != null && readinessScore >= thresholds.readinessGoodAtLeast;

  const head: HeadChoice =
    stressHard || sleepHard || hrvStatus === 'poor' || hrvStatus === 'below_normal'
      ? 'hard'
      : sleepGood && stressGood
        ? 'easy'
        : 'middle';
  const energy: EnergyChoice =
    batteryHard || sleepHard || readinessHard
      ? 'hard'
      : batteryGood && sleepGood && readinessGood
        ? 'easy'
        : 'middle';
  const pressure: PressureChoice = stressHard ? 'hard' : stressGood ? 'easy' : 'middle';
  const need: NeedChoice =
    head === 'hard' || energy === 'hard' || pressure === 'hard'
      ? 'rest'
      : head === 'middle' || energy === 'middle' || pressure === 'middle'
        ? 'structure'
        : 'activation';

  const factors = [
    sleepScore != null
      ? `Schlafscore ${sleepScore}`
      : sleepHours != null
        ? `Schlaf ${sleepHours.toFixed(1)} h`
        : 'Schlafsignal offen',
    bodyBattery != null ? `Body Battery ${bodyBattery}` : 'Body Battery offen',
    stressAvg != null ? `Garmin Stress ${stressAvg}` : 'Stresssignal offen',
    readinessScore != null ? `Readiness ${readinessScore}` : 'Readiness offen',
  ];

  const tone =
    need === 'rest'
      ? 'Heute eher schützen: niedrigere Reizlast, klare Grenze, kurze Reflexion.'
      : need === 'structure'
        ? 'Heute stabil halten: nicht überdenken, sondern mit einem klaren Rahmen starten.'
        : 'Heute ist Aktivierung plausibel: ein kleiner Startimpuls reicht.';

  return {
    choices: { head, energy, pressure, need },
    factors,
    tone,
  };
}

function SegmentedBar({ label, value, onChange, color = 'var(--accent)' }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color?: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color }}>{value}/10</span>
      </div>
      <div
        role="radiogroup"
        aria-label={label}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(44px, 1fr))', gap: 4 }}
      >
        {Array.from({ length: 10 }, (_, i) => {
          const selected = i + 1 === value;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-label={`${label} ${i + 1}/10`}
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(i + 1)}
              onKeyDown={(event) =>
                handleRadioArrowKey(event, i, 10, nextIndex => onChange(nextIndex + 1))
              }
              style={{
                minWidth: 44,
                minHeight: 44,
                padding: 0,
                borderRadius: 2,
                cursor: 'pointer',
                background: i < value ? color : 'var(--bg)',
                border: '1px solid var(--border)',
                transition: 'background 0.1s',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function StateProfileGroup({
  value,
  onChange,
}: {
  value: StateProfile;
  onChange: (value: StateProfile) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>Wie ist deine mentale Lage?</p>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Keine Zahl nötig</span>
      </div>
      <div
        role="radiogroup"
        aria-label="Mentale Lage"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}
      >
        {STATE_PROFILE_OPTIONS.map((option, index) => {
          const selected = option.value === value;
          const labels = mentalImpactLabels(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-label={`Mentale Lage: ${option.label}`}
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) =>
                handleRadioArrowKey(event, index, STATE_PROFILE_OPTIONS.length, nextIndex => {
                  const nextOption = STATE_PROFILE_OPTIONS[nextIndex];
                  if (nextOption) onChange(nextOption.value);
                })
              }
              style={{
                minHeight: 88,
                padding: '10px 11px',
                background: selected ? 'rgba(96,165,250,0.15)' : 'var(--surface-2)',
                border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 6,
                color: selected ? 'var(--text)' : 'var(--text-2)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'block', fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>
                {option.label}
              </span>
              <span style={{ display: 'block', marginTop: 6, fontSize: 11, lineHeight: 1.35, color: 'var(--text-3)' }}>
                {option.hint}
              </span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 }}>
                <span style={{
                  padding: '3px 6px',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-2)',
                  fontSize: 10.5,
                }}>
                  Mental Health: {labels.health}
                </span>
                <span style={{
                  padding: '3px 6px',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-2)',
                  fontSize: 10.5,
                }}>
                  Mental Fitness: {labels.fitness}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuickChoiceGroup<T extends string>({
  title,
  ariaPrefix,
  value,
  options,
  onChange,
}: {
  title: string;
  ariaPrefix: string;
  value: T;
  options: Array<ChoiceOption<T>>;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{title}</p>
      <div
        role="radiogroup"
        aria-label={title}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-label={`${ariaPrefix}: ${option.label}`}
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) =>
                handleRadioArrowKey(event, index, options.length, nextIndex => {
                  const nextOption = options[nextIndex];
                  if (nextOption) onChange(nextOption.value);
                })
              }
              style={{
                minHeight: 58,
                padding: '8px 7px',
                background: selected ? 'rgba(96,165,250,0.16)' : 'var(--surface-2)',
                border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 5,
                color: selected ? 'var(--text)' : 'var(--text-2)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700, lineHeight: 1.15 }}>
                {option.label}
              </span>
              <span style={{ display: 'block', marginTop: 4, fontSize: 10.5, lineHeight: 1.25, color: 'var(--text-3)' }}>
                {option.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MentalTab() {
  const [days, setDays] = useState(30);
  const { data: today } = useCheckinToday();
  const { data: guidance } = useCheckinGuidance();
  const { data: home } = usePulseHome();
  const checkin = usePulseCheckin();
  const textPreview = usePulseCheckinTextPreview();
  const { data: histData, isLoading: histLoading } = useCheckinHistory(days);
  const suggestion = useMemo(() => buildSuggestion(home), [home]);
  const [manualQuickChoices, setManualQuickChoices] = useState<QuickChoices | null>(null);
  const [fineTuneOpen, setFineTuneOpen] = useState(false);
  const [fineTuned, setFineTuned] = useState(false);
  const [form, setForm] = useState<CheckinForm>(() => buildInitialForm());
  const [freeText, setFreeText] = useState('');
  const [textResult, setTextResult] = useState<PulseCheckinTextPreview | null>(null);
  const [textPreviewError, setTextPreviewError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const quickChoices = manualQuickChoices ?? suggestion.choices;
  const quickScores = scoresFromQuickChoices(quickChoices);
  const displayedScores = fineTuned ? form : { ...form, ...quickScores };
  const stateProfile = fineTuned ? stateProfileFromScores(displayedScores) : stateProfileFromChoices(quickChoices);
  const stateProfileDetails = mentalImpactLabels(stateProfile);

  function updateStateProfile(value: StateProfile) {
    const nextChoices = STATE_PROFILES[value].choices;
    setManualQuickChoices(nextChoices);
    setFineTuned(false);
    setForm(f => ({ ...f, ...scoresFromQuickChoices(nextChoices) }));
  }

  function updateQuickChoices(next: QuickChoices) {
    setManualQuickChoices(next);
    if (!fineTuned) {
      setForm(f => ({ ...f, ...scoresFromQuickChoices(next) }));
    }
  }

  function updateFineTune(score: keyof Omit<CheckinForm, 'notes'>, value: number) {
    setFineTuned(true);
    setForm(f => ({ ...f, ...displayedScores, [score]: value }));
  }

  function appendNote(label: string) {
    setForm(f => {
      const next = f.notes.trim().length > 0 ? `${f.notes.trim()}\n${label}` : label;
      return { ...f, notes: next.slice(0, CHECKIN_NOTES_MAX_LENGTH) };
    });
  }

  function updateFreeText(value: string) {
    setFreeText(value);
    setTextResult(null);
    setTextPreviewError(null);
  }

  async function submitCheckin() {
    const scores = fineTuned ? displayedScores : quickScores;
    const notes = buildCheckinNotes(form.notes, scores);
    setSaveError(null);
    try {
      await checkin.mutateAsync({ ...scores, notes: notes || undefined });
      setSubmitted(true);
    } catch (err) {
      setSaveError(errorMessage(err, 'Check-in konnte gerade nicht gespeichert werden. Deine Auswahl bleibt erhalten.'));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await submitCheckin();
  }

  async function handleTextPreview() {
    const text = freeText.trim();
    if (!text || textPreview.isPending) return;

    setTextPreviewError(null);
    setTextResult(null);
    try {
      const result = await textPreview.mutateAsync(text);
      setTextResult(result);

      if (result.extraction) {
        setFineTuned(true);
        setFineTuneOpen(true);
        setForm(f => ({
          ...f,
          mood: result.extraction!.mood,
          energy: result.extraction!.energy,
          stress: result.extraction!.stress,
          motivation: result.extraction!.motivation,
          notes: f.notes.trim().length > 0 ? f.notes : result.text,
        }));
      }
    } catch (err) {
      setTextPreviewError(errorMessage(err, 'Der Text konnte gerade nicht ausgewertet werden.'));
    }
  }

  const alreadyDone = today?.checkin != null;
  const checkins = histData?.checkins ?? [];
  const guidedQuestions = guidance?.questions.length
    ? guidance.questions
    : [
        {
          id: 'fallback-stability',
          label: 'Was brauchst du mental, damit heute stabil bleibt?',
          rationale: 'Basisfrage für einen freien Check-in.',
        },
        {
          id: 'fallback-smaller',
          label: 'Was darf heute bewusst kleiner bleiben?',
          rationale: 'Hilft, den Tagesanspruch realistisch zu setzen.',
        },
        {
          id: 'fallback-closure',
          label: 'Welcher kleine Abschluss würde sich heute gut anfühlen?',
          rationale: 'Macht den Tag bewusst abschließbar.',
        },
      ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <GarminDomainHint domains={['daily_metrics', 'hrv', 'sleep']} />

      {alreadyDone || submitted ? (
        <div className="card" style={{ borderColor: 'rgba(74,222,128,0.3)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', letterSpacing: '0.12em' }}>
            CHECK-IN HEUTE ERLEDIGT ✓
          </span>
        </div>
      ) : (
        <div className="card">
          <div style={{ marginBottom: 14 }}>
            <div className="label-mono" style={{ marginBottom: 6 }}>Quick Check-in</div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
              Kurzer Lageabgleich für Mental Health und Mental Fitness. Starte mit einer menschlichen Beschreibung; Pulse speichert daraus die vertrauten Trendwerte.
            </p>
          </div>
          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StateProfileGroup value={stateProfile} onChange={updateStateProfile} />
            <div
              data-testid="mental-derived-summary"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                alignItems: 'center',
                padding: '9px 10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 5,
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Keine Zahl nötig
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Mental Health: {stateProfileDetails.health}</span>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Mental Fitness: {stateProfileDetails.fitness}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Feinjustieren bleibt optional.</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <QuickChoiceGroup
                title="Wie ist dein Kopf gerade?"
                ariaPrefix="Kopf"
                value={quickChoices.head}
                options={HEAD_OPTIONS}
                onChange={head => updateQuickChoices({ ...quickChoices, head })}
              />
              <QuickChoiceGroup
                title="Wie viel Energie ist verfügbar?"
                ariaPrefix="Energie"
                value={quickChoices.energy}
                options={ENERGY_OPTIONS}
                onChange={energy => updateQuickChoices({ ...quickChoices, energy })}
              />
              <QuickChoiceGroup
                title="Was zieht gerade mentale Energie?"
                ariaPrefix="Druck"
                value={quickChoices.pressure}
                options={PRESSURE_OPTIONS}
                onChange={pressure => updateQuickChoices({ ...quickChoices, pressure })}
              />
              <QuickChoiceGroup
                title="Was brauchst du heute?"
                ariaPrefix="Tagesbedarf"
                value={quickChoices.need}
                options={NEED_OPTIONS}
                onChange={need => updateQuickChoices({ ...quickChoices, need })}
              />
            </div>
            <div style={{
              padding: '10px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
            }}>
              <div className="label-mono" style={{ marginBottom: 6 }}>Pulse Vorschlag</div>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text)', lineHeight: 1.45 }}>
                {suggestion.tone}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {suggestion.factors.map(factor => (
                  <span
                    key={factor}
                    style={{
                      padding: '4px 7px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      fontSize: 10.5,
                      color: 'var(--text-2)',
                    }}
                  >
                    {factor}
                  </span>
                ))}
              </div>
            </div>
            <div style={{
              padding: '10px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
            }}>
              <div>
                <div className="label-mono" style={{ marginBottom: 5 }}>Kurz beschreiben</div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>
                  Schreib einen Satz, wenn Werte gerade schwer greifbar sind. Pulse macht daraus einen Vorschlag, den du prüfen kannst.
                </p>
              </div>
              <textarea
                aria-label="Kurz beschreiben"
                value={freeText}
                onChange={e => updateFreeText(e.target.value)}
                rows={3}
                placeholder="Zum Beispiel: Kopf voll, Energie begrenzt, Druck spürbar."
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  padding: '8px 10px',
                  fontSize: 12,
                  color: 'var(--text)',
                  resize: 'vertical',
                  minHeight: 74,
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => void handleTextPreview()}
                  disabled={!freeText.trim() || textPreview.isPending}
                  style={{
                    minHeight: 44,
                    padding: '7px 10px',
                    background: 'var(--surface)',
                    border: '1px solid var(--accent)',
                    borderRadius: 5,
                    color: !freeText.trim() || textPreview.isPending ? 'var(--text-3)' : 'var(--accent)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: !freeText.trim() || textPreview.isPending ? 'default' : 'pointer',
                  }}
                >
                {textPreview.isPending ? 'Wird ausgewertet…' : 'Text auswerten'}
              </button>
                {textResult?.extraction && (
                  <button
                    type="button"
                    onClick={() => void submitCheckin()}
                    disabled={checkin.isPending}
                    style={{
                      minHeight: 44,
                      padding: '7px 10px',
                      background: 'var(--surface)',
                      border: '1px solid var(--green)',
                      borderRadius: 5,
                      color: checkin.isPending ? 'var(--text-3)' : 'var(--green)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      cursor: checkin.isPending ? 'default' : 'pointer',
                    }}
                  >
                    {checkin.isPending ? 'Speichern…' : 'Ergebnis speichern'}
                  </button>
                )}
              </div>
              {textPreviewError && (
                <InlineFeedback
                  title="Textanalyse"
                  message={textPreviewError}
                  tone="warning"
                />
              )}
              {textResult && !textResult.extraction && (
                <InlineFeedback
                  title="Noch kein Check-in"
                  message={textResult.reply || 'Pulse konnte daraus noch keine Check-in-Werte ableiten. Ergänze einen Satz zu Energie, Druck oder Stimmung.'}
                  tone="info"
                />
              )}
              {textResult?.extraction && (
                <div style={{
                  padding: '9px 10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                }}>
                  <div className="label-mono" style={{ marginBottom: 8 }}>Erkannte Werte prüfen</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 6 }}>
                    {(['mood', 'energy', 'stress', 'motivation'] as CheckinScoreKey[]).map(key => (
                      <span
                        key={key}
                        style={{
                          padding: '6px 7px',
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          color: 'var(--text)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10.5,
                        }}
                      >
                        {SCORE_LABELS[key]} {textResult.extraction![key]}/10
                      </span>
                    ))}
                  </div>
                  {textResult.extraction.themes.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {textResult.extraction.themes.map(theme => (
                        <span
                          key={theme}
                          style={{
                            padding: '4px 7px',
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            fontSize: 10.5,
                            color: 'var(--text-2)',
                          }}
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  )}
                  {textResult.followUpQuestions.length > 0 && (
                    <div style={{ marginTop: 8, display: 'grid', gap: 5 }}>
                      {textResult.followUpQuestions.map(question => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => appendNote(question)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-2)',
                            fontSize: 11.5,
                            lineHeight: 1.4,
                            textAlign: 'left',
                            cursor: 'pointer',
                            minHeight: 44,
                            padding: '6px 0',
                          }}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <button
                type="button"
                aria-expanded={fineTuneOpen}
                onClick={() => setFineTuneOpen(open => !open)}
                style={{
                  minHeight: 44,
                  padding: '7px 10px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  color: 'var(--text-2)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Feinjustieren
              </button>
              {fineTuneOpen && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 14,
                  marginTop: 10,
                  padding: '10px 12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                }}>
                  <SegmentedBar label="Stimmung" value={displayedScores.mood} onChange={(v) => updateFineTune('mood', v)} color="var(--accent)" />
                  <SegmentedBar label="Energie" value={displayedScores.energy} onChange={(v) => updateFineTune('energy', v)} color="var(--green)" />
                  <SegmentedBar label="Stress" value={displayedScores.stress} onChange={(v) => updateFineTune('stress', v)} color="var(--amber)" />
                  <SegmentedBar label="Motivation" value={displayedScores.motivation} onChange={(v) => updateFineTune('motivation', v)} color="var(--blue)" />
                </div>
              )}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 8,
              padding: '10px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
            }}>
              {guidedQuestions.map(question => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => appendNote(question.label)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-2)',
                    fontSize: 12,
                    lineHeight: 1.4,
                    textAlign: 'left',
                    cursor: 'pointer',
                    minHeight: 44,
                    padding: '6px 0',
                  }}
                >
                  <span style={{ display: 'block', color: 'var(--text)' }}>{question.label}</span>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 10.5, color: 'var(--text-3)' }}>
                    {question.rationale}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Mental: ruhig', 'Mental: angespannt', 'Mental: überladen', 'Fokus: klar', 'Fokus: zerstreut', 'Schutz: aktiv einplanen', 'Heute genug: klein halten'].map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => appendNote(tag)}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    padding: '5px 8px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--text-2)',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
            <textarea
              aria-label="Mentale Notizen"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value.slice(0, CHECKIN_NOTES_MAX_LENGTH) }))}
              maxLength={CHECKIN_NOTES_MAX_LENGTH}
              rows={4}
              placeholder="Was ist mental gerade wichtig? Was belastet, was schützt dich heute, und was wäre ein guter kleiner Abschluss?"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--text)',
                resize: 'none',
              }}
            />
            <button
              type="submit"
              disabled={checkin.isPending}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius)',
                minWidth: 44,
                minHeight: 44,
                padding: '9px 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                cursor: 'pointer',
              }}
            >
              {checkin.isPending ? 'Speichern…' : 'Check-in senden'}
            </button>
            {saveError && (
              <InlineFeedback
                title="Check-in speichern"
                message={saveError}
                tone="error"
                actionLabel="Erneut versuchen"
                onAction={() => void submitCheckin()}
                actionPending={checkin.isPending}
              />
            )}
          </form>
        </div>
      )}

      <ThemeTimeline />

      {checkins.length >= 3 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="label-mono">Mental Trend</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                <span style={{ color: 'var(--accent)' }}>━</span>{' '}
                <span style={{ color: 'var(--text-2)' }}>Mood</span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                <span style={{ color: 'var(--green)' }}>━</span>{' '}
                <span style={{ color: 'var(--text-2)' }}>Energy</span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                <span style={{ color: 'var(--amber)' }}>━</span>{' '}
                <span style={{ color: 'var(--text-2)' }}>Stress</span>
              </span>
            </div>
            <RangeControl value={days} onChange={setDays} options={RANGE_OPTS} />
          </div>
          {histLoading ? <Skeleton height={100} /> : (() => {
            const N = checkins.length;
            const W = 400;
            const H = 100;
            const P = 10;
            const yMin = 0;
            const yMax = 10;
            const xs = (i: number) => P + (i / (N - 1)) * (W - P * 2);
            const ys = (v: number) => H - P - ((v - yMin) / (yMax - yMin)) * (H - P * 2);
            const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i)} ${ys(v)}`).join(' ');
            return (
              <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 100 }}>
                {[2, 4, 6, 8].map(t => (
                  <line key={t} x1={P} x2={W - P} y1={ys(t)} y2={ys(t)} stroke="var(--border)" strokeWidth={0.5} />
                ))}
                <path d={path(checkins.map(c => c.mood))} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
                <path d={path(checkins.map(c => c.energy))} fill="none" stroke="var(--green)" strokeWidth={1.6} />
                <path d={path(checkins.map(c => c.stress))} fill="none" stroke="var(--amber)" strokeWidth={1.4} opacity={0.85} />
              </svg>
            );
          })()}
        </div>
      )}
    </div>
  );
}
