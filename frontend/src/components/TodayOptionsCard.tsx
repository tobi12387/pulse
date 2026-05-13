import { BatteryCharging, ClipboardCheck, Dumbbell, RotateCcw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PulseTodayOption, PulseTodayOptionsResponse } from '@coaching-os/shared/pulse';
import { useTodayOptions } from '@/pulse/hooks';
import { InlineFeedback } from '@/components/Feedback';
import { errorMessage } from '@/components/feedback-utils';
import { activityLabel } from '@/pulse/activity-labels';
import { dailyCommandAllowsTodayOptions, type DailyCommandKind } from '@/pulse/daily-command';

type Variant = 'compact' | 'full';

const TODAY_INTENTS = [
  { id: 'none', label: 'Frei', durationMin: 0, activityType: null },
  { id: 'short', label: '30 min', durationMin: 30, activityType: 'bike' },
  { id: 'medium', label: '60 min', durationMin: 60, activityType: 'bike' },
  { id: 'long', label: '2h+', durationMin: 120, activityType: 'bike' },
] as const;

const KIND_ICON: Record<PulseTodayOption['kind'], LucideIcon> = {
  workout: Dumbbell,
  rest: BatteryCharging,
  recovery: BatteryCharging,
  fueling: RotateCcw,
  feedback: ClipboardCheck,
  skills: Dumbbell,
};

const STATE_LABEL: Record<PulseTodayOptionsResponse['state'], string> = {
  completed_activity: 'Nach der Einheit',
  planned_workout: 'Heute trainieren',
  unplanned_trainable: 'TrainNow',
  recovery_protect: 'Erholung zählt',
};

function optionMeta(option: PulseTodayOption): string | null {
  if (option.kind !== 'workout' && option.kind !== 'recovery' && option.kind !== 'skills') return null;
  const parts = [
    activityLabel(option.activityType),
    option.zone ? `Z${option.zone}` : null,
    option.durationMin ? `${option.durationMin} min` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function optionTone(option: PulseTodayOption): string {
  if (option.priority === 'primary') return 'rgba(94,230,207,0.28)';
  if (option.kind === 'rest' || option.kind === 'recovery') return 'rgba(74,222,128,0.22)';
  return 'var(--border)';
}

function signalToneStyle(tone: NonNullable<PulseTodayOption['signalLabels']>[number]['tone']) {
  if (tone === 'green') return { color: 'var(--green)', borderColor: 'rgba(74,222,128,0.32)', background: 'rgba(74,222,128,0.08)' };
  if (tone === 'amber') return { color: 'var(--amber)', borderColor: 'rgba(251,191,36,0.34)', background: 'rgba(251,191,36,0.08)' };
  if (tone === 'rose') return { color: 'var(--rose)', borderColor: 'rgba(248,113,113,0.34)', background: 'rgba(248,113,113,0.08)' };
  return { color: 'var(--accent)', borderColor: 'rgba(94,230,207,0.34)', background: 'rgba(94,230,207,0.08)' };
}

function optionPurpose(option: PulseTodayOption): string {
  if (option.kind === 'rest') return 'Training bewusst auslassen und Erholung schützen.';
  if (option.kind === 'recovery') return 'Bewegung nur als Recovery-Reiz nutzen.';
  if (option.kind === 'skills') return 'Stabilität, Mobility oder Technik ergänzen, ohne Ausdauerlast zu erzwingen.';
  if (option.kind === 'fueling') return 'Versorgung, Magenverträglichkeit oder Schlaf als Trainingsvoraussetzung schließen.';
  if (option.kind === 'feedback') return 'Feedback sichern, damit Pulse die nächste Entscheidung besser bewertet.';
  return option.priority === 'primary'
    ? 'Den geplanten Trainingsreiz ausführen.'
    : 'Den Trainingsreiz leichter oder passender machen.';
}

function optionResultPreview(option: PulseTodayOption): string {
  if (option.targetPath.includes('#plan-scenario-preview')) {
    return 'Plan-Szenario öffnen; Pulse zeigt Load, Recovery und Garmin-Auswirkung vor Änderungen.';
  }
  if (option.targetPath.startsWith('/activity/') || option.targetPath.startsWith('/plan/activity/')) {
    return 'Aktivität öffnen; dein Feedback beeinflusst die nächsten Empfehlungen.';
  }
  if (option.targetPath.startsWith('/data')) {
    return 'Data öffnen; keine Plan- oder Garmin-Änderung.';
  }
  if (option.targetPath === '/') {
    return 'Heute öffnen; Tagesentscheidung prüfen, ohne Garmin zu verändern.';
  }
  if (option.targetPath.startsWith('/plan')) {
    return 'Plan öffnen; Änderungen passieren erst nach bewusster Aktion.';
  }
  return 'Ziel öffnen; Pulse schreibt erst nach einer bestätigten Aktion.';
}

function optionSafetyLine(option: PulseTodayOption): string {
  const firstSignal = option.signalLabels?.[0];
  if (option.kind === 'rest') return 'Sicherste Wahl, wenn Training nur aus Gewohnheit entstehen würde.';
  if (option.kind === 'recovery') return 'Sicher, wenn sich lockere Bewegung besser anfühlt als komplette Ruhe.';
  if (option.kind === 'skills') return 'Sicher, wenn du Nutzen willst, aber keine zusätzliche Ausdauerlast brauchst.';
  if (option.capabilityFit === 'too_hard_today') return 'Heute als Grenze behandeln und eine leichtere Option wählen.';
  if (option.capabilityFit === 'stretch') return 'Nur mit guter Tagesform, sauberem Warm-up und genug Fueling.';
  if (option.capabilityFit === 'maintenance') return firstSignal?.detail ?? 'Sicher, wenn Erhaltung wichtiger ist als Progression.';
  if (option.capabilityFit === 'productive') return firstSignal?.detail ?? 'Sicher, wenn Warm-up und Tagesgefühl passen.';
  return firstSignal?.detail ?? 'Sicher, wenn die Option zu Zeit, Körpergefühl und Ziel passt.';
}

function optionContract(option: PulseTodayOption) {
  return {
    purpose: optionPurpose(option),
    whyNow: option.detail,
    result: optionResultPreview(option),
    safety: optionSafetyLine(option),
  };
}

function safestAlternative(options: PulseTodayOption[]): PulseTodayOption | null {
  return options.find(option => option.kind === 'rest')
    ?? options.find(option => option.kind === 'recovery')
    ?? options.find(option => option.capabilityFit === 'maintenance')
    ?? options[0]
    ?? null;
}

function mobileIntentTarget(option: typeof TODAY_INTENTS[number]): string {
  const params = new URLSearchParams({
    tab: 'training',
    source: 'mobile-intent',
    scenario: option.id === 'none' ? 'reduce_volume' : 'workout',
    activityType: option.activityType ?? 'bike',
    durationMin: String(option.durationMin),
    zone: option.id === 'long' ? '2' : '1',
    description: option.id === 'none'
      ? 'Heute bewusst frei halten.'
      : `Heute ${option.label} moeglich; Pulse prueft Auswirkung auf Woche und Garmin.`,
  });
  return `/plan?${params.toString()}#plan-scenario-preview`;
}

export function TodayOptionsCard({
  variant = 'compact',
  onNavigate,
  commandKind,
  showPlanActionContract = false,
}: {
  variant?: Variant;
  onNavigate: (path: string) => void;
  commandKind?: DailyCommandKind;
  showPlanActionContract?: boolean;
}) {
  const query = useTodayOptions();
  const data = query.data?.todayOptions ?? null;

  if (query.isLoading) return null;
  if (query.error) {
    if (variant === 'compact') return null;
    return (
      <InlineFeedback
        title="Tagesoptionen nicht erreichbar"
        message={errorMessage(query.error, 'Pulse konnte die heutigen Optionen nicht laden.')}
        actionLabel="Erneut laden"
        actionPending={query.isFetching}
        onAction={() => { void query.refetch(); }}
      />
    );
  }
  if (!data) return null;
  if (variant === 'compact' && !dailyCommandAllowsTodayOptions(commandKind)) return null;
  const showMobileIntent = variant === 'compact'
    && (commandKind === 'free_trainable' || (commandKind == null && data.state === 'unplanned_trainable'));
  if (!showMobileIntent && data.options.length === 0) return null;

  const options = variant === 'compact' ? data.options.slice(0, 2) : data.options;
  const primaryOption = options.find(option => option.priority === 'primary') ?? options[0] ?? null;
  const planActionContractVisible = showPlanActionContract && primaryOption != null;
  const visibleOptions = showPlanActionContract && primaryOption
    ? options.filter(option => option.id !== primaryOption.id)
    : options;
  const cardClassName = [
    'card',
    planActionContractVisible ? 'today-options-card--plan-action' : null,
  ].filter(Boolean).join(' ');

  return (
    <section
      className={cardClassName}
      data-testid={variant === 'compact' ? 'today-options-card' : 'today-options-card-full'}
      style={{
        padding: variant === 'compact' ? 12 : 14,
        borderColor: data.state === 'recovery_protect' ? 'rgba(74,222,128,0.26)' : 'rgba(94,230,207,0.18)',
      }}
    >
      <div className="today-options-card__header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="label-mono" style={{ color: data.state === 'recovery_protect' ? 'var(--green)' : 'var(--accent)', marginBottom: 5 }}>
            {showMobileIntent ? 'Heute möglich' : STATE_LABEL[data.state]}
          </div>
          {!planActionContractVisible && (
            <p style={{ margin: 0, fontSize: variant === 'compact' ? 12 : 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
              {data.summary}
            </p>
          )}
          {data.fuelingDebt?.hasOpenDebt && (
            <div
              data-testid="today-options-fueling-debt"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                marginTop: 8,
                alignItems: 'center',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--amber)',
                border: '1px solid rgba(251,191,36,0.34)',
                borderRadius: 4,
                background: 'rgba(251,191,36,0.08)',
                padding: '3px 5px',
              }}>
                {data.fuelingDebt.label}
              </span>
              {variant === 'full' && (
                <span style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4 }}>
                  {data.fuelingDebt.closureCondition}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="today-options-card__refresh"
          onClick={() => { void query.refetch(); }}
          aria-label="Tagesoptionen aktualisieren"
          title="Tagesoptionen aktualisieren"
          style={{
            width: 44,
            minWidth: 44,
            height: 44,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--surface-2)',
            color: 'var(--text-2)',
            display: 'grid',
            placeItems: 'center',
            cursor: query.isFetching ? 'wait' : 'pointer',
            opacity: query.isFetching ? 0.55 : 1,
          }}
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      </div>

      {showPlanActionContract && primaryOption && (
        <div
          className="plan-primary-action-card"
          data-testid="plan-primary-action"
          style={{
            display: 'grid',
            gap: 7,
            marginBottom: visibleOptions.length > 0 ? 10 : 0,
            padding: '10px 11px',
            border: '1px solid rgba(94,230,207,0.26)',
            borderRadius: 6,
            background: 'rgba(94,230,207,0.05)',
          }}
        >
          <div className="plan-primary-action-copy">
            <div className="label-mono" style={{ color: 'var(--accent)' }}>Plan-Aktion</div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, lineHeight: 1.35 }}>
              {primaryOption.title}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45, margin: 0 }}>
              Warum jetzt: {data.summary}
            </p>
            <p style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45, margin: 0 }}>
              Nach dem Klick: Pulse öffnet die Einheit oder den passenden Plan-Schritt; Änderungen bleiben bewusst, bevor Garmin betroffen ist.
            </p>
          </div>
          <button
            type="button"
            className="plan-primary-action-button"
            onClick={() => onNavigate(primaryOption.targetPath)}
            style={{
              minHeight: 42,
              background: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
              color: '#04110f',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0,
              padding: '9px 10px',
              textTransform: 'uppercase',
            }}
          >
            {primaryOption.cta}
          </button>
        </div>
      )}

      {showMobileIntent ? (
        <section
          data-testid="today-availability-intent"
          style={{
            display: 'grid',
            gap: 8,
            border: '1px solid rgba(94,230,207,0.22)',
            borderRadius: 'var(--radius)',
            background: 'rgba(94,230,207,0.05)',
            padding: 10,
          }}
        >
          <span className="label-mono" style={{ color: 'var(--accent)' }}>
            HEUTE MOEGLICH
          </span>
          <div
            role="group"
            aria-label="Heute moegliche Trainingszeit"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}
          >
            {TODAY_INTENTS.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => onNavigate(mobileIntentTarget(option))}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: option.id === 'none' ? 'var(--surface-2)' : 'rgba(94,230,207,0.08)',
                  color: option.id === 'none' ? 'var(--text-2)' : 'var(--accent)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      ) : visibleOptions.length > 0 ? (
        <>
          {variant === 'full' && (
            <div
              data-testid="today-options-alternatives-contract"
              style={{
                display: 'grid',
                gap: 6,
                marginBottom: 8,
                padding: '9px 10px',
                border: '1px solid rgba(94,230,207,0.2)',
                borderRadius: 6,
                background: 'rgba(94,230,207,0.04)',
              }}
            >
              <div className="label-mono" style={{ color: 'var(--accent)' }}>Ausweichoptionen</div>
              {(() => {
                const safest = safestAlternative(visibleOptions);
                return safest ? (
                  <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: 'var(--text-2)' }}>
                    <strong style={{ color: 'var(--text)' }}>Sicherste Option:</strong> {safest.title}. {optionSafetyLine(safest)}
                  </p>
                ) : null;
              })()}
            </div>
          )}
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: variant === 'full' ? 'repeat(auto-fit, minmax(190px, 1fr))' : '1fr' }}>
            {visibleOptions.map(option => {
              const Icon = KIND_ICON[option.kind];
              const meta = optionMeta(option);
              const contract = optionContract(option);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onNavigate(option.targetPath)}
                  style={{
                    textAlign: 'left',
                    border: `1px solid ${optionTone(option)}`,
                    background: option.priority === 'primary' ? 'rgba(94,230,207,0.06)' : 'var(--surface-2)',
                    borderRadius: 'var(--radius)',
                    padding: 10,
                    minHeight: variant === 'full' ? 122 : 78,
                    cursor: 'pointer',
                    color: 'var(--text)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 7,
                  }}
                >
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Icon size={15} color={option.priority === 'primary' ? 'var(--accent)' : 'var(--text-3)'} aria-hidden="true" />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{option.title}</span>
                  </span>
                  {meta && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
                      {meta}
                    </span>
                  )}
                  {option.signalLabels && option.signalLabels.length > 0 && (
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {option.signalLabels.slice(0, 2).map(label => {
                        const tone = signalToneStyle(label.tone);
                        return (
                          <span
                            key={`${option.id}-${label.kind}`}
                            title={label.detail}
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 9,
                              fontWeight: 700,
                              lineHeight: 1.2,
                              color: tone.color,
                              border: `1px solid ${tone.borderColor}`,
                              borderRadius: 4,
                              background: tone.background,
                              padding: '3px 5px',
                              maxWidth: '100%',
                            }}
                          >
                            {label.label}
                          </span>
                        );
                      })}
                    </span>
                  )}
                  {variant === 'full' ? (
                    <span style={{ display: 'grid', gap: 5 }}>
                      {[
                        ['Zweck', contract.purpose],
                        ['Warum jetzt', contract.whyNow],
                        ['Nach dem Klick', contract.result],
                        ['Sicher wenn', contract.safety],
                      ].map(([label, value]) => (
                        <span key={label} style={{ display: 'grid', gap: 2 }}>
                          <span className="label-mono" style={{ fontSize: 8, color: 'var(--accent)' }}>{label}</span>
                          <span style={{ fontSize: 11.2, color: 'var(--text-2)', lineHeight: 1.4 }}>{value}</span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>
                      {option.detail}
                    </span>
                  )}
                  {variant === 'full' && option.evidence.length > 0 && (
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 'auto' }}>
                      {option.evidence.slice(0, 3).map(item => (
                        <span key={item} style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          color: 'var(--text-3)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          padding: '3px 5px',
                        }}>
                          {item}
                        </span>
                      ))}
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: option.priority === 'primary' ? 'var(--accent)' : 'var(--text-3)', marginTop: 'auto' }}>
                    {option.cta}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
