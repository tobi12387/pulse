import { useId, useState } from 'react';
import { useAdaptationEvents, useCheckinHistory, useCheckinToday, useDailyDecisionQuality, useDailyDelta, useDailyOutcomeLearning, useFitnessLoad, useFuelingDebt, useGoalProjection, usePulseActions, usePulseCheckin, usePulseHome, useGarminSync, useReadiness, useTodayOptions, useTrainingAnalytics, useUpdatePulseAction } from '@/pulse/hooks';
import { useNavigate } from 'react-router-dom';
import { HealthStateBanner } from '@/components/HealthStateBanner';
import { RiskWatchBanner } from '@/components/RiskWatchBanner';
import { TodayOptionsCard } from '@/components/TodayOptionsCard';
import { InlineFeedback } from '@/components/Feedback';
import { errorMessage } from '@/components/feedback-utils';
import { coachPromptPath } from '@/pulse/coach-link';
import { resolveDailyCommand } from '@/pulse/daily-command';
import { deriveDailyDecision } from '@/pulse/daily-decision';
import { mentalImpact } from '@/features/mental/mental-impact';
import { HomeSurfaceFocusCard } from '@/features/home/home-surface-preferences';
import { type HomeFocusSlot } from '@/features/home/home-surface-preferences-model';
import { useHomeSurfaceFocus } from '@/features/home/use-home-surface-focus';
import { DecisionHero } from '@/features/today/DecisionHero';
import { DayDiary } from '@/features/today/DayDiary';
import type { PulseActionState, PulseAdaptationEvent, PulseDailyDeltaItem, PulseDailyOutcomeLearningItem, PulseNextBestAction, PulseRecentActionDecision, PulseSuppressedActionState } from '@coaching-os/shared/pulse';
import { TSB_BUCKETS, bucketize, type Bucket } from '@coaching-os/shared/pulse-thresholds';
import { bucketTooltip, colorOf, formatBucketMin } from '@/lib/thresholds';

function fmt(v: number | null | undefined, dec = 0): string {
  return v == null ? '–' : v.toFixed(dec);
}

function fmtSigned(v: number, dec = 1): string {
  return `${v < 0 ? '' : '+'}${fmt(v, dec)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const day = d.toLocaleDateString('de-DE', { weekday: 'short' }).toUpperCase();
  const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${date} · ${day}`;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipDef {
  title: string;
  what: string;
  good?: string;
  bad?: string;
  ranges?: Bucket[];
}

const TOOLTIPS: Record<string, TooltipDef> = {
  HRV: {
    title: 'Heart Rate Variability',
    what: 'Variabilität zwischen Herzschlägen — Indikator für Erholungszustand des Nervensystems.',
    good: 'Hohe Werte (>50 ms) = gut erholt, bereit für intensive Belastung.',
    bad:  'Fallender Trend oder <40 ms = Überbelastung, mehr Ruhe nötig.',
  },
  RHR: {
    title: 'Resting Heart Rate',
    what: 'Ruhepuls morgens — steigt bei Müdigkeit, Krankheit oder Übertraining.',
    good: 'Nah am persönlichen Minimum = gute Erholung.',
    bad:  '+5–7 bpm über Baseline = Warnsignal, Belastung reduzieren.',
  },
  SCHLAF: {
    title: 'Schlafdauer',
    what: 'Tatsächliche Schlafdauer aus Garmin-Daten.',
    good: '7–9 h = optimal für Regeneration und Leistung.',
    bad:  '<6 h = deutlich reduzierte Erholung, kein Hochintensitätstraining.',
  },
  CTL: {
    title: 'Chronic Training Load',
    what: 'Fitness: exponentieller Durchschnitt der Trainingsbelastung (TSS) der letzten 42 Tage.',
    good: 'Langsam steigend = Aufbauphase. Typisch 40–80 für Amateure.',
    bad:  'Zu schnell steigend (>5–7/Woche) = Verletzungsrisiko.',
  },
  ATL: {
    title: 'Acute Training Load',
    what: 'Ermüdung: Durchschnitt der letzten 7 Tage — wie frisch oder müde du gerade bist.',
    good: 'Nah an CTL = ausgewogene Belastung.',
    bad:  'Deutlich über CTL (ATL >> CTL) = hohe akute Ermüdung.',
  },
  TSB: {
    ...bucketTooltip('TSB'),
  },
  READINESS: {
    ...bucketTooltip('READINESS'),
  },
};

function Tooltip({ id, children }: { id: string; children: React.ReactNode }) {
  const tooltipId = useId();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const tip = TOOLTIPS[id];
  if (!tip) return <>{children}</>;

  function handleClick(e: React.MouseEvent<HTMLElement>) {
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
  }

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setPos(null);
          }
        }}
        aria-label={`${id} erklären`}
        aria-expanded={Boolean(pos)}
        aria-describedby={pos ? tooltipId : undefined}
        style={{
          cursor: 'help',
          border: 'none',
          borderBottom: '1px dotted var(--text-3)',
          background: 'transparent',
          padding: 0,
          color: 'inherit',
          font: 'inherit',
          letterSpacing: 'inherit',
          textTransform: 'inherit',
        }}
      >
        {children}
      </button>
      {pos && (
        <>
          <button
            type="button"
            aria-label="Tooltip schließen"
            style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'transparent', border: 'none', padding: 0 }}
            onClick={() => setPos(null)}
          />
          <div id={tooltipId} role="tooltip" style={{
            position: 'fixed',
            left: Math.min(pos.x - 120, window.innerWidth - 256),
            top: pos.y - 8,
            transform: 'translateY(-100%)',
            width: 240, zIndex: 100,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '12px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: '.12em', marginBottom: 6 }}>
              {id} · {tip.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 8 }}>
              {tip.what}
            </div>
            {tip.ranges ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {tip.ranges.map(bucket => (
                  <div key={`${bucket.label}-${bucket.min}`} style={{ display: 'grid', gridTemplateColumns: '52px 74px 1fr', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
                      {formatBucketMin(bucket.min)}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: colorOf(bucket.color) }}>
                      {bucket.label}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-2)', lineHeight: 1.35 }}>
                      {bucket.description}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 10, color: 'var(--green)', lineHeight: 1.5, marginBottom: 4 }}>
                  {tip.good}
                </div>
                <div style={{ fontSize: 10, color: 'var(--rose)', lineHeight: 1.5 }}>
                  {tip.bad}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </span>
  );
}

function actionColor(priority: PulseNextBestAction['priority']): string {
  if (priority === 'critical') return 'var(--rose)';
  if (priority === 'high') return 'var(--amber)';
  return 'var(--accent)';
}

function priorityLabel(priority: PulseNextBestAction['priority']): string {
  if (priority === 'critical') return 'KRITISCH';
  if (priority === 'high') return 'WICHTIG';
  return 'NÄCHSTES';
}

function actionDecisionStatusLabel(status: PulseRecentActionDecision['status']): string {
  if (status === 'completed') return 'Erledigt';
  if (status === 'deferred') return 'Verschoben';
  if (status === 'dismissed') return 'Verworfen';
  if (status === 'superseded') return 'Ersetzt';
  return 'Offen';
}

function suppressedReasonLabel(reason: PulseSuppressedActionState['suppressedReason']): string {
  if (reason === 'already_completed_today') return 'Heute schon erledigt';
  if (reason === 'deferred') return 'Bewusst verschoben';
  if (reason === 'dismissed') return 'Bewusst verworfen';
  if (reason === 'resolved_by_activity') return 'Durch Garmin erledigt';
  return 'Nicht mehr aktuell';
}

function adaptationSeverityRank(event: PulseAdaptationEvent): number {
  if (event.severity === 'action') return 3;
  if (event.severity === 'watch') return 2;
  return 1;
}

function primaryAdaptation(events: PulseAdaptationEvent[]): PulseAdaptationEvent | null {
  return [...events].sort((a, b) =>
    adaptationSeverityRank(b) - adaptationSeverityRank(a)
    || b.createdAt.localeCompare(a.createdAt)
  )[0] ?? null;
}

function adaptationTone(event: PulseAdaptationEvent): string {
  if (event.severity === 'action') return 'var(--amber)';
  if (event.severity === 'watch') return 'var(--accent)';
  return 'var(--green)';
}

function adaptationTarget(event: PulseAdaptationEvent): { path: string; label: string } {
  if (event.recommendation === 'sync_garmin') return { path: '/settings?section=garmin', label: 'Garmin öffnen' };
  if (event.recommendation === 'log_feedback') {
    return { path: event.sourceId ? `/plan/activity/${event.sourceId}` : '/data?tab=analysis', label: 'Feedback öffnen' };
  }
  if (event.recommendation === 'keep_plan') return { path: '/plan', label: 'Plan ansehen' };
  return { path: '/plan#plan-adaptation-review', label: 'Im Plan prüfen' };
}

function HomeAdaptationEventCard({
  event,
  onNavigate,
}: {
  event: PulseAdaptationEvent;
  onNavigate: (path: string) => void;
}) {
  const tone = adaptationTone(event);
  const target = adaptationTarget(event);

  return (
    <section
      className="card"
      data-testid="home-adaptation-event"
      style={{ borderColor: 'color-mix(in srgb, var(--amber) 24%, var(--border))' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginBottom: 7 }}>
        <span className="label-mono" style={{ color: tone }}>PLAN GEPRÜFT</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase' }}>
          {event.recommendation.replaceAll('_', ' ')}
        </span>
      </div>
      <h3 style={{ margin: 0, fontSize: 14, color: 'var(--text)', fontWeight: 600, lineHeight: 1.35 }}>
        {event.summary}
      </h3>
      {event.evidence.length > 0 && (
        <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>
          {event.evidence.slice(0, 2).join(' · ')}
        </p>
      )}
      <button
        type="button"
        onClick={() => onNavigate(target.path)}
        style={{
          marginTop: 10,
          minHeight: 42,
          minWidth: 44,
          padding: '8px 11px',
          borderRadius: 'var(--radius)',
          border: `1px solid ${tone}`,
          background: 'var(--surface-2)',
          color: tone,
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 0,
          textTransform: 'uppercase',
        }}
      >
        {target.label}
      </button>
    </section>
  );
}

function outcomeStatusLabel(status: PulseDailyOutcomeLearningItem['status']): string {
  if (status === 'reinforced') return 'Bestätigt';
  if (status === 'superseded_by_data') return 'Durch Daten ersetzt';
  if (status === 'stale_pattern') return 'Muster erkannt';
  return 'Noch offen';
}

function outcomeStatusColor(status: PulseDailyOutcomeLearningItem['status']): string {
  if (status === 'reinforced') return 'var(--green)';
  if (status === 'superseded_by_data') return 'var(--blue)';
  if (status === 'stale_pattern') return 'var(--amber)';
  return 'var(--text-3)';
}

function DailyOutcomeLearningCard({ outcome }: { outcome: PulseDailyOutcomeLearningItem | null }) {
  if (!outcome) return null;
  const color = outcomeStatusColor(outcome.status);

  return (
    <div style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.14em' }}>
          GELERNT AUS GESTERN
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color }}>
          {outcomeStatusLabel(outcome.status)}
        </span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, lineHeight: 1.35 }}>
        {outcome.title}
      </div>
      <div style={{ marginTop: 5, fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
        {outcome.suggestedAdjustment}
      </div>
      {outcome.evidence.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          {outcome.evidence.slice(0, 3).map(item => (
            <span
              key={item}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--text-3)',
                padding: '3px 6px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--surface-2)',
              }}
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function dailyDeltaStatusLabel(status: PulseDailyDeltaItem['status']): string {
  if (status === 'matched') return 'Passt';
  if (status === 'replaced') return 'Anders';
  if (status === 'missed') return 'Offen';
  return 'Off-plan';
}

function dailyDeltaStatusColor(status: PulseDailyDeltaItem['status']): string {
  if (status === 'matched') return 'var(--green)';
  if (status === 'replaced') return 'var(--amber)';
  if (status === 'missed') return 'var(--rose)';
  return 'var(--accent)';
}

function DailyDeltaCard({ delta, onNavigate }: { delta: PulseDailyDeltaItem | null; onNavigate: (path: string) => void }) {
  if (!delta) return null;
  const tone = dailyDeltaStatusColor(delta.status);
  const load = delta.loadDeltaTss == null ? null : `${delta.loadDeltaTss >= 0 ? '+' : ''}${delta.loadDeltaTss} TSS`;

  return (
    <section
      data-testid="daily-delta-card"
      style={{
        padding: '10px 12px',
        background: 'var(--surface-2)',
        border: `1px solid ${tone}`,
        borderRadius: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <span className="label-mono" style={{ color: tone }}>Plan vs Ausführung</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: tone }}>
          {dailyDeltaStatusLabel(delta.status)}
        </span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, lineHeight: 1.35 }}>
        {delta.title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
        {delta.score != null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px' }}>
            Match {delta.score}%
          </span>
        )}
        {load && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px' }}>
            {load}
          </span>
        )}
      </div>
      <p style={{ margin: '7px 0 0', fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>
        {delta.nextPlanEffect}
      </p>
      <button
        type="button"
        onClick={() => onNavigate(delta.targetPath)}
        style={{
          marginTop: 9,
          minHeight: 40,
          width: '100%',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: 'var(--text-2)',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 0,
          textTransform: 'uppercase',
        }}
      >
        Delta ansehen
      </button>
    </section>
  );
}

function NextBestActionsCard({
  actions,
  onNavigate,
}: {
  actions: PulseNextBestAction[];
  onNavigate: (path: string) => void;
}) {
  if (actions.length === 0) return null;
  const primary = actions[0]!;
  const secondary = actions.slice(1);
  const primaryColor = actionColor(primary.priority);

  return (
    <div style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.14em' }}>
          HEUTE TUN
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
          {actions.length === 1 ? '1 Schritt' : `${actions.length} Schritte`}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onNavigate(primary.targetPath)}
        style={{
          width: '100%',
          padding: '14px',
          background: 'var(--surface-2)',
          border: `1px solid ${primaryColor}66`,
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, color: primaryColor, letterSpacing: '.1em', marginBottom: 4 }}>
              {priorityLabel(primary.priority)}
            </span>
            <span style={{ display: 'block', fontSize: 15, color: 'var(--text)', fontWeight: 600, lineHeight: 1.3 }}>
              {primary.title}
            </span>
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: primaryColor, whiteSpace: 'nowrap', paddingTop: 2 }}>
            {primary.cta} →
          </span>
        </span>
        <span style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em' }}>
            WARUM
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
            {primary.reason}
          </span>
          {(primary.resolvedBy || primary.evidence?.length) && (
            <>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em' }}>
                FERTIG WENN
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                {primary.resolvedBy ?? primary.evidence?.slice(0, 2).join(' · ')}
              </span>
            </>
          )}
        </span>
      </button>

      {secondary.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.12em' }}>
            DANACH
          </div>
          {secondary.map(action => {
            const color = actionColor(action.priority);
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onNavigate(action.targetPath)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  alignItems: 'center',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
                    {action.title}
                  </span>
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', marginTop: 2, overflowWrap: 'anywhere' }}>
                    {action.reason}
                  </span>
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color, flexShrink: 0 }}>
                  {action.cta} →
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionClosureCard({
  action,
  isPending,
  onNavigate,
  onResolve,
}: {
  action: PulseActionState;
  isPending: boolean;
  onNavigate: (path: string) => void;
  onResolve: (status: 'completed' | 'deferred') => void;
}) {
  const color = actionColor(action.priority);

  return (
    <div style={{ padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${color}55`, borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color, letterSpacing: '.14em' }}>
          TAGESAKTION
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
          {priorityLabel(action.priority)}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={() => onNavigate(action.targetPath)}
          style={{
            width: '100%',
            padding: 0,
            background: 'transparent',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'block', fontSize: 15, color: 'var(--text)', fontWeight: 600, lineHeight: 1.3 }}>
            {action.title}
          </span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 6, overflowWrap: 'anywhere' }}>
            {action.reason}
          </span>
        </button>

        {(action.resolvedBy || action.evidence?.length) && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '8px 9px', background: 'var(--surface-2)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em' }}>
              FERTIG WENN
            </div>
            <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.4 }}>
              {action.resolvedBy ?? action.evidence?.slice(0, 2).join(' · ')}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <button
            type="button"
            onClick={() => onResolve('completed')}
            disabled={isPending}
            style={{
              padding: '9px 10px',
              background: isPending ? 'var(--surface-2)' : 'var(--green)',
              border: 'none',
              borderRadius: 5,
              color: isPending ? 'var(--text-3)' : 'var(--bg)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              cursor: isPending ? 'default' : 'pointer',
            }}
          >
            Erledigt
          </button>
          <button
            type="button"
            onClick={() => onResolve('deferred')}
            disabled={isPending}
            style={{
              padding: '9px 10px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--text-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              cursor: isPending ? 'default' : 'pointer',
            }}
          >
            Später
          </button>
          <button
            type="button"
            onClick={() => onNavigate(action.targetPath)}
            style={{
              padding: '9px 10px',
              background: 'var(--surface-2)',
              border: `1px solid ${color}`,
              borderRadius: 5,
              color,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Öffnen
          </button>
        </div>
      </div>
    </div>
  );
}

type HomeMentalPreset = {
  id: 'stable' | 'mixed' | 'protect';
  label: string;
  hint: string;
  note: string;
  scores: {
    mood: number;
    energy: number;
    stress: number;
    motivation: number;
  };
};

const HOME_MENTAL_PRESETS: HomeMentalPreset[] = [
  {
    id: 'stable',
    label: 'Stabil',
    hint: 'Kopf klar, genug Reserve.',
    note: 'Home Quick: Stabil',
    scores: { mood: 8, energy: 8, stress: 2, motivation: 7 },
  },
  {
    id: 'mixed',
    label: 'Gemischt',
    hint: 'Ein klarer Rahmen hilft.',
    note: 'Home Quick: Gemischt',
    scores: { mood: 6, energy: 5, stress: 5, motivation: 5 },
  },
  {
    id: 'protect',
    label: 'Schützen',
    hint: 'Reizlast senken, klein halten.',
    note: 'Home Quick: Schützen',
    scores: { mood: 3, energy: 2, stress: 8, motivation: 3 },
  },
];

function HomeMentalCheckinCard({
  isPending,
  error,
  onSubmit,
}: {
  isPending: boolean;
  error: unknown;
  onSubmit: (preset: HomeMentalPreset) => void;
}) {
  const [selected, setSelected] = useState<HomeMentalPreset['id']>('mixed');
  const preset = HOME_MENTAL_PRESETS.find(candidate => candidate.id === selected) ?? HOME_MENTAL_PRESETS[1]!;

  return (
    <div className="card" data-testid="home-mental-checkin-card" style={{ borderColor: 'rgba(94,230,207,0.24)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginBottom: 9 }}>
        <span className="label-mono" style={{ color: 'var(--accent)' }}>Mental Check-in</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>Home Quick</span>
      </div>
      <p style={{ margin: '0 0 11px', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
        Wenn Zahlen gerade zu viel sind: wähle einen Tageszustand. Pulse speichert daraus die bekannten Mentalwerte.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
        {HOME_MENTAL_PRESETS.map(option => {
          const active = option.id === selected;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(option.id)}
              style={{
                minHeight: 58,
                padding: '8px 7px',
                background: active ? 'rgba(94,230,207,0.14)' : 'var(--surface-2)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 5,
                color: active ? 'var(--text)' : 'var(--text-2)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700, lineHeight: 1.15 }}>{option.label}</span>
              <span style={{ display: 'block', marginTop: 4, fontSize: 10.5, lineHeight: 1.25, color: 'var(--text-3)' }}>
                {option.hint}
              </span>
            </button>
          );
        })}
      </div>
      {error != null && (
        <div style={{ marginTop: 10 }}>
          <InlineFeedback
            title="Check-in nicht gespeichert"
            message={errorMessage(error, 'Der Check-in konnte nicht gespeichert werden.')}
            tone="warning"
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => onSubmit(preset)}
        disabled={isPending}
        style={{
          width: '100%',
          minHeight: 42,
          marginTop: 12,
          background: isPending ? 'var(--surface-2)' : 'var(--accent)',
          border: 'none',
          borderRadius: 5,
          color: isPending ? 'var(--text-3)' : 'var(--bg)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          cursor: isPending ? 'default' : 'pointer',
        }}
      >
        {isPending ? 'Speichern…' : 'Check-in speichern'}
      </button>
    </div>
  );
}

function DailyLoopHistoryCard({
  recentDecisions,
  suppressed,
  onNavigate,
}: {
  recentDecisions: PulseRecentActionDecision[];
  suppressed: PulseSuppressedActionState[];
  onNavigate: (path: string) => void;
}) {
  const latest = recentDecisions[0] ?? null;
  const hidden = suppressed[0] ?? null;
  if (!latest && !hidden) return null;

  return (
    <div style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.14em' }}>
          ZULETZT IM LOOP
        </span>
        {hidden && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)' }}>
            {suppressedReasonLabel(hidden.suppressedReason)}
          </span>
        )}
      </div>
      {latest && (
        <button
          type="button"
          onClick={() => latest.targetRoute && onNavigate(latest.targetRoute)}
          disabled={!latest.targetRoute}
          style={{
            width: '100%',
            padding: '9px 10px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 5,
            textAlign: 'left',
            cursor: latest.targetRoute ? 'pointer' : 'default',
          }}
        >
          <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--green)', letterSpacing: '.1em' }}>
            {actionDecisionStatusLabel(latest.status)}
          </span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text)', fontWeight: 600, marginTop: 3 }}>
            {latest.title}
          </span>
          {latest.resolutionReason && (
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45, marginTop: 3 }}>
              {latest.resolutionReason}
            </span>
          )}
        </button>
      )}
      {!latest && hidden && (
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
          {hidden.title} ist ausgeblendet: {suppressedReasonLabel(hidden.suppressedReason)}.
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { data, isLoading, error, refetch: refetchHome } = usePulseHome();
  const actionsQuery = usePulseActions({ includeHistory: true });
  const outcomesQuery = useDailyOutcomeLearning(7);
  const dailyDeltaQuery = useDailyDelta(7);
  const decisionQualityQuery = useDailyDecisionQuality(14);
  const updateAction = useUpdatePulseAction();
  const checkinToday = useCheckinToday();
  const checkinHistory = useCheckinHistory(7);
  const checkin = usePulseCheckin();
  const readinessQuery = useReadiness();
  const loadQuery = useFitnessLoad();
  const goalProjection = useGoalProjection(180);
  const adaptationEvents = useAdaptationEvents();
  const trainingAnalytics = useTrainingAnalytics(12);
  const fuelingDebt = useFuelingDebt();
  const garminSync = useGarminSync();
  const todayOptionsQuery = useTodayOptions();
  const navigate = useNavigate();
  const [homeCheckinSubmitted, setHomeCheckinSubmitted] = useState(false);
  const homeSurface = useHomeSurfaceFocus();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 0' }}>
        <div style={{ height: 20, width: '40%', background: 'var(--surface-2)', borderRadius: 3 }} />
        <div style={{ height: 28, width: '70%', background: 'var(--surface-2)', borderRadius: 3 }} />
        <div style={{ height: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
        <div style={{ height: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} />
        <div style={{ height: 80,  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '32px 0' }}>
        <InlineFeedback
          title="Home konnte nicht geladen werden"
          message={errorMessage(error, 'Keine Home-Daten verfügbar.')}
          actionLabel="Home erneut laden"
          onAction={() => { void refetchHome(); }}
        />
      </div>
    );
  }

  const readiness = readinessQuery.data ?? data.readiness;
  const fl = loadQuery.data ?? data.fitnessLoad;
  const nw = data.nextWorkout;
  const todaysOptions = todayOptionsQuery.data?.todayOptions?.date === data.date ? todayOptionsQuery.data.todayOptions : null;
  const dailyCommand = resolveDailyCommand(data, todaysOptions);
  const actionStates = actionsQuery.data?.actions ?? [];
  const suppressedActions = actionsQuery.data?.suppressed ?? [];
  const recentDecisions = actionsQuery.data?.recentDecisions ?? [];
  const latestOutcome = outcomesQuery.data?.items[0] ?? null;
  const latestDelta = dailyDeltaQuery.data?.items[0] ?? null;
  const todaysDelta = latestDelta?.date === data.date ? latestDelta : null;
  const primaryAction = actionStates[0] ?? null;
  const hasMentalCheckin = homeCheckinSubmitted || checkinToday.data?.checkin != null;
  const todayCheckinDate = checkinToday.data?.checkin?.date ?? data.date;
  const todayMentalCheckin = checkinToday.data?.checkin
    ? checkinHistory.data?.checkins.find(checkin => checkin.date === todayCheckinDate) ?? null
    : null;
  const mentalImpactSummary = todayMentalCheckin ? mentalImpact(todayMentalCheckin) : null;
  const mentalBoundary = mentalImpactSummary && mentalImpactSummary.level !== 'stable'
    ? {
        level: mentalImpactSummary.level,
        label: mentalImpactSummary.level === 'protect' ? 'Schutzmodus' : 'Sensibel',
        detail: mentalImpactSummary.labels.dailyImpact,
        targetPath: '/data?tab=today#data-mental',
      }
    : null;
  const primaryAdaptationEvent = primaryAdaptation(
    (adaptationEvents.data?.events ?? []).filter(event => event.severity !== 'info'),
  );
  const dailyDecision = deriveDailyDecision(data, {
    dailyDelta: todaysDelta,
    decisionQuality: decisionQualityQuery.data ?? null,
    goalProjection: goalProjection.data ?? null,
    mentalBoundary,
    todayOptions: todaysOptions,
    adaptationEvent: primaryAdaptationEvent,
    trainingAnalytics: trainingAnalytics.data ?? null,
    fuelingOutcomeBaseline: fuelingDebt.data?.outcomeBaseline ?? null,
  });
  const mentalDaySignal = mentalImpactSummary && mentalImpactSummary.level !== 'stable'
    ? `Mentale Tageslage: ${mentalImpactSummary.level === 'protect' ? 'Schutzmodus' : 'sensibel'}. ${mentalImpactSummary.labels.dailyImpact}`
    : null;
  const homeMentalAction = !hasMentalCheckin && primaryAction?.source === 'checkin' ? primaryAction : null;
  const visiblePrimaryAction = homeMentalAction ? null : primaryAction;
  const followUpActions = visiblePrimaryAction
    ? actionStates.slice(1)
    : actionStates.length > 0
      ? actionStates.filter(action => action.source !== 'checkin')
      : data.nextBestActions?.slice(1) ?? [];
  const dataStatus = data.dataStatus;
  const showDataStatus = dataStatus.garmin.status !== 'ready' || !dataStatus.userReady || !dataStatus.profileReady;
  function handleDailyDecisionActivate(path: string) {
    if (path === '/') {
      return;
    }

    navigate(path);
  }

  const readinessColor = colorOf(readiness.color);
  const tsbBucket = bucketize(fl.tsb, TSB_BUCKETS);
  const tsbColor = colorOf(tsbBucket.color);

  function renderFocusSlot(slot: HomeFocusSlot) {
    if (slot === 'delta') {
      if (!latestDelta) return null;
      return (
        <div key={slot} data-testid="home-focus-item-delta">
          <DailyDeltaCard delta={latestDelta} onNavigate={navigate} />
        </div>
      );
    }

    if (slot === 'todayOptions') {
      return (
        <div key={slot} data-testid="home-focus-item-todayOptions">
          <TodayOptionsCard variant="compact" commandKind={dailyCommand} onNavigate={navigate} />
        </div>
      );
    }

    if (slot === 'adaptation') {
      if (!primaryAdaptationEvent) return null;
      return (
        <div key={slot} data-testid="home-focus-item-adaptation">
          <HomeAdaptationEventCard event={primaryAdaptationEvent} onNavigate={navigate} />
        </div>
      );
    }

    if (slot === 'mental') {
      const hasMentalContent = mentalDaySignal || homeCheckinSubmitted || (homeMentalAction && !homeCheckinSubmitted);
      if (!hasMentalContent) return null;
      return (
        <div key={slot} data-testid="home-focus-item-mental" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mentalDaySignal && (
            <p
              data-testid="mental-impact-summary"
              style={{
                margin: '-4px 0 0',
                padding: '9px 10px',
                background: 'var(--surface-2)',
                border: '1px solid rgba(94,230,207,0.18)',
                borderRadius: 5,
                color: 'var(--text-2)',
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              {mentalDaySignal}
            </p>
          )}

          {homeCheckinSubmitted && (
            <div className="card" style={{ borderColor: 'rgba(74,222,128,0.3)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', letterSpacing: '0.12em' }}>
                CHECK-IN HEUTE ERLEDIGT ✓
              </span>
            </div>
          )}

          {homeMentalAction && !homeCheckinSubmitted && (
            <HomeMentalCheckinCard
              isPending={checkin.isPending}
              error={checkin.error}
              onSubmit={(preset) => {
                checkin.mutate(
                  { ...preset.scores, notes: preset.note },
                  { onSuccess: () => setHomeCheckinSubmitted(true) },
                );
              }}
            />
          )}
        </div>
      );
    }

    if (slot === 'action') {
      if (!visiblePrimaryAction) return null;
      return (
        <div key={slot} data-testid="home-focus-item-action">
          <ActionClosureCard
            action={visiblePrimaryAction}
            isPending={updateAction.isPending}
            onNavigate={navigate}
            onResolve={(status) => updateAction.mutate({
              id: visiblePrimaryAction.decisionId,
              status,
              reason: status === 'completed' ? 'In Home erledigt.' : 'In Home verschoben.',
            })}
          />
        </div>
      );
    }

    if (slot === 'history') {
      if (!recentDecisions.length && !suppressedActions.length) return null;
      return (
        <div key={slot} data-testid="home-focus-item-history">
          <DailyLoopHistoryCard
            recentDecisions={recentDecisions}
            suppressed={suppressedActions}
            onNavigate={navigate}
          />
        </div>
      );
    }

    if (slot === 'learning') {
      if (!latestOutcome) return null;
      return (
        <div key={slot} data-testid="home-focus-item-learning">
          <DailyOutcomeLearningCard outcome={latestOutcome} />
        </div>
      );
    }

    if (slot === 'followUps') {
      if (followUpActions.length === 0) return null;
      return (
        <div key={slot} data-testid="home-focus-item-followUps">
          <NextBestActionsCard actions={followUpActions} onNavigate={navigate} />
        </div>
      );
    }

    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 80 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '.18em', marginBottom: 4 }}>
            // {fmtDate(data.date)}
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)', margin: 0 }}>
            Heute
          </h1>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)', letterSpacing: '.14em' }}>
          TRAIN WINDOW <span style={{ color: 'var(--accent)' }}>OPEN</span>
        </div>
      </div>

      {/* ── Health State Banner (active illness/injury/fatigue) ── */}
      <HealthStateBanner />
      <RiskWatchBanner />

      {readinessQuery.error && (
        <InlineFeedback
          title="Readiness separat nicht erreichbar"
          message={`Pulse nutzt den letzten Home-Stand weiter. ${errorMessage(readinessQuery.error, 'Readiness konnte nicht geladen werden.')}`}
          tone="warning"
          actionLabel="Readiness erneut laden"
          actionPending={readinessQuery.isFetching}
          onAction={() => { void readinessQuery.refetch(); }}
        />
      )}

      {loadQuery.error && (
        <InlineFeedback
          title="Trainingslast separat nicht erreichbar"
          message={`Pulse nutzt den letzten Home-Stand weiter. ${errorMessage(loadQuery.error, 'Trainingslast konnte nicht geladen werden.')}`}
          tone="warning"
          actionLabel="Last erneut laden"
          actionPending={loadQuery.isFetching}
          onAction={() => { void loadQuery.refetch(); }}
        />
      )}

      {showDataStatus && (
        <div style={{
          padding: '12px 14px',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 6,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--amber)', letterSpacing: '.14em', marginBottom: 4 }}>
              DATENSTATUS · {dataStatus.garmin.status.toUpperCase()}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-2)' }}>
              {dataStatus.garmin.status === 'empty'
                ? 'Noch keine Garmin-Daten in Pulse. Readiness und Plan arbeiten aktuell mit Basiswerten.'
                : dataStatus.garmin.status === 'stale'
                ? `Letzte Tagesdaten: ${dataStatus.garmin.lastMetricDate ?? 'unbekannt'}. Heute fehlen noch frische Signale.`
                : 'Pulse hat nur einen Teil der erwarteten Daten. Einige Empfehlungen bleiben vorsichtig.'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 5 }}>
              14 Tage: {dataStatus.garmin.metricsDays14} Metrik-Tage · {dataStatus.garmin.activitiesDays14} Aktivitäten
            </div>
          </div>
          <button
            onClick={() => garminSync.mutate()}
            disabled={garminSync.isPending}
            style={{
              flexShrink: 0,
              padding: '9px 11px',
              background: garminSync.isPending ? 'var(--surface-2)' : 'var(--amber)',
              color: garminSync.isPending ? 'var(--text-3)' : 'var(--bg)',
              border: 'none',
              borderRadius: 5,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '.12em',
              cursor: garminSync.isPending ? 'default' : 'pointer',
            }}
          >
            {garminSync.isPending ? 'SYNC...' : 'SYNC'}
          </button>
        </div>
      )}

      {garminSync.error && (
        <InlineFeedback
          title="Garmin-Sync nicht gestartet"
          message={errorMessage(garminSync.error, 'Der Garmin-Sync konnte nicht gestartet werden.')}
          actionLabel="Sync erneut starten"
          actionPending={garminSync.isPending}
          onAction={() => garminSync.mutate()}
        />
      )}

      {dailyDecision && (
        <DecisionHero
          date={data.date}
          decision={dailyDecision}
          readiness={readiness}
          fitnessLoad={fl}
          recovery={data.recovery}
          todayWorkout={data.todayWorkout}
          nextWorkout={nw}
          todayActivities={data.todayActivities ?? []}
          recentActivities={data.recentActivities}
          readinessLabel={<Tooltip id="READINESS">READINESS</Tooltip>}
          onActivate={handleDailyDecisionActivate}
          onPrompt={() => navigate(coachPromptPath(dailyDecision.prompt, 'daily'))}
        />
      )}

      {dailyDecision && (
        <DayDiary
          data={data}
          decision={dailyDecision}
          hasMentalCheckin={hasMentalCheckin}
          latestDeltaTitle={latestDelta?.title}
          latestOutcomeTitle={latestOutcome?.title}
          adaptationSummary={primaryAdaptationEvent?.summary}
        />
      )}

      <div
        data-testid="home-command-summary"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 6,
        }}
      >
        {[
          { label: 'Readiness', value: readiness.score, suffix: '/100', color: readinessColor },
          { label: 'TSB', value: fmtSigned(fl.tsb), suffix: '', color: tsbColor },
          { label: 'Recovery', value: data.recovery?.recoveryScore ?? '–', suffix: typeof data.recovery?.recoveryScore === 'number' ? '/100' : '', color: 'var(--text)' },
        ].map(item => (
          <div
            key={item.label}
            style={{
              padding: '8px 9px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              minWidth: 0,
            }}
          >
            <div className="label-mono" style={{ fontSize: 8.5, color: 'var(--text-3)', marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: item.color }}>
              {item.value}{item.suffix}
            </div>
          </div>
        ))}
      </div>

      <HomeSurfaceFocusCard focus={homeSurface.focus} onFocusChange={homeSurface.setFocus} />

      {homeSurface.order.map(slot => renderFocusSlot(slot))}

    </div>
  );
}
