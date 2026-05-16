import { useState } from 'react';
import { Activity, Brain, ChevronDown, ChevronUp, Dumbbell, HeartPulse, Moon, Scale } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDailyDecisionQuality, useDeepInsight, useGoalProjection, usePersonalResponse, usePlanTrace, useRefreshInsight, useTrainingAnalytics, useTrainingCapabilities } from '@/pulse/hooks';
import { MentalLoadOverlay } from '@/components/MentalLoadOverlay';
import { IconBadge, PageHeader, RangeControl } from '@/components/PulseChrome';
import { PulseApiError } from '@/pulse/api-client';
import { TrainingCapabilityCard } from '@/features/training/TrainingCapabilityCard';
import { PersonalResponseCard } from '@/features/data/response/personal-response-components';
import { GoalProjectionCard } from '@/features/data/goals/goal-projection-components';
import { AnalysisTranslationCard } from '@/features/data/analysis/AnalysisTranslationCard';
import { getMonday, isoDate } from '@/features/plan/plan-utils';
import type { LucideIcon } from 'lucide-react';
import type { PulseDailyDecisionQualityResponse, PulsePlanTrace, PulsePowerDataQualitySummary, PulsePowerDurationSummary, PulseTrainingCapabilityLevel } from '@coaching-os/shared/pulse';

type Domain = 'overall' | 'sleep' | 'hrv' | 'load' | 'weight' | 'mental';
type EvidenceStatus = 'available' | 'limited' | 'missing';
type EvidenceItem = {
  label: string;
  value: string;
  window: string;
  status: EvidenceStatus;
  targetRoute?: '/data' | '/data?tab=analysis' | '/data?tab=analysen' | '/plan' | '/insights' | `/activities/${number}`;
  targetLabel?: string;
};
type MissingDataItem = { label: string; reason: string; action?: string };

const DOMAINS: { key: Domain; label: string; icon: LucideIcon; color: string }[] = [
  { key: 'overall',  label: 'Gesamt',    icon: Activity,   color: 'var(--accent)' },
  { key: 'sleep',    label: 'Schlaf',    icon: Moon,       color: 'var(--blue)'   },
  { key: 'hrv',      label: 'HRV',       icon: HeartPulse, color: 'var(--green)'  },
  { key: 'load',     label: 'Belastung', icon: Dumbbell,   color: 'var(--amber)'  },
  { key: 'weight',   label: 'Gewicht',   icon: Scale,      color: 'var(--text-2)' },
  { key: 'mental',   label: 'Mental',    icon: Brain,      color: 'var(--rose)'   },
];

const DAYS_OPTIONS = [7, 30, 90];
const RANGE_OPTIONS = DAYS_OPTIONS.map(d => ({ value: d, label: `${d}T` }));

function decisionQualityColor(status: PulseDailyDecisionQualityResponse['status']): string {
  if (status === 'helpful') return 'var(--green)';
  if (status === 'watch') return 'var(--blue)';
  if (status === 'stale') return 'var(--amber)';
  if (status === 'needs_strategy_change') return 'var(--rose)';
  return 'var(--text-3)';
}

function goalStatusTone(status: string | null | undefined): string {
  if (status === 'on_track') return 'var(--green)';
  if (status === 'watch') return 'var(--amber)';
  if (status === 'at_risk') return 'var(--rose)';
  return 'var(--text-3)';
}

function goalStatusLabel(status: string | null | undefined): string {
  if (status === 'on_track') return 'auf Kurs';
  if (status === 'watch') return 'beobachten';
  if (status === 'at_risk') return 'kritisch';
  return 'offen';
}

function responseStrengthTone(strength: string | null | undefined): string {
  if (strength === 'useful') return 'var(--green)';
  if (strength === 'learning') return 'var(--amber)';
  return 'var(--text-3)';
}

function responseStrengthLabel(strength: string | null | undefined): string {
  if (strength === 'useful') return 'nutzbar';
  if (strength === 'learning') return 'lernt';
  return 'offen';
}

function normalizeInsightCopy(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

function insightErrorState(error: unknown): { title: string; message: string; retryable: boolean } {
  if (error instanceof PulseApiError) {
    if (error.code === 'provider_unavailable') {
      return {
        title: 'KI-Provider gerade nicht erreichbar.',
        message: error.action ?? 'Versuche es später erneut oder nutze einen anderen Zeitraum.',
        retryable: error.retryable,
      };
    }
    if (error.code === 'timeout') {
      return {
        title: 'Analyse dauert gerade zu lange.',
        message: error.action ?? 'Versuche es erneut oder wähle einen kürzeren Zeitraum.',
        retryable: error.retryable,
      };
    }
  }
  return {
    title: 'Analyse konnte gerade nicht geladen werden.',
    message: 'Deine Daten bleiben sichtbar. Versuche es gleich erneut oder wechsle auf einen anderen Zeitraum.',
    retryable: true,
  };
}

function statusLabel(status: EvidenceStatus): string {
  if (status === 'available') return 'vorhanden';
  if (status === 'limited') return 'begrenzt';
  return 'fehlt';
}

function EvidenceList({ evidence, missingData }: { evidence?: EvidenceItem[]; missingData?: MissingDataItem[] }) {
  const navigate = useNavigate();
  const hasEvidence = Boolean(evidence?.length);
  const hasMissing = Boolean(missingData?.length);

  if (!hasEvidence && !hasMissing) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
      {hasEvidence && (
        <section aria-label="Datenbasis" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
            Datenbasis
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
            {evidence!.map(item => {
              const isLinked = Boolean(item.targetRoute);
              const Wrapper = isLinked ? 'button' : 'div';
              return (
              <Wrapper
                key={`${item.label}-${item.window}-${item.value}`}
                type={isLinked ? 'button' : undefined}
                onClick={isLinked ? () => navigate(item.targetRoute!) : undefined}
                aria-label={isLinked ? `${item.label}: ${item.targetLabel ?? 'Quelle öffnen'}` : undefined}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '7px 8px',
                  background: 'var(--surface-2)',
                  textAlign: 'left',
                  cursor: isLinked ? 'pointer' : 'default',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{item.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: item.status === 'available' ? 'var(--green)' : item.status === 'limited' ? 'var(--amber)' : 'var(--rose)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {statusLabel(item.status)}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-2)', margin: '4px 0 0' }}>{item.value}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)', margin: '3px 0 0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {item.targetRoute ? `${item.window} · ${item.targetLabel ?? 'Quelle öffnen'}` : item.window}
                </p>
              </Wrapper>
            );})}
          </div>
        </section>
      )}

      {hasMissing && (
        <section aria-label="Daten fehlen" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--rose)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
            Daten fehlen
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {missingData!.map(item => (
              <div key={`${item.label}-${item.reason}`} style={{ borderLeft: '2px solid var(--rose)', paddingLeft: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.45, margin: '2px 0 0' }}>
                  {item.reason}
                </p>
                {item.action && (
                  <p style={{ fontSize: 11, color: 'var(--accent)', lineHeight: 1.45, margin: '2px 0 0' }}>
                    {item.action}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DecisionQualityEvidenceCard({
  quality,
  testId = 'insights-decision-quality-card',
}: {
  quality: PulseDailyDecisionQualityResponse | null | undefined;
  testId?: string;
}) {
  if (!quality) return null;
  const color = decisionQualityColor(quality.status);

  return (
    <section
      id="data-decision-quality"
      className="card"
      data-testid={testId}
      aria-label="Entscheidungsqualität"
      tabIndex={-1}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: 'rgba(94,230,207,0.18)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Entscheidungsqualität
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color }}>
          {quality.statusLabel} · {quality.qualityScore}/100
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
        {quality.suggestedAdjustment}
      </p>
      {quality.bestEvidence.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
          {quality.bestEvidence.slice(0, 4).map(item => (
            <div key={item} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '7px 8px', background: 'var(--surface-2)' }}>
              <p style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.45, margin: 0 }}>
                {item}
              </p>
            </div>
          ))}
        </div>
      )}
      {quality.repeatedThemes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {quality.repeatedThemes.slice(0, 4).map(theme => (
            <span
              key={`${theme.theme}-${theme.count}`}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: theme.status === 'stale' ? 'var(--amber)' : 'var(--text-3)',
                padding: '3px 6px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--surface-2)',
              }}
            >
              {theme.theme} · {theme.count}x
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function powerDataQualityMeta(status: PulsePowerDataQualitySummary['status']): { label: string; color: string } {
  if (status === 'trusted') return { label: 'Stream-Daten vertrauenswürdig', color: 'var(--green)' };
  if (status === 'usable_with_caution') return { label: 'Nur Lap-Approximation', color: 'var(--amber)' };
  return { label: 'Power-Modell blockiert', color: 'var(--rose)' };
}

function powerDataSourceLabel(source: PulsePowerDataQualitySummary['source']): string {
  if (source === 'stream') return '1Hz-Stream';
  if (source === 'lap_approximation') return 'Lap-Daten';
  return 'Keine Power-Daten';
}

function PowerDataQualityCard({
  quality,
  loading,
}: {
  quality: PulsePowerDataQualitySummary | null | undefined;
  loading: boolean;
}) {
  if (!quality && !loading) return null;

  const meta = quality ? powerDataQualityMeta(quality.status) : { label: 'Power-Daten werden geprüft', color: 'var(--text-3)' };
  const source = quality ? powerDataSourceLabel(quality.source) : 'Analyse läuft';

  return (
    <section
      id="data-power-quality"
      className="card"
      data-testid="power-data-quality"
      aria-label="Power-Datenqualität"
      tabIndex={-1}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: 'rgba(245,158,11,0.22)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--amber)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Power-Daten
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: meta.color }}>
          {meta.label}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '7px 8px', background: 'var(--surface-2)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
            Quelle
          </p>
          <p style={{ fontSize: 12, color: 'var(--text)', margin: '4px 0 0' }}>{source}</p>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '7px 8px', background: 'var(--surface-2)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
            Coverage
          </p>
          <p style={{ fontSize: 12, color: 'var(--text)', margin: '4px 0 0' }}>
            {quality ? `${quality.coveragePct}% · ${quality.spikeCount} Spikes` : 'offen'}
          </p>
        </div>
      </div>
      {quality?.limitations.length ? (
        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>
          {quality.limitations[0]}
        </p>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>
          Power-basierte Auswertungen können auf echte Stream-Daten gestützt werden.
        </p>
      )}
    </section>
  );
}

function PowerDurationSummaryCard({ summary }: { summary: PulsePowerDurationSummary | null | undefined }) {
  if (!summary) return null;
  const durabilityColor = summary.durability?.rating === 'limited'
    ? 'var(--rose)'
    : summary.durability?.rating === 'watch'
    ? 'var(--amber)'
    : 'var(--green)';

  return (
    <section
      id="data-power-duration"
      className="card"
      data-testid="power-duration-summary"
      aria-label="Power und Durability"
      tabIndex={-1}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: 'rgba(94,230,207,0.18)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Power / Durability
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: durabilityColor }}>
          {summary.durability ? `Durability ${summary.durability.rating}` : 'Best Efforts'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '7px 8px', background: 'var(--surface-2)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
            Best Effort
          </p>
          <p style={{ fontSize: 12, color: 'var(--text)', margin: '4px 0 0' }}>{summary.bestEffortLine}</p>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '7px 8px', background: 'var(--surface-2)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
            Durability
          </p>
          <p style={{ fontSize: 12, color: 'var(--text)', margin: '4px 0 0' }}>{summary.durabilityLine}</p>
        </div>
      </div>
    </section>
  );
}

function LimiterEvidenceCard({ trace, loading }: { trace: PulsePlanTrace | null | undefined; loading: boolean }) {
  const limiter = trace?.inputSnapshot.goalLimiter ?? null;
  if (!limiter && !loading) return null;

  const focusedLevels = limiter
    ? limiter.workoutFocus
      .map(system => trace?.inputSnapshot.trainingCapabilities?.levels.find(level => level.energySystem === system) ?? null)
      .filter((level): level is PulseTrainingCapabilityLevel => level != null)
    : [];
  const hasStale = focusedLevels.some(level => level.staleReason != null);
  const tone = hasStale ? 'var(--amber)' : 'var(--green)';

  return (
    <section
      className="card"
      data-testid="data-limiter-evidence-card"
      aria-label="Limiter Evidenz"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: 'rgba(245,158,11,0.22)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--amber)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Limiter-Evidenz
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: limiter ? tone : 'var(--text-3)' }}>
          {loading && !limiter ? 'prüft aktuelle Woche' : hasStale ? 'Evidenz begrenzt' : 'Evidenz nutzbar'}
        </span>
      </div>
      {limiter ? (
        <>
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>
            {limiter.label}: {limiter.planBias}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6 }}>
            {focusedLevels.map(level => (
              <div key={level.energySystem} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '7px 8px', background: 'var(--surface-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{level.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: level.staleReason ? 'var(--amber)' : 'var(--green)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {level.staleReason ? 'stale' : level.confidence}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.45, margin: '4px 0 0' }}>
                  {level.staleReason ?? level.evidence[0] ?? 'Noch keine konkrete Evidenz im aktuellen Fenster.'}
                </p>
              </div>
            ))}
          </div>
          {limiter.evidence.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {limiter.evidence.slice(0, 4).map(item => (
                <span key={item} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px' }}>
                  {item}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.55, margin: 0 }}>
          Die aktuelle Plan-Evidenz wird geladen.
        </p>
      )}
    </section>
  );
}

function InsightCard({ domain, days }: { domain: Domain; days: number }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, isFetching, error, refetch } = useDeepInsight(domain, days, expanded);
  const refresh = useRefreshInsight(domain, days);
  const meta = DOMAINS.find(d => d.key === domain)!;
  const isBusy = isLoading || isFetching || refresh.isPending;
  const contentId = `insight-${domain}-content`;
  const activeError = error ?? refresh.error;
  const errorState = activeError ? insightErrorState(activeError) : null;

  return (
    <div
      className="card"
      style={{ padding: 0, overflow: 'hidden', borderColor: expanded ? `color-mix(in srgb, ${meta.color} 28%, transparent)` : 'var(--border)' }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="w-full flex items-center justify-between gap-3"
        style={{ padding: '12px 14px', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-2.5">
          <IconBadge icon={meta.icon} color={meta.color} label={meta.label} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: meta.color, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {meta.label}
          </span>
          {data?.cached === false && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--accent)', letterSpacing: '0.1em' }}>LIVE</span>
          )}
        </div>
        <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      {/* Body */}
      {expanded && (
        <div id={contentId} style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }}>
          {isBusy ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[70, 90, 55].map((w, i) => (
                <div key={i} style={{ height: 10, borderRadius: 4, background: 'var(--surface-2)', width: `${w}%`, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : errorState ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  {errorState.title}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
                  {errorState.message}
                </p>
              </div>
              {errorState.retryable && (
                <button
                  onClick={() => refetch()}
                  style={{
                    alignSelf: 'flex-start',
                    fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text)',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    padding: '5px 9px', border: '1px solid var(--border)', borderRadius: 4,
                    background: 'var(--surface-2)', cursor: 'pointer',
                  }}
                >
                  Erneut versuchen
                </button>
              )}
            </div>
          ) : data ? (
            data.status === 'data_missing' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                  Noch nicht genug Daten.
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5, margin: 0 }}>
                  {data.analysis}
                </p>
                {data.action && (
                  <p style={{ fontSize: 11, color: 'var(--accent)', lineHeight: 1.5, margin: 0 }}>
                    {data.action}
                  </p>
                )}
                <EvidenceList evidence={data.evidence} missingData={data.missingData} />
              </div>
            ) : (
            <>
              {/* Stats chips */}
              {Object.keys(data.stats).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {Object.entries(data.stats).map(([k, v]) => v != null && (
                    <span key={k} style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 7px',
                      borderRadius: 4, background: 'var(--surface-2)', color: 'var(--text-2)',
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}>
                      {k}: {typeof v === 'number' ? v : v}
                    </span>
                  ))}
                </div>
              )}

              {/* Analysis text */}
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
                {data.analysis}
              </p>

              <EvidenceList evidence={data.evidence} missingData={data.missingData} />

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
                  {data.date}
                </span>
                <button
                  onClick={() => refresh.mutate()}
                  disabled={refresh.isPending}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 4,
                    background: 'transparent', cursor: 'pointer',
                  }}
                >
                  {refresh.isPending ? '…' : 'Neu'}
                </button>
              </div>
            </>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}

export function DataAnalysenTab({ mode = 'data' }: { mode?: 'data' | 'insights' } = {}) {
  const [days, setDays] = useState(30);
  const decisionQualityQuery = useDailyDecisionQuality(14);
  const personalResponse = usePersonalResponse(42);
  const goalProjection = useGoalProjection(180);
  const capability = useTrainingCapabilities(90);
  const trainingAnalytics = useTrainingAnalytics(12);
  const currentWeekStart = isoDate(getMonday(new Date()));
  const planTrace = usePlanTrace(currentWeekStart);
  const decisionQuality = decisionQualityQuery.data;
  const translationLoading = decisionQualityQuery.isLoading
    || personalResponse.isLoading
    || goalProjection.isLoading
    || trainingAnalytics.isLoading
    || planTrace.isLoading;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        eyebrow={mode === 'insights' ? 'INSIGHTS · 90D' : 'DATA · ANALYSEN'}
        title={mode === 'insights' ? 'Insights' : 'Analysen'}
        description={mode === 'insights'
          ? 'Trends, Korrelationen und belastbare Muster aus deinen Pulse-Daten.'
          : 'Öffne eine Karte, um die Analyse gezielt zu laden.'}
        action={<RangeControl value={days} onChange={setDays} options={RANGE_OPTIONS} />}
      />

      <AnalysisTranslationCard
        decisionQuality={decisionQuality}
        goalProjection={goalProjection.data}
        personalResponse={personalResponse.data}
        planTrace={planTrace.data?.trace}
        trainingAnalytics={trainingAnalytics.data}
        loading={translationLoading}
      />
      <MentalLoadOverlay />
      <PersonalResponseCard days={42} />
      <GoalProjectionCard horizonDays={180} />
      <TrainingCapabilityCard summary={capability.data?.capabilitySummary} loading={capability.isLoading} />
      <PowerDataQualityCard
        quality={trainingAnalytics.data?.powerDataQuality}
        loading={trainingAnalytics.isLoading}
      />
      <PowerDurationSummaryCard summary={trainingAnalytics.data?.powerDuration} />
      <LimiterEvidenceCard trace={planTrace.data?.trace} loading={planTrace.isLoading} />
      <DecisionQualityEvidenceCard quality={decisionQuality} testId="data-analysis-decision-quality-card" />

      {/* Domain cards */}
      {DOMAINS.map(d => (
        <InsightCard key={d.key} domain={d.key} days={days} />
      ))}
    </div>
  );
}

function SynthesisCard({
  eyebrow,
  title,
  body,
  meta,
  color = 'var(--accent)',
}: {
  eyebrow: string;
  title: string;
  body: string;
  meta: string;
  color?: string;
}) {
  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, borderColor: `color-mix(in srgb, ${color} 24%, transparent)` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {eyebrow}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
          {meta}
        </span>
      </div>
      <h2 style={{ fontSize: 15, color: 'var(--text)', margin: 0, fontWeight: 650, lineHeight: 1.35 }}>
        {title}
      </h2>
      <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>
        {body}
      </p>
    </section>
  );
}

function NextCheckItem({
  eyebrow,
  title,
  body,
  meta,
  color = 'var(--accent)',
}: {
  eyebrow: string;
  title: string;
  body: string;
  meta: string;
  color?: string;
}) {
  return (
    <div className="insights-next-check-item" data-testid="insights-next-check-item">
      <div
        className="insights-next-check-label"
        style={{ color }}
      >
        {eyebrow}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 650, lineHeight: 1.35 }}>
          {title}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5, margin: '5px 0 0' }}>
          {body}
        </p>
      </div>
      <div
        className="insights-next-check-meta"
        style={{ color }}
      >
        {meta}
      </div>
    </div>
  );
}

function InsightsSynthesis() {
  const [days, setDays] = useState(30);
  const [deepOpen, setDeepOpen] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [nextChecksOpen, setNextChecksOpen] = useState(false);
  const navigate = useNavigate();
  const personalResponse = usePersonalResponse(42);
  const goalProjection = useGoalProjection(180);
  const decisionQuality = useDailyDecisionQuality(14);
  const capability = useTrainingCapabilities(90);
  const trainingAnalytics = useTrainingAnalytics(12);
  const currentWeekStart = isoDate(getMonday(new Date()));
  const planTrace = usePlanTrace(currentWeekStart);

  const personalSummary = personalResponse.data?.summary ?? null;
  const personalSignal = personalSummary?.signals.find(signal => signal.strength !== 'insufficient')
    ?? personalSummary?.signals[0]
    ?? null;
  const topGoal = goalProjection.data?.projections[0] ?? null;
  const limiter = planTrace.data?.trace?.inputSnapshot.goalLimiter ?? null;
  const powerQuality = trainingAnalytics.data?.powerDataQuality ?? null;
  const powerDuration = trainingAnalytics.data?.powerDuration ?? null;
  const capabilityLevel = capability.data?.capabilitySummary.levels.find(level => !level.staleReason)
    ?? capability.data?.capabilitySummary.levels[0]
    ?? null;
  const focusTitle = topGoal?.nextBestIntervention.title
    ?? personalSignal?.label
    ?? limiter?.label
    ?? 'Pulse sammelt belastbare Muster.';
  const focusBody = topGoal?.nextBestIntervention.summary
    ?? personalSignal?.nextAdjustment
    ?? decisionQuality.data?.suggestedAdjustment
    ?? 'Insights verdichtet vorhandene Evidenz und verlinkt in die Details, statt jede Analyse sofort auszubreiten.';
  const primaryNextCheck = {
    eyebrow: 'Intervention',
    title: topGoal?.nextBestIntervention.title ?? 'Noch keine Intervention',
    body: topGoal?.nextBestIntervention.summary ?? 'Pulse wartet auf belastbare Ziel- und Reaktionsdaten, bevor es eine Intervention hervorhebt.',
    meta: topGoal?.nextBestIntervention.actionLabel ?? 'offen',
    color: 'var(--blue)',
  };
  const secondaryNextChecks = [
    {
      eyebrow: 'Datenqualität',
      title: powerQuality ? powerDataQualityMeta(powerQuality.status).label : 'Power-Daten offen',
      body: powerDuration?.durabilityLine ?? powerQuality?.limitations[0] ?? 'Durability und Power-Qualität bleiben als Evidenz-Gate sichtbar, bevor Pulse härtere Schlüsse zieht.',
      meta: powerQuality ? `${powerQuality.coveragePct}% Coverage` : 'prüft',
      color: powerQuality ? powerDataQualityMeta(powerQuality.status).color : 'var(--text-3)',
    },
    {
      eyebrow: 'Capability',
      title: capabilityLevel?.label ?? 'Capability offen',
      body: capabilityLevel?.lastProgressionReason ?? capabilityLevel?.staleReason ?? capability.data?.capabilitySummary.recommendations[0] ?? 'Workout-Fit wird aus Ausführung und Feedback gelernt.',
      meta: capability.isLoading ? 'lädt' : '90T',
      color: 'var(--amber)',
    },
  ];
  const nextCheckCandidates = [primaryNextCheck, ...secondaryNextChecks];
  const visibleNextChecks = nextCheckCandidates.filter(check => (
    normalizeInsightCopy(check.title) !== normalizeInsightCopy(focusTitle)
  ));
  const visibleNextCheck = visibleNextChecks[0] ?? null;
  const hiddenNextChecks = visibleNextChecks.slice(1);
  const heroMeta = topGoal?.probabilityPct == null
    ? goalStatusLabel(topGoal?.status)
    : `${goalStatusLabel(topGoal?.status)} · ca. ${topGoal.probabilityPct}%`;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        eyebrow="INSIGHTS · SYNTHESE"
        title="Insights"
        description="Die wichtigsten Muster zuerst. Tiefe Evidenz bleibt erreichbar, aber sie steht nicht mehr im Weg."
      />

      <section
        className="card"
        data-testid="insights-synthesis-hero"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 18,
          alignItems: 'end',
          borderColor: 'rgba(94,230,207,0.24)',
          background: 'color-mix(in srgb, var(--accent) 4%, var(--surface))',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 420px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
            Aktueller Fokus
          </div>
          <h2 style={{ fontSize: 22, color: 'var(--text)', margin: '0 0 8px', fontWeight: 650, lineHeight: 1.25 }}>
            {focusTitle}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0, maxWidth: 720 }}>
            {focusBody}
          </p>
        </div>
        <div style={{ display: 'flex', flex: '1 1 240px', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => navigate('/plan')}
            style={{
              minHeight: 42,
              minWidth: 44,
              padding: '9px 12px',
              border: '1px solid var(--accent)',
              borderRadius: 4,
              background: 'rgba(94,230,207,0.12)',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Plan ansehen
          </button>
          <button
            type="button"
            onClick={() => navigate('/data?tab=analysis')}
            style={{
              minHeight: 42,
              minWidth: 44,
              padding: '9px 12px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: 'var(--surface-2)',
              color: 'var(--text-2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Evidenz öffnen
          </button>
        </div>
      </section>

      <section className="card" data-testid="insights-next-actions" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Nächste sinnvolle Prüfung
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
            read-only
          </span>
        </div>
        <div className="insights-next-check-list">
          {visibleNextCheck ? (
            <NextCheckItem {...visibleNextCheck} />
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>
              Es gibt aktuell keine separate Prüfung neben dem Fokus.
            </p>
          )}
          {nextChecksOpen && (
            <>
              {hiddenNextChecks.map(check => (
                <NextCheckItem key={`${check.eyebrow}-${check.title}`} {...check} />
              ))}
            </>
          )}
        </div>
        {hiddenNextChecks.length > 0 && (
          <button
            type="button"
            aria-expanded={nextChecksOpen}
            onClick={() => setNextChecksOpen(open => !open)}
            style={{
              alignSelf: 'flex-start',
              minHeight: 38,
              minWidth: 44,
              padding: '7px 10px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: nextChecksOpen ? 'rgba(94,230,207,0.12)' : 'transparent',
              color: nextChecksOpen ? 'var(--accent)' : 'var(--text-2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {nextChecksOpen ? 'Weitere Prüfungen ausblenden' : 'Weitere Prüfungen anzeigen'}
          </button>
        )}
      </section>

      <section className="card" data-testid="insights-secondary-signals-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
              Kontextsignale
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>
              Ziel, Reaktion und Planqualität bei Bedarf.
            </p>
          </div>
          <button
            type="button"
            aria-expanded={signalsOpen}
            aria-controls="insights-secondary-signals"
            onClick={() => setSignalsOpen(open => !open)}
            style={{
              minHeight: 44,
              minWidth: 44,
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: signalsOpen ? 'rgba(94,230,207,0.12)' : 'var(--surface-2)',
              color: signalsOpen ? 'var(--accent)' : 'var(--text-2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {signalsOpen ? 'Weitere Signale ausblenden' : 'Weitere Signale anzeigen'}
          </button>
        </div>

        {signalsOpen && (
          <div
            id="insights-secondary-signals"
            data-testid="insights-secondary-signals"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}
          >
            <SynthesisCard
              eyebrow="Ziel"
              title={topGoal?.title ?? 'Zielprojektion offen'}
              body={topGoal?.summary ?? goalProjection.data?.headline ?? 'Sobald ein aktives Ziel belastbar genug ist, fasst Pulse Wahrscheinlichkeit, Limiter und nächste Intervention hier zusammen.'}
              meta={heroMeta}
              color={goalStatusTone(topGoal?.status)}
            />
            <SynthesisCard
              eyebrow="Reaktion"
              title={personalSummary?.headline ?? 'Reaktionsmuster offen'}
              body={personalSignal?.nextAdjustment ?? 'Pulse lernt noch, welche mentalen, Fueling- und Load-Signale wirklich wiederholbar wirken.'}
              meta={responseStrengthLabel(personalSummary?.strength)}
              color={responseStrengthTone(personalSummary?.strength)}
            />
            <SynthesisCard
              eyebrow="Planqualität"
              title={decisionQuality.data?.statusLabel ?? limiter?.label ?? 'Plan-Evidenz läuft'}
              body={decisionQuality.data?.suggestedAdjustment ?? limiter?.planBias ?? 'Plan-Trace, Capability und Entscheidungshistorie werden gelesen, ohne den Plan automatisch zu verändern.'}
              meta={decisionQuality.data ? `${decisionQuality.data.qualityScore}/100` : 'read-only'}
              color={decisionQuality.data ? decisionQualityColor(decisionQuality.data.status) : 'var(--text-3)'}
            />
          </div>
        )}
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
              Deep-Dive
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>
              Domänenanalysen bleiben verfügbar, werden aber erst nach deinem Klick geladen.
            </p>
          </div>
          <button
            type="button"
            aria-expanded={deepOpen}
            onClick={() => setDeepOpen(open => !open)}
            style={{
              minHeight: 44,
              minWidth: 44,
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: deepOpen ? 'rgba(94,230,207,0.12)' : 'var(--surface-2)',
              color: deepOpen ? 'var(--accent)' : 'var(--text-2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {deepOpen ? 'Tiefe Analyse ausblenden' : 'Tiefe Analyse anzeigen'}
          </button>
        </div>

        {deepOpen && (
          <div data-testid="insights-deep-analysis" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <RangeControl value={days} onChange={setDays} options={RANGE_OPTIONS} />
            </div>
            {DOMAINS.map(d => (
              <InsightCard key={d.key} domain={d.key} days={days} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function Insights() {
  return <InsightsSynthesis />;
}
