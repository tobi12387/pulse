import { useState, type ReactNode } from 'react';
import { useDataCoverage, useGarminBackfill, useGarminCoverage, useGarminSignalUsefulness } from '@/pulse/hooks';
import { Skeleton } from '@/components/Skeleton';
import { GarminQualityList } from '@/components/GarminQualityList';
import { RangeControl } from '@/components/PulseChrome';
import type { PulseDataCoverageDay, PulseDataCoverageDomain, PulseDataCoverageResponse, PulseGarminBackfillResponse, PulseGarminCoverageDomain, PulseGarminSignalUsefulnessResponse } from '@coaching-os/shared/pulse';

function RangePicker({ value, onChange, options }: {
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string }[];
}) {
  return <RangeControl value={value} onChange={onChange} options={options} />;
}

function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton height={10} width="40%" />
          <Skeleton height={20} width="60%" />
          <Skeleton height={64} />
        </div>
      ))}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <p style={{ color: 'var(--text-3)', fontSize: 12 }} className="py-6 text-center">{msg}</p>
  );
}

const BACKFILL_LAST_STORAGE_KEY = 'pulse-garmin-backfill-last';

type BackfillMemory = {
  at: string;
  dryRun: boolean;
  from: string;
  to: string;
  planned: number;
  synced: number;
  skipped: number;
  failed: number;
};

// ─── Abdeckung ───────────────────────────────────────────────────────────────

const COVERAGE_STATUS: Record<PulseDataCoverageDay['dailyMetrics']['status'], { label: string; color: string }> = {
  present: { label: 'OK', color: 'var(--green)' },
  partial: { label: 'TEIL', color: 'var(--amber)' },
  missing: { label: 'FEHLT', color: 'var(--rose)' },
};

const COVERAGE_REASON: Record<string, string> = {
  present: 'vorhanden',
  partial: 'teilweise',
  not_synced: 'nicht synchronisiert',
  not_synced_yet: 'heute noch nicht synchronisiert',
  not_recorded: 'nicht vorhanden',
  garmin_unavailable: 'Garmin liefert nicht',
};

function CoveragePill({ status, children }: { status: PulseDataCoverageDay['dailyMetrics']['status']; children?: ReactNode }) {
  const item = COVERAGE_STATUS[status];
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, color: item.color,
      border: `1px solid ${item.color}`, borderRadius: 4, padding: '2px 6px',
      whiteSpace: 'nowrap',
    }}>
      {children ?? item.label}
    </span>
  );
}

function CoverageMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <span className="label-mono">{label}</span>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--text)', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const SIGNAL_STATUS_LABEL: Record<PulseGarminSignalUsefulnessResponse['items'][number]['status'], { label: string; color: string }> = {
  used: { label: 'GENUTZT', color: 'var(--green)' },
  underused: { label: 'UNTERGENUTZT', color: 'var(--amber)' },
  missing_or_sparse: { label: 'LUECKE', color: 'var(--text-3)' },
};

const SIGNAL_USE_CASE_LABEL: Record<NonNullable<PulseGarminSignalUsefulnessResponse['items'][number]['recommendedNextConsumer']>, string> = {
  daily_decision: 'Daily Decision',
  plan_generation: 'Plan-Generierung',
  recovery_note: 'Recovery-Notiz',
  race_readiness: 'Race Readiness',
  mental_load: 'Mental Load',
  data_quality: 'Data Quality',
};

function GarminSignalUsefulnessPanel({ data, isLoading }: {
  data: PulseGarminSignalUsefulnessResponse | undefined;
  isLoading: boolean;
}) {
  if (isLoading && !data) {
    return (
      <div className="card" data-testid="garmin-signal-usefulness-panel">
        <Skeleton height={10} width="28%" />
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <Skeleton height={40} />
          <Skeleton height={40} />
        </div>
      </div>
    );
  }
  if (!data) return null;

  const rows = data.topUnderused.length > 0
    ? data.topUnderused
    : data.items.filter(signal => signal.status !== 'used').slice(0, 3);

  return (
    <div className="card" data-testid="garmin-signal-usefulness-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 8 }}>
        <span className="label-mono">Garmin Signalnutzen</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          {data.summary.used} genutzt · {data.summary.underused} offen
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
        {rows.map(signal => {
          const status = SIGNAL_STATUS_LABEL[signal.status];
          return (
            <div
              key={signal.signalKey}
              data-testid={`garmin-signal-${signal.signalKey}`}
              style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '9px 10px', background: 'var(--surface-2)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                <strong style={{ fontSize: 12, color: 'var(--text)' }}>{signal.label}</strong>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: status.color,
                  border: `1px solid ${status.color}`,
                  borderRadius: 4,
                  padding: '2px 5px',
                  whiteSpace: 'nowrap',
                }}>
                  {status.label}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45 }}>{signal.whyItMatters}</div>
              <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
                {signal.coverageDays} Tage · {signal.recommendedNextConsumer ? SIGNAL_USE_CASE_LABEL[signal.recommendedNextConsumer] : 'kein naechster Consumer'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GarminDomainHint({ domains }: { domains: PulseGarminCoverageDomain[] }) {
  const { data } = useGarminCoverage(30);
  const rows = data?.domains.filter(domain => domains.includes(domain.domain) && domain.status !== 'fresh') ?? [];
  if (rows.length === 0) return null;

  return (
    <div className="card" data-testid="garmin-quality-hint" style={{ borderColor: 'rgba(245,158,11,0.28)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 4 }}>
        <span className="label-mono" style={{ color: 'var(--amber)' }}>Garmin Datenqualität</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>30T</span>
      </div>
      <GarminQualityList domains={rows} limit={3} />
    </div>
  );
}

function isBackfillCandidate(day: PulseDataCoverageDay): boolean {
  return (
    day.dailyMetrics.reason === 'not_synced' ||
    day.dailyMetrics.reason === 'not_synced_yet' ||
    day.dailyMetrics.status === 'partial' ||
    day.sleep.reason === 'not_synced' ||
    day.sleep.reason === 'not_synced_yet' ||
    day.sleep.status === 'partial' ||
    day.activities.reason === 'not_synced' ||
    day.activities.reason === 'not_synced_yet' ||
    day.activities.status === 'partial' ||
    day.weight.reason === 'not_synced' ||
    day.weight.reason === 'not_synced_yet' ||
    day.weight.status === 'partial'
  );
}

type CoverageDiagnosis = {
  status: string;
  cause: string;
  action: string;
};

function coverageDiagnosis(domain: PulseDataCoverageDomain): CoverageDiagnosis {
  const missing = domain.missingFields && domain.missingFields.length > 0
    ? ` Fehlende Felder: ${domain.missingFields.join(', ')}.`
    : '';

  if (domain.status === 'present') {
    return {
      status: 'OK',
      cause: 'Pulse hat diese Domain für den Tag.',
      action: 'Keine Aktion.',
    };
  }

  if (domain.reason === 'not_synced' || domain.reason === 'not_synced_yet') {
    return {
      status: domain.status === 'partial' ? 'Unvollständig' : 'Sync-Lücke',
      cause: `${COVERAGE_REASON[domain.reason] ?? domain.reason}.${missing}`,
      action: 'Backfill möglich.',
    };
  }

  if (domain.reason === 'garmin_unavailable') {
    return {
      status: 'Garmin offen',
      cause: `Garmin liefert diese Domain gerade nicht.${missing}`,
      action: 'Später erneut prüfen.',
    };
  }

  if (domain.reason === 'not_recorded') {
    return {
      status: 'Nicht erfasst',
      cause: `Für diesen Tag wurde nichts aufgezeichnet.${missing}`,
      action: 'Nicht per Backfill lösbar.',
    };
  }

  return {
    status: domain.status === 'partial' ? 'Unvollständig' : 'Fehlt',
    cause: `${COVERAGE_REASON[domain.reason] ?? domain.reason}.${missing}`,
    action: domain.status === 'partial' ? 'Backfill prüfen.' : 'Datenquelle prüfen.',
  };
}

function coverageDayNeedsAction(day: PulseDataCoverageDay): boolean {
  return (
    day.dailyMetrics.status !== 'present' ||
    day.sleep.status !== 'present' ||
    day.activities.status !== 'present' ||
    day.weight.status !== 'present' ||
    day.activities.missingWeatherCount > 0
  );
}

function CoverageDiagnosisPanel({
  data,
  shownDays,
  candidateCount,
}: {
  data: PulseDataCoverageResponse;
  shownDays: PulseDataCoverageDay[];
  candidateCount: number;
}) {
  const weatherGap = Math.max(0, data.summary.activities - data.summary.weatherActivities);
  const actionDays = shownDays.filter(coverageDayNeedsAction).length;
  const profileMissing = data.profile.missing.length;

  let status = 'Datenlage gut';
  let cause = 'Die wichtigsten Garmin-Domains sind im sichtbaren Zeitraum vorhanden.';
  let action = 'Keine Aktion nötig.';

  if (profileMissing > 0) {
    status = 'Profil unvollständig';
    cause = `${profileMissing} Profilwerte fehlen und können Trainingszonen oder Plan-Kontext schwächen.`;
    action = 'In Settings das Garmin-Profil synchronisieren.';
  } else if (candidateCount > 0) {
    status = 'Nachladbare Lücken';
    cause = `${candidateCount} Tage im gewählten Monat sind gar nicht oder nur teilweise synchronisiert.`;
    action = 'Erst Vorschau starten, dann Nachladen nur bei plausibler Liste.';
  } else if (weatherGap > 0) {
    status = 'Wetterlücken';
    cause = `${weatherGap} Aktivitäten haben noch kein Wetter im Pulse-Datensatz.`;
    action = 'Backfill prüfen oder beim nächsten Garmin-Sync erneut kontrollieren.';
  } else if (actionDays > 0) {
    status = 'Nicht nachladbare Lücken';
    cause = `${actionDays} Tage zeigen fehlende Domains, die vermutlich nicht aufgezeichnet wurden.`;
    action = 'Fachlich ignorieren oder Garmin-Aufzeichnung prüfen.';
  }

  const rows = [
    { label: 'Status', value: status },
    { label: 'Ursache', value: cause },
    { label: 'Aktion', value: action },
  ];

  return (
    <div className="card" style={{ padding: '12px 14px', borderColor: candidateCount > 0 || profileMissing > 0 ? 'rgba(245,158,11,0.28)' : 'var(--border)' }}>
      <span className="label-mono">Coverage Diagnose</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 10 }}>
        {rows.map(row => (
          <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {row.label}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function backfillGuidance({
  from,
  to,
  isPending,
  candidateCount,
}: {
  from: string | null;
  to: string | null;
  isPending: boolean;
  candidateCount: number;
}): string {
  if (isPending) return 'Backfill läuft gerade.';
  if (!from || !to) return 'Kein Zeitraum ausgewählt.';
  if (candidateCount === 0) return 'Keine nachladbaren Kandidaten in diesem Monat.';
  return 'Vorschau verändert nichts; Nachladen schreibt Garmin-Daten für den gewählten Monat in Pulse.';
}

function formatMonth(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  if (!year || !monthIndex) return month;
  return new Date(Date.UTC(year, monthIndex - 1, 1)).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function backfillNextAction(result: PulseGarminBackfillResponse): string {
  if (result.summary.failed > 0) return 'Fehlerhafte Tage zuerst prüfen.';
  if (result.dryRun && result.summary.planned > 0) return 'Nachladen starten.';
  if (result.dryRun) return 'Keine Aktion nötig.';
  if (result.summary.synced > 0) return 'Coverage wird neu geladen; Monatsliste kontrollieren.';
  return 'Beim nächsten Garmin-Sync erneut prüfen.';
}

function backfillStatusLabel(status: PulseGarminBackfillResponse['days'][number]['status']): string {
  if (status === 'failed') return 'Fehler';
  if (status === 'planned') return 'Geplant';
  if (status === 'synced') return 'Synchronisiert';
  return 'Übersprungen';
}

function prioritizedBackfillDays(result: PulseGarminBackfillResponse): PulseGarminBackfillResponse['days'] {
  const priority: Record<PulseGarminBackfillResponse['days'][number]['status'], number> = {
    failed: 0,
    planned: 1,
    synced: 2,
    skipped: 3,
  };
  return [...result.days].sort((a, b) => {
    const byStatus = priority[a.status] - priority[b.status];
    if (byStatus !== 0) return byStatus;
    return a.date.localeCompare(b.date);
  });
}

function BackfillResult({ result }: { result: PulseGarminBackfillResponse }) {
  const color = result.summary.failed > 0 ? 'var(--rose)' : result.dryRun ? 'var(--amber)' : 'var(--green)';
  const nextAction = backfillNextAction(result);
  const priorityDays = prioritizedBackfillDays(result).slice(0, 5);
  const summaryRows = [
    { label: 'Zeitraum', value: `${result.range.from} bis ${result.range.to}` },
    { label: 'Geplant', value: String(result.summary.planned) },
    { label: 'Synchronisiert', value: String(result.summary.synced) },
    { label: 'Fehler', value: String(result.summary.failed) },
    { label: 'Nächste Aktion', value: nextAction },
  ];

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', border: `1px solid ${color}`, borderRadius: 5, background: 'var(--surface-2)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>
        {result.dryRun ? 'Vorschau' : 'Backfill Ergebnis'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 8 }}>
        {summaryRows.map(row => (
          <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {row.label}
            </span>
            <span style={{ fontSize: 11, color: row.label === 'Nächste Aktion' ? color : 'var(--text-2)', lineHeight: 1.45 }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
      {result.summary.activities > 0 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
          Aktivitäten {result.summary.activities} · Gewichtstage {result.summary.weightDays}
        </div>
      )}
      {priorityDays.length > 0 && (
        <ul data-testid="backfill-priority-days" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, padding: 0, listStyle: 'none' }}>
          {priorityDays.map(day => (
            <li key={`${day.date}-${day.status}`} style={{ fontSize: 10, color: day.status === 'failed' ? 'var(--rose)' : 'var(--text-3)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
              {day.date} · {backfillStatusLabel(day.status)}{day.error ? ` · ${day.error}` : day.reason ? ` · ${day.reason}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function toBackfillMemory(result: PulseGarminBackfillResponse): BackfillMemory {
  return {
    at: new Date().toISOString(),
    dryRun: result.dryRun,
    from: result.range.from,
    to: result.range.to,
    planned: result.summary.planned,
    synced: result.summary.synced,
    skipped: result.summary.skipped,
    failed: result.summary.failed,
  };
}

function rememberBackfillResult(result: PulseGarminBackfillResponse): BackfillMemory {
  const memory = toBackfillMemory(result);
  try {
    localStorage.setItem(BACKFILL_LAST_STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Local status memory is optional.
  }
  return memory;
}

function loadLastBackfillResult(): BackfillMemory | null {
  try {
    const raw = localStorage.getItem(BACKFILL_LAST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BackfillMemory>;
    if (!parsed.at || !parsed.from || !parsed.to) return null;
    return {
      at: parsed.at,
      dryRun: Boolean(parsed.dryRun),
      from: parsed.from,
      to: parsed.to,
      planned: Number(parsed.planned ?? 0),
      synced: Number(parsed.synced ?? 0),
      skipped: Number(parsed.skipped ?? 0),
      failed: Number(parsed.failed ?? 0),
    };
  } catch {
    return null;
  }
}

function LastBackfillCard({ last }: { last: BackfillMemory }) {
  const color = last.failed > 0 ? 'var(--rose)' : last.dryRun ? 'var(--amber)' : 'var(--green)';
  return (
    <div style={{ marginTop: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Letzter Backfill
      </div>
      <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
        {last.dryRun ? 'Vorschau' : 'Echter Lauf'} · {last.from} bis {last.to} · {last.planned} geplant · {last.synced} synchronisiert · {last.failed} Fehler
      </div>
      <div style={{ marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 9, color }}>
        {new Date(last.at).toLocaleString('de-DE')}
      </div>
    </div>
  );
}

function CoverageCell({ domain }: { domain: PulseDataCoverageDomain }) {
  const diagnosis = coverageDiagnosis(domain);
  return (
    <td style={{ padding: '7px 10px', textAlign: 'right', verticalAlign: 'top' }}>
      <CoveragePill status={domain.status} />
      <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 3, overflowWrap: 'anywhere', lineHeight: 1.35 }}>
        <div>Status: {diagnosis.status}</div>
        <div>Ursache: {diagnosis.cause}</div>
        <div>Aktion: {diagnosis.action}</div>
      </div>
    </td>
  );
}

export function CoverageTab() {
  const currentYear = new Date().getFullYear();
  const [range, setRange] = useState<'30' | '90' | 'year'>('30');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [backfillResult, setBackfillResult] = useState<PulseGarminBackfillResponse | null>(null);
  const [lastBackfill, setLastBackfill] = useState<BackfillMemory | null>(() => loadLastBackfillResult());
  const coverage = useDataCoverage(range === 'year' ? { year: currentYear } : { days: Number(range) });
  const garminCoverage = useGarminCoverage(range === 'year' ? 366 : Number(range));
  const signalUsefulness = useGarminSignalUsefulness(range === 'year' ? 366 : Number(range));
  const backfill = useGarminBackfill();

  if (coverage.isLoading) return <Loading rows={3} />;
  if (coverage.error) return <Empty msg={coverage.error.message} />;

  const data = coverage.data;
  if (!data) return <Empty msg="Keine Abdeckungsdaten." />;
  const profileReady = data.profile.missing.length === 0;
  const shownDays = data.days.slice(0, 31);
  const monthOptions = [...new Set(data.days.map(day => day.date.slice(0, 7)))].sort().reverse();
  const activeMonth = selectedMonth && monthOptions.includes(selectedMonth)
    ? selectedMonth
    : monthOptions[0] ?? '';
  const activeMonthDays = activeMonth
    ? data.days.filter(day => day.date.startsWith(activeMonth))
    : shownDays;
  const activeMonthDates = activeMonthDays.map(day => day.date).sort();
  const backfillFrom = activeMonthDates[0] ?? null;
  const backfillTo = activeMonthDates[activeMonthDates.length - 1] ?? null;
  const candidateCount = activeMonthDays.filter(isBackfillCandidate).length;
  const guidance = backfillGuidance({ from: backfillFrom, to: backfillTo, isPending: backfill.isPending, candidateCount });

  async function runBackfill(dryRun: boolean) {
    if (!backfillFrom || !backfillTo) return;
    const result = await backfill.mutateAsync({
      from: backfillFrom,
      to: backfillTo,
      dryRun,
      domains: ['dailyMetrics', 'sleep', 'activities', 'weather', 'weight'],
    });
    setBackfillResult(result);
    setLastBackfill(rememberBackfillResult(result));
    if (!dryRun) void coverage.refetch();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          {data.range.from} bis {data.range.to}
        </span>
        <RangePicker
          value={range === 'year' ? currentYear : Number(range)}
          onChange={v => setRange(v === currentYear ? 'year' : String(v) as '30' | '90')}
          options={[
            { value: 30, label: '30T' },
            { value: 90, label: '90T' },
            { value: currentYear, label: String(currentYear) },
          ]}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 8 }}>
        <CoverageMetric label="Tagesmetriken" value={`${data.summary.dailyMetricsDays}/${data.range.days}`} />
        <CoverageMetric label="Schlaf" value={`${data.summary.sleepDays}/${data.range.days}`} />
        <CoverageMetric label="Aktivitäten" value={String(data.summary.activities)} sub={`${data.summary.activityDays} Tage`} />
        <CoverageMetric label="Wetter" value={`${data.summary.weatherActivities}/${data.summary.activities}`} />
        <CoverageMetric label="Gewicht" value={`${data.summary.weightDays}/${data.range.days}`} />
        <CoverageMetric label="Profil" value={profileReady ? 'OK' : `${data.profile.missing.length} fehlt`} sub={data.profile.updatedAt ? new Date(data.profile.updatedAt).toLocaleDateString('de-DE') : undefined} />
      </div>

      {garminCoverage.data && (
        <div className="card" data-testid="garmin-quality-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 8 }}>
            <span className="label-mono">Garmin Domainqualität</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
              {garminCoverage.data.domains.filter(domain => domain.status === 'fresh').length}/{garminCoverage.data.domains.length} frisch
            </span>
          </div>
          <GarminQualityList domains={garminCoverage.data.domains} />
        </div>
      )}

      <GarminSignalUsefulnessPanel
        data={signalUsefulness.data}
        isLoading={signalUsefulness.isLoading}
      />

      <CoverageDiagnosisPanel data={data} shownDays={shownDays} candidateCount={candidateCount} />

      <div className="card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div>
            <span className="label-mono">Garmin Backfill</span>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              {candidateCount} Kandidaten · max. 31 Tage
            </div>
          </div>
          <select
            value={activeMonth}
            onChange={event => {
              setSelectedMonth(event.target.value);
              setBackfillResult(null);
            }}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              padding: '6px 8px',
            }}
          >
            {monthOptions.map(month => (
              <option key={month} value={month}>{formatMonth(month)}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          <button
            type="button"
            disabled={!backfillFrom || !backfillTo || backfill.isPending}
            onClick={() => void runBackfill(true)}
            style={{
              padding: '9px 10px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--text-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: backfill.isPending ? 'default' : 'pointer',
            }}
          >
            Vorschau
          </button>
          <button
            type="button"
            disabled={!backfillFrom || !backfillTo || backfill.isPending || candidateCount === 0}
            onClick={() => void runBackfill(false)}
            style={{
              padding: '9px 10px',
              background: candidateCount === 0 ? 'var(--surface-2)' : 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 5,
              color: candidateCount === 0 ? 'var(--text-3)' : 'var(--bg)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: backfill.isPending || candidateCount === 0 ? 'default' : 'pointer',
            }}
          >
            {backfill.isPending ? 'Lädt…' : 'Nachladen'}
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: candidateCount === 0 ? 'var(--text-3)' : 'var(--text-2)', lineHeight: 1.45 }}>
          {guidance}
        </div>
        {lastBackfill && <LastBackfillCard last={lastBackfill} />}
        {backfill.error && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--rose)' }}>
            {backfill.error.message}
          </div>
        )}
        {backfillResult && <BackfillResult result={backfillResult} />}
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px 8px' }}>
          <span className="label-mono">Domain-Abdeckung</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
            {shownDays.length} Tage
          </span>
        </div>
        <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
              {['Datum', 'Metriken', 'Schlaf', 'Aktivität', 'Gewicht'].map(h => (
                <th key={h} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 400,
                  padding: '6px 10px', textAlign: h === 'Datum' ? 'left' : 'right',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownDays.map((day, i) => (
              <tr key={day.date} style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
                <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>{day.date}</td>
                <CoverageCell domain={day.dailyMetrics} />
                <CoverageCell domain={day.sleep} />
                <td style={{ padding: '7px 10px', textAlign: 'right', verticalAlign: 'top' }}>
                  <CoveragePill status={day.activities.status}>{day.activities.count > 0 ? `${day.activities.count}x` : undefined}</CoveragePill>
                  <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 3, overflowWrap: 'anywhere' }}>
                    <div>Status: {coverageDiagnosis(day.activities).status}</div>
                    <div>Ursache: {day.activities.count > 0 && day.activities.missingWeatherCount > 0
                      ? `${day.activities.missingWeatherCount} ohne Wetter`
                      : coverageDiagnosis(day.activities).cause}</div>
                    <div>Aktion: {coverageDiagnosis(day.activities).action}</div>
                  </div>
                </td>
                <CoverageCell domain={day.weight} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!profileReady && (
        <div className="card" style={{ borderColor: 'rgba(245,158,11,0.28)' }}>
          <span className="label-mono" style={{ color: 'var(--amber)' }}>Profilwerte fehlen</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {data.profile.missing.map(item => (
              <span key={item} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 4, padding: '3px 7px' }}>
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
