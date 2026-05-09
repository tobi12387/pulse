import { BatteryCharging, ClipboardCheck, Dumbbell, RotateCcw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PulseTodayOption, PulseTodayOptionsResponse } from '@coaching-os/shared/pulse';
import { useTodayOptions } from '@/pulse/hooks';
import { InlineFeedback, errorMessage } from '@/components/Feedback';

type Variant = 'compact' | 'full';

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
    option.activityType,
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

export function TodayOptionsCard({
  variant = 'compact',
  onNavigate,
}: {
  variant?: Variant;
  onNavigate: (path: string) => void;
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
  if (!data || data.options.length === 0) return null;
  if (variant === 'compact' && data.state === 'planned_workout') return null;

  const options = variant === 'compact' ? data.options.slice(0, 2) : data.options;

  return (
    <section
      className="card"
      data-testid={variant === 'compact' ? 'today-options-card' : 'today-options-card-full'}
      style={{
        padding: variant === 'compact' ? 12 : 14,
        borderColor: data.state === 'recovery_protect' ? 'rgba(74,222,128,0.26)' : 'rgba(94,230,207,0.18)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="label-mono" style={{ color: data.state === 'recovery_protect' ? 'var(--green)' : 'var(--accent)', marginBottom: 5 }}>
            {STATE_LABEL[data.state]}
          </div>
          <p style={{ margin: 0, fontSize: variant === 'compact' ? 12 : 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
            {data.summary}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void query.refetch(); }}
          aria-label="Tagesoptionen aktualisieren"
          title="Tagesoptionen aktualisieren"
          style={{
            width: 34,
            minWidth: 34,
            height: 34,
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

      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: variant === 'full' ? 'repeat(auto-fit, minmax(190px, 1fr))' : '1fr' }}>
        {options.map(option => {
          const Icon = KIND_ICON[option.kind];
          const meta = optionMeta(option);
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
              <span style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>
                {option.detail}
              </span>
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
    </section>
  );
}
