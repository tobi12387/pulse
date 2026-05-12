import type { PulseAdaptationEvent, PulsePlanRefreshPreview, PulsePlannedWorkout } from '@coaching-os/shared/pulse';
import { buildPlanChangeInbox, type PlanChangeInboxAction, type PlanChangeInboxItem } from './change-inbox-model';

type ScenarioMode = 'move' | 'reduce';

type Props = {
  today: string;
  workouts: PulsePlannedWorkout[];
  adaptationEvents: PulseAdaptationEvent[];
  refreshPreview: PulsePlanRefreshPreview | null;
  onOpenRefreshPreview: () => void;
  onReviewScenario: (mode?: ScenarioMode) => void;
  onNavigate: (path: string) => void;
  onKeep: (itemId: string) => void;
};

function priorityTone(priority: PlanChangeInboxItem['priority']): string {
  if (priority === 'action') return 'var(--amber)';
  if (priority === 'watch') return 'var(--accent)';
  return 'var(--green)';
}

function buttonLabel(action: PlanChangeInboxAction): string {
  if (action === 'open_refresh_preview') return 'Vorschau prüfen';
  if (action === 'open_execution') return 'Garmin prüfen';
  if (action === 'open_feedback') return 'Feedback öffnen';
  if (action === 'keep_plan') return 'Beibehalten';
  return 'Szenario prüfen';
}

export function PlanChangeInboxCard({
  today,
  workouts,
  adaptationEvents,
  refreshPreview,
  onOpenRefreshPreview,
  onReviewScenario,
  onNavigate,
  onKeep,
}: Props) {
  const inbox = buildPlanChangeInbox({ today, workouts, adaptationEvents, refreshPreview });
  if (inbox.items.length === 0) return null;

  function handleAction(item: PlanChangeInboxItem) {
    if (item.action === 'open_refresh_preview') {
      onOpenRefreshPreview();
      return;
    }
    if (item.action === 'open_execution') {
      onNavigate('/plan?tab=execution');
      return;
    }
    if (item.action === 'open_feedback') {
      const sourceId = item.id.startsWith('adaptation-')
        ? adaptationEvents.find(event => `adaptation-${event.id}` === item.id)?.sourceId
        : null;
      onNavigate(sourceId ? `/plan/activity/${sourceId}` : '/data?tab=analysis');
      return;
    }
    if (item.action === 'keep_plan') {
      onKeep(item.id);
      return;
    }
    const mode = item.summary.toLowerCase().includes('verschieb') || item.title.toLowerCase().includes('verschieb')
      ? 'move'
      : 'reduce';
    onReviewScenario(mode);
  }

  return (
    <section
      className="card"
      data-testid="plan-change-inbox"
      style={{
        borderColor: inbox.hasAction ? 'rgba(251,191,36,0.28)' : 'rgba(94,230,207,0.22)',
        background: inbox.hasAction ? 'rgba(251,191,36,0.045)' : 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap' }}>
        <span className="label-mono" style={{ color: inbox.hasAction ? 'var(--amber)' : 'var(--accent)' }}>
          Plan-Änderungen
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          {inbox.items.length} offen
        </span>
      </div>
      <h2 style={{ fontSize: 15, color: 'var(--text)', margin: '0 0 6px', fontWeight: 600 }}>
        Erst entscheiden, dann schreiben
      </h2>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
        {inbox.summary}
      </p>

      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {inbox.items.slice(0, 4).map(item => {
          const tone = priorityTone(item.priority);
          return (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(118px, auto)',
                gap: 10,
                alignItems: 'center',
                border: `1px solid color-mix(in srgb, ${tone} 28%, transparent)`,
                borderRadius: 5,
                background: 'var(--surface-2)',
                padding: '10px 11px',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="label-mono" style={{ color: tone, fontSize: 9, marginBottom: 5 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600, lineHeight: 1.35 }}>
                  {item.summary}
                </div>
                <div style={{ fontSize: 11.3, color: 'var(--text-2)', lineHeight: 1.45, marginTop: 5 }}>
                  Warum jetzt: {item.whyNow}
                </div>
                <div style={{ fontSize: 11.3, color: 'var(--text-3)', lineHeight: 1.45, marginTop: 4 }}>
                  Nach dem Klick: {item.resultPreview}
                </div>
                {item.evidence.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                    {item.evidence.slice(0, 3).map(evidence => (
                      <span
                        key={evidence}
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          color: 'var(--text-3)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          padding: '3px 5px',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {evidence}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleAction(item)}
                style={{
                  minHeight: 42,
                  minWidth: 44,
                  border: `1px solid ${tone}`,
                  borderRadius: 'var(--radius)',
                  background: item.priority === 'action' ? `color-mix(in srgb, ${tone} 10%, transparent)` : 'transparent',
                  color: tone,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: 0,
                  padding: '8px 10px',
                  textTransform: 'uppercase',
                }}
              >
                {item.actionLabel || buttonLabel(item.action)}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
