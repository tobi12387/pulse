import { useState } from 'react';
import {
  usePulseSleep, usePulseCheckin, useCheckinToday,
  useDataCoverage, useGarminBackfill, usePulseMetrics, usePulseWeight, useLogWeight, useCheckinHistory,
  useCheckinGuidance, useGarminCoverage,
} from '@/pulse/hooks';
import { LineChart } from '@/components/SparkChart';
import { Skeleton } from '@/components/Skeleton';
import { BodyCompChart } from '@/components/BodyCompChart';
import { ThemeTimeline } from '@/components/ThemeTimeline';
import { GarminQualityList } from '@/components/GarminQualityList';
import { PageHeader, RangeControl, SegmentedControl } from '@/components/PulseChrome';
import type {
  PulseDataCoverageDay,
  PulseDataCoverageDomain,
  PulseDataCoverageResponse,
  PulseGarminBackfillResponse,
  PulseGarminCoverageDomain,
  PulseSleepSession,
} from '@coaching-os/shared/pulse';

type Tab = 'abdeckung' | 'schlaf' | 'metriken' | 'gewicht' | 'mental';
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

function fmt(v: number | null | undefined, decimals = 1, suffix = ''): string {
  return v == null ? '–' : `${v.toFixed(decimals)}${suffix}`;
}

// ─── Shared ───────────────────────────────────────────────────────────────────

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

function CoveragePill({ status, children }: { status: PulseDataCoverageDay['dailyMetrics']['status']; children?: React.ReactNode }) {
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

function GarminDomainHint({ domains }: { domains: PulseGarminCoverageDomain[] }) {
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

function CoverageTab() {
  const currentYear = new Date().getFullYear();
  const [range, setRange] = useState<'30' | '90' | 'year'>('30');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [backfillResult, setBackfillResult] = useState<PulseGarminBackfillResponse | null>(null);
  const [lastBackfill, setLastBackfill] = useState<BackfillMemory | null>(() => loadLastBackfillResult());
  const coverage = useDataCoverage(range === 'year' ? { year: currentYear } : { days: Number(range) });
  const garminCoverage = useGarminCoverage(range === 'year' ? 366 : Number(range));
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

// ─── Schlaf ───────────────────────────────────────────────────────────────────

const STAGE_COLORS = {
  deep:  '#6366f1',
  rem:   '#a78bfa',
  light: '#60a5fa',
  awake: 'rgba(139,149,163,0.3)',
};

function SleepStagePill({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
        {label} {value}
      </span>
    </span>
  );
}

function SleepStageBar({ deepH, remH, lightH, awakeH, totalH }: {
  deepH: number | null; remH: number | null; lightH: number | null;
  awakeH: number | null; totalH: number | null;
}) {
  if (!totalH || totalH <= 0) {
    return <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2 }} />;
  }
  const pct = (h: number | null) => Math.max(0, Math.round(((h ?? 0) / totalH) * 100));
  return (
    <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', gap: 1 }}>
      <div style={{ width: `${pct(deepH)}%`,  background: STAGE_COLORS.deep  }} />
      <div style={{ width: `${pct(remH)}%`,   background: STAGE_COLORS.rem   }} />
      <div style={{ width: `${pct(lightH)}%`, background: STAGE_COLORS.light }} />
      <div style={{ width: `${pct(awakeH)}%`, background: STAGE_COLORS.awake }} />
    </div>
  );
}

const RANGE_OPTS = [
  { value: 7,  label: '7T'  },
  { value: 30, label: '30T' },
  { value: 90, label: '90T' },
];

function SchlafTab() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = usePulseSleep(days);
  if (isLoading) return <Loading />;
  if (error) return <Empty msg={error.message} />;
  const sessions = data?.sessions ?? [];
  if (sessions.length === 0) return <Empty msg="Keine Schlafdaten — Garmin sync." />;

  const chronological = [...sessions].reverse();
  const durations = chronological.map(s => s.durationH);
  const labels    = chronological.map(s => s.date);
  const avg = sessions.reduce((s, x) => s + (x.durationH ?? 0), 0) / sessions.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Range selector + overview chart */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <span className="label-mono">Schlafdauer</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', marginLeft: 8 }}>
              Ø {avg.toFixed(1)}h
            </span>
          </div>
          <RangePicker value={days} onChange={setDays} options={RANGE_OPTS} />
        </div>
        <LineChart values={durations} labels={labels} height={80} color="var(--blue)" fillOpacity={0.12} />
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          {[['deep','Tief'],['rem','REM'],['light','Leicht']] .map(([k,l]) => (
            <SleepStagePill key={k} color={STAGE_COLORS[k as keyof typeof STAGE_COLORS]} label={l} value="" />
          ))}
        </div>
      </div>

      <GarminDomainHint domains={['sleep']} />

      {/* Per-night rows */}
      {sessions.map((s) => (
        <div key={s.date} className="card" style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{s.date}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
              {fmt(s.durationH, 1, 'h')}
            </span>
          </div>
          <SleepStageBar deepH={s.deepSleepH} remH={s.remSleepH} lightH={s.lightSleepH} awakeH={s.awakeH} totalH={s.durationH} />
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <SleepStagePill color={STAGE_COLORS.deep}  label="Tief"  value={fmt(s.deepSleepH,  1, 'h')} />
            <SleepStagePill color={STAGE_COLORS.rem}   label="REM"   value={fmt(s.remSleepH,   1, 'h')} />
            <SleepStagePill color={STAGE_COLORS.light} label="Leicht" value={fmt(s.lightSleepH, 1, 'h')} />
            {s.sleepScore != null && (
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
                Score {s.sleepScore}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Metriken ─────────────────────────────────────────────────────────────────


function MetricCard({ label, values, labels, latest, suffix, color }: {
  label: string; values: (number | null)[]; labels: string[];
  latest: number | null; suffix?: string; color: string;
}) {
  return (
    <div className="card" style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span className="label-mono">{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>
          {fmt(latest, 0, suffix ?? '')}
        </span>
      </div>
      <LineChart values={values} labels={labels} height={72} color={color} fillOpacity={0.1} />
    </div>
  );
}

type RecoveryMetricRow = {
  date: string;
  bodyBatteryAtWake?: number | null;
  bodyBatteryCharged?: number | null;
  bodyBatteryDrained?: number | null;
  highStressSec?: number | null;
  latestSpo2?: number | null;
  avgWakingRespiration?: number | null;
  moderateIntensityMin?: number | null;
  vigorousIntensityMin?: number | null;
};

function fmtMinutes(min: number | null | undefined): string {
  return min == null ? '–' : `${Math.round(min)} min`;
}

function fmtHoursFromSec(sec: number | null | undefined): string {
  return sec == null ? '–' : `${(sec / 3600).toFixed(1)}h`;
}

function RecoveryDepthCard({ metrics, sessions }: { metrics: RecoveryMetricRow[]; sessions: PulseSleepSession[] }) {
  const latestMetric = metrics.at(-1);
  const latestSleep = sessions[0];
  const sleepNeedGap = latestSleep?.sleepNeedMin != null && latestSleep.sleepActualMin != null
    ? Math.max(0, latestSleep.sleepNeedMin - latestSleep.sleepActualMin)
    : null;
  const charged = latestMetric?.bodyBatteryCharged ?? null;
  const drained = latestMetric?.bodyBatteryDrained ?? null;
  const intensityMin = (latestMetric?.moderateIntensityMin ?? 0) + (latestMetric?.vigorousIntensityMin ?? 0);

  const rows = [
    {
      label: 'Schlafbedarf',
      value: sleepNeedGap != null ? `${fmtMinutes(sleepNeedGap)} offen` : '–',
      sub: latestSleep?.sleepNeedMin != null ? `Bedarf ${fmtMinutes(latestSleep.sleepNeedMin)}` : 'nicht geliefert',
    },
    {
      label: 'Body Battery Ladung',
      value: charged != null || drained != null ? `+${charged ?? 0} / -${drained ?? 0}` : '–',
      sub: latestMetric?.bodyBatteryAtWake != null ? `Aufwachen ${latestMetric.bodyBatteryAtWake}%` : 'Aufwachen offen',
    },
    {
      label: 'Stress hoch',
      value: fmtHoursFromSec(latestMetric?.highStressSec),
      sub: latestMetric?.avgWakingRespiration != null ? `Resp. ${latestMetric.avgWakingRespiration.toFixed(1)}` : 'Resp. offen',
    },
    {
      label: 'SpO2',
      value: latestMetric?.latestSpo2 != null ? `${latestMetric.latestSpo2.toFixed(0)}%` : '–',
      sub: intensityMin > 0 ? `Intensität ${intensityMin} min` : 'Intensität offen',
    },
  ];

  return (
    <div className="card" style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginBottom: 10 }}>
        <span className="label-mono">Recovery Depth</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          {latestMetric?.date ?? latestSleep?.date ?? '–'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 8 }}>
        {rows.map(row => (
          <div key={row.label} style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '8px 9px', background: 'var(--surface-2)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {row.label}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text)', marginTop: 3 }}>
              {row.value}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
              {row.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetrikenTab() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = usePulseMetrics(days);
  const { data: sleepData, isLoading: sleepLoading } = usePulseSleep(days);
  if (isLoading || sleepLoading) return <Loading />;
  const rows = data?.metrics ?? [];
  if (rows.length === 0) return <Empty msg="Noch keine Daten — Garmin sync." />;

  const last = rows[rows.length - 1];
  const labels = rows.map(r => r.date);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Range selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <RangePicker value={days} onChange={setDays} options={RANGE_OPTS} />
      </div>

      <GarminDomainHint domains={['daily_metrics', 'hrv']} />

      <RecoveryDepthCard metrics={rows} sessions={sleepData?.sessions ?? []} />
      <MetricCard label="HRV (ms)"         values={rows.map(r => r.hrvRmssd)}      labels={labels} latest={last?.hrvRmssd ?? null}      color="var(--accent)" />
      <MetricCard label="Ruhepuls (bpm)"   values={rows.map(r => r.restingHr)}     labels={labels} latest={last?.restingHr ?? null}     color="var(--rose)" />
      <MetricCard label="Body Battery"     values={rows.map(r => r.bodyBatteryMax)} labels={labels} latest={last?.bodyBatteryMax ?? null} suffix="%" color="var(--green)" />
      <MetricCard label="Stress"           values={rows.map(r => r.stressAvg)}     labels={labels} latest={last?.stressAvg ?? null}     color="var(--amber)" />
      <MetricCard label="Schritte"
        values={rows.map(r => r.steps != null ? Math.round(r.steps / 100) / 10 : null)}
        labels={labels}
        latest={last?.steps != null ? Math.round(last.steps / 100) / 10 : null}
        suffix="k"
        color="var(--blue)"
      />

      {/* Daily table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 4 }}>
        <div className="label-mono" style={{ padding: '10px 14px 6px' }}>Tageswerte</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {['Datum','HRV','Puls','Bat.','Stress'].map(h => (
                <th key={h} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: 'var(--text-3)', fontWeight: 400, padding: '5px 14px',
                  textAlign: h === 'Datum' ? 'left' : 'right',
                  borderTop: '1px solid var(--border)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().slice(0, Math.min(days, 14)).map((r, i) => (
              <tr key={r.date} style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
                <td style={{ padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>{r.date}</td>
                <td style={{ padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', textAlign: 'right' }}>{fmt(r.hrvRmssd, 0)}</td>
                <td style={{ padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>{fmt(r.restingHr, 0)}</td>
                <td style={{ padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>{fmt(r.bodyBatteryMax, 0, '%')}</td>
                <td style={{ padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>{fmt(r.stressAvg, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Gewicht ──────────────────────────────────────────────────────────────────

const WEIGHT_RANGE_OPTS = [
  { value: 30,  label: '30T' },
  { value: 90,  label: '90T' },
  { value: 180, label: '180T' },
];

function GewichtTab() {
  const [days, setDays] = useState(90);
  const { data, isLoading } = usePulseWeight(days);
  const logWeight = useLogWeight();
  const [kg, setKg] = useState('');
  const [inputError, setInputError] = useState('');

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    const w = parseFloat(kg);
    if (isNaN(w) || w < 30 || w > 300) { setInputError('Gültiger Wert: 30–300 kg'); return; }
    await logWeight.mutateAsync({ weightKg: w });
    setKg('');
    setInputError('');
  }

  const entries = data?.entries ?? [];
  const chronological = [...entries].reverse();
  const weights = chronological.map(e => e.weightKg);
  const weightLabels = chronological.map(e => e.date);
  const latest  = entries[0];
  const prev7   = entries.find((e) => {
    if (!latest) return false;
    const cutoff = new Date(latest.date);
    cutoff.setDate(cutoff.getDate() - 7);
    const y = cutoff.getFullYear(), m = String(cutoff.getMonth()+1).padStart(2,'0'), d = String(cutoff.getDate()).padStart(2,'0');
    return e.date <= `${y}-${m}-${d}`;
  });
  const trend7d = latest && prev7 ? latest.weightKg - prev7.weightKg : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Input form */}
      <div className="card">
        <form onSubmit={(e) => void handleLog(e)} style={{ display: 'flex', gap: 8 }}>
          <input
            type="number" step="0.1" min="30" max="300"
            value={kg}
            onChange={e => { setKg(e.target.value); setInputError(''); }}
            placeholder="kg"
            style={{
              flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '7px 12px',
              fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={logWeight.isPending || !kg}
            style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '7px 14px',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: kg ? 'var(--accent)' : 'var(--text-3)',
              cursor: kg ? 'pointer' : 'default',
            }}
          >
            {logWeight.isPending ? '…' : 'Log'}
          </button>
        </form>
        {inputError && <p style={{ fontSize: 11, color: 'var(--rose)', marginTop: 6 }}>{inputError}</p>}
      </div>

      <GarminDomainHint domains={['body_composition']} />

      {/* KPI cards */}
      {latest && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="card">
              <span className="label-mono">Aktuell</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 500, color: 'var(--text)', marginTop: 4 }}>
                {latest.weightKg.toFixed(1)}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em' }}>KG</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                {latest.date}
                {latest.source === 'garmin' && (
                  <span style={{ marginLeft: 6, color: 'var(--accent)', fontSize: 9 }}>GARMIN</span>
                )}
              </div>
            </div>
            <div className="card">
              <span className="label-mono">7-Tage-Trend</span>
              {trend7d !== null ? (
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 500, marginTop: 4,
                  color: trend7d < -0.1 ? 'var(--green)' : trend7d > 0.1 ? 'var(--rose)' : 'var(--text)',
                }}>
                  {trend7d > 0 ? '+' : ''}{trend7d.toFixed(1)}
                </div>
              ) : (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--text-3)', marginTop: 4 }}>–</div>
              )}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em' }}>KG</div>
            </div>
          </div>

          {(latest.bodyFatPct != null || latest.muscleMassKg != null || latest.bmi != null) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {latest.bodyFatPct != null && (
                <div className="card" style={{ padding: '10px 12px' }}>
                  <span className="label-mono">Körperfett</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--amber)', marginTop: 4 }}>
                    {latest.bodyFatPct.toFixed(1)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em' }}>%</div>
                </div>
              )}
              {latest.muscleMassKg != null && (
                <div className="card" style={{ padding: '10px 12px' }}>
                  <span className="label-mono">Muskeln</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--green)', marginTop: 4 }}>
                    {latest.muscleMassKg.toFixed(1)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em' }}>KG</div>
                </div>
              )}
              {latest.bmi != null && (
                <div className="card" style={{ padding: '10px 12px' }}>
                  <span className="label-mono">BMI</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--blue)', marginTop: 4 }}>
                    {latest.bmi.toFixed(1)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em' }}>&nbsp;</div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Body Composition Chart (90d, tabbed) */}
      <BodyCompChart />

      {/* Verlauf chart */}
      {weights.length >= 3 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="label-mono">Verlauf</span>
            <RangePicker value={days} onChange={setDays} options={WEIGHT_RANGE_OPTS} />
          </div>
          <LineChart values={weights} labels={weightLabels} height={80} color="var(--accent)" fillOpacity={0.08} />
        </div>
      )}

      {isLoading && <Loading />}

      {/* Log table */}
      {entries.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="label-mono" style={{ padding: '10px 14px 6px' }}>Einträge</div>
          {entries.slice(0, 20).map((e) => (
            <div key={e.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '7px 14px', borderTop: '1px solid var(--border)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                {e.date}
                {e.source === 'garmin' && (
                  <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--accent)' }}>G</span>
                )}
              </span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                {e.bodyFatPct != null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--amber)' }}>
                    {e.bodyFatPct.toFixed(1)}%
                  </span>
                )}
                {e.muscleMassKg != null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)' }}>
                    {e.muscleMassKg.toFixed(1)}kg M
                  </span>
                )}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)' }}>
                  {e.weightKg.toFixed(1)} kg
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mental ───────────────────────────────────────────────────────────────────

function SegmentedBar({ label, value, onChange, color = 'var(--accent)' }: {
  label: string; value: number; onChange: (v: number) => void; color?: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color }}>{value}/10</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} onClick={() => onChange(i + 1)} style={{
            flex: 1, height: 6, borderRadius: 1, cursor: 'pointer',
            background: i < value ? color : 'var(--bg)',
            border: '1px solid var(--border)',
            transition: 'background 0.1s',
          }} />
        ))}
      </div>
    </div>
  );
}

function MentalTab() {
  const [days, setDays] = useState(30);
  const { data: today }    = useCheckinToday();
  const { data: guidance } = useCheckinGuidance();
  const checkin            = usePulseCheckin();
  const { data: histData, isLoading: histLoading } = useCheckinHistory(days);
  const [form, setForm]    = useState({ mood: 7, energy: 7, stress: 3, motivation: 7, notes: '' });
  const [submitted, setSubmitted] = useState(false);

  function appendNote(label: string) {
    setForm(f => {
      const next = f.notes.trim().length > 0 ? `${f.notes.trim()}\n${label}` : label;
      return { ...f, notes: next };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await checkin.mutateAsync({ ...form, notes: form.notes || undefined });
    setSubmitted(true);
  }

  const alreadyDone = today?.checkin != null;
  const checkins    = histData?.checkins ?? [];
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

      {/* Check-in form */}
      {alreadyDone || submitted ? (
        <div className="card" style={{ borderColor: 'rgba(74,222,128,0.3)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', letterSpacing: '0.12em' }}>
            CHECK-IN HEUTE ERLEDIGT ✓
          </span>
        </div>
      ) : (
        <div className="card">
          <div style={{ marginBottom: 14 }}>
            <div className="label-mono" style={{ marginBottom: 6 }}>Geführter Daily Check-in</div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
              Kurzer Lageabgleich für Körper und Kopf. Die Werte bleiben kompakt, die Notiz hält fest, was mental wirklich zählt.
            </p>
          </div>
          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>Wie ist dein Kopf gerade?</p>
                <SegmentedBar label="Stimmung" value={form.mood} onChange={(v) => setForm(f => ({ ...f, mood: v }))} color="var(--accent)" />
              </div>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>Wie viel Energie ist verfügbar?</p>
                <SegmentedBar label="Energie" value={form.energy} onChange={(v) => setForm(f => ({ ...f, energy: v }))} color="var(--green)" />
              </div>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>Was zieht gerade mentale Energie?</p>
                <SegmentedBar label="Stress" value={form.stress} onChange={(v) => setForm(f => ({ ...f, stress: v }))} color="var(--amber)" />
              </div>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>Was wäre heute genug?</p>
                <SegmentedBar label="Motivation" value={form.motivation} onChange={(v) => setForm(f => ({ ...f, motivation: v }))} color="var(--blue)" />
              </div>
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
                    padding: 0,
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
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={4}
              placeholder="Was ist mental gerade wichtig? Was belastet, was schützt dich heute, und was wäre ein guter kleiner Abschluss?"
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '8px 12px',
                fontSize: 12, color: 'var(--text)', resize: 'none', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={checkin.isPending}
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--accent)',
                borderRadius: 'var(--radius)', padding: '9px 16px',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--accent)', cursor: 'pointer',
              }}
            >
              {checkin.isPending ? 'Speichern…' : 'Check-in senden'}
            </button>
          </form>
        </div>
      )}

      <ThemeTimeline />

      {/* History chart — multi-line SVG */}
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
            <RangePicker value={days} onChange={setDays} options={RANGE_OPTS} />
          </div>
          {histLoading ? <Skeleton height={100} /> : (() => {
            const N = checkins.length;
            const W = 400, H = 100, P = 10;
            const yMin = 0, yMax = 10;
            const xs = (i: number) => P + (i / (N - 1)) * (W - P * 2);
            const ys = (v: number) => H - P - ((v - yMin) / (yMax - yMin)) * (H - P * 2);
            const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i)} ${ys(v)}`).join(' ');
            return (
              <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 100 }}>
                {[2, 4, 6, 8].map(t => (
                  <line key={t} x1={P} x2={W - P} y1={ys(t)} y2={ys(t)} stroke="var(--border)" strokeWidth={0.5} />
                ))}
                <path d={path(checkins.map(c => c.mood))}       fill="none" stroke="var(--accent)" strokeWidth={1.6} />
                <path d={path(checkins.map(c => c.energy))}     fill="none" stroke="var(--green)"  strokeWidth={1.6} />
                <path d={path(checkins.map(c => c.stress))}     fill="none" stroke="var(--amber)"  strokeWidth={1.4} opacity={0.85} />
              </svg>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'abdeckung', label: 'Abdeckung' },
  { id: 'schlaf',   label: 'Schlaf'   },
  { id: 'metriken', label: 'Metriken' },
  { id: 'gewicht',  label: 'Gewicht'  },
  { id: 'mental',   label: 'Mental'   },
];

export default function Data() {
  const [tab, setTab] = useState<Tab>('abdeckung');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader eyebrow="DATA" title="Schlaf, Metriken & Mental" />
      <SegmentedControl items={TABS} active={tab} onChange={id => setTab(id as Tab)} />
      {tab === 'abdeckung'   && <CoverageTab />}
      {tab === 'schlaf'      && <SchlafTab />}
      {tab === 'metriken'    && <MetrikenTab />}
      {tab === 'gewicht'     && <GewichtTab />}
      {tab === 'mental'      && <MentalTab />}
    </div>
  );
}
