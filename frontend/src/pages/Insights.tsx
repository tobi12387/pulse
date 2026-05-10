import { useState } from 'react';
import { Activity, Brain, ChevronDown, ChevronUp, Dumbbell, HeartPulse, Moon, Scale } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDailyDecisionQuality, useDeepInsight, useRefreshInsight, useTrainingAnalytics, useTrainingCapabilities } from '@/pulse/hooks';
import { MentalLoadOverlay } from '@/components/MentalLoadOverlay';
import { IconBadge, PageHeader, RangeControl } from '@/components/PulseChrome';
import { PulseApiError } from '@/pulse/api-client';
import { TrainingCapabilityCard } from '@/features/training/TrainingCapabilityCard';
import type { LucideIcon } from 'lucide-react';
import type { PulseDailyDecisionQualityResponse, PulsePowerDataQualitySummary, PulsePowerDurationSummary } from '@coaching-os/shared/pulse';

type Domain = 'overall' | 'sleep' | 'hrv' | 'load' | 'weight' | 'mental';
type EvidenceStatus = 'available' | 'limited' | 'missing';
type EvidenceItem = {
  label: string;
  value: string;
  window: string;
  status: EvidenceStatus;
  targetRoute?: '/data' | '/data?tab=analysen' | '/plan' | '/insights' | `/activities/${number}`;
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
      className="card"
      data-testid={testId}
      aria-label="Entscheidungsqualität"
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
      className="card"
      data-testid="power-data-quality"
      aria-label="Power-Datenqualität"
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
      className="card"
      data-testid="power-duration-summary"
      aria-label="Power und Durability"
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

export function DataAnalysenTab() {
  const [days, setDays] = useState(30);
  const { data: decisionQuality } = useDailyDecisionQuality(14);
  const capability = useTrainingCapabilities(90);
  const trainingAnalytics = useTrainingAnalytics(12);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        eyebrow="DATA · ANALYSEN"
        title="Analysen"
        description="Öffne eine Karte, um die Analyse gezielt zu laden."
        action={<RangeControl value={days} onChange={setDays} options={RANGE_OPTIONS} />}
      />

      <MentalLoadOverlay />
      <TrainingCapabilityCard summary={capability.data?.capabilitySummary} loading={capability.isLoading} />
      <PowerDataQualityCard
        quality={trainingAnalytics.data?.powerDataQuality}
        loading={trainingAnalytics.isLoading}
      />
      <PowerDurationSummaryCard summary={trainingAnalytics.data?.powerDuration} />
      <DecisionQualityEvidenceCard quality={decisionQuality} testId="data-analysis-decision-quality-card" />

      {/* Domain cards */}
      {DOMAINS.map(d => (
        <InsightCard key={d.key} domain={d.key} days={days} />
      ))}
    </div>
  );
}

export default function InsightsRedirect() {
  return <Navigate to="/data?tab=analysen" replace />;
}
