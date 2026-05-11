import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, SegmentedControl } from '@/components/PulseChrome';
import { CoverageTab } from '@/features/data/coverage/coverage-components';
import { MentalTab } from '@/features/data/mental/mental-components';
import { GewichtTab, MetrikenTab, SchlafTab } from '@/features/data/recovery/recovery-components';
import { DataAnalysenTab } from '@/pages/Insights';
import { useCheckinToday, usePulseHome } from '@/pulse/hooks';

type Tab = 'heute' | 'trends' | 'qualitaet' | 'analyse';
type DataFocus = 'mental' | 'recovery' | 'sleep' | 'weight' | null;

const TABS = [
  { id: 'heute', label: 'Heute relevant' },
  { id: 'trends', label: 'Trends' },
  { id: 'qualitaet', label: 'Datenqualität' },
  { id: 'analyse', label: 'Analyse' },
];

const TAB_QUERY: Record<Tab, string> = {
  heute: 'today',
  trends: 'trends',
  qualitaet: 'quality',
  analyse: 'analysis',
};

const QUERY_TAB: Record<string, Tab> = {
  today: 'heute',
  heute: 'heute',
  overview: 'heute',
  ueberblick: 'heute',
  mental: 'heute',
  trends: 'trends',
  sleep: 'trends',
  schlaf: 'trends',
  metrics: 'trends',
  metriken: 'trends',
  weight: 'trends',
  gewicht: 'trends',
  quality: 'qualitaet',
  datenqualitaet: 'qualitaet',
  coverage: 'qualitaet',
  abdeckung: 'qualitaet',
  analysis: 'analyse',
  analyse: 'analyse',
  analysen: 'analyse',
  insights: 'analyse',
};

const HASH_TAB: Record<string, Tab> = {
  'data-recovery': 'trends',
  'data-sleep': 'trends',
  'data-weight': 'trends',
  'data-mental': 'heute',
  'data-garmin-quality': 'qualitaet',
  'data-plan-trace': 'analyse',
  'data-personal-response': 'analyse',
  'data-goal-projection': 'analyse',
};

function tabFromQuery(value: string | null): Tab {
  return value ? QUERY_TAB[value] ?? 'heute' : 'heute';
}

function focusFromQuery(value: string | null, hash: string): DataFocus {
  const decodedHash = hashFromLocation(hash);
  if (decodedHash === 'data-mental') return 'mental';
  if (decodedHash === 'data-sleep') return 'sleep';
  if (decodedHash === 'data-weight') return 'weight';
  if (decodedHash === 'data-recovery') return 'recovery';
  if (value === 'mental') return 'mental';
  if (value === 'sleep' || value === 'schlaf') return 'sleep';
  if (value === 'weight' || value === 'gewicht') return 'weight';
  if (value === 'metrics' || value === 'metriken') return 'recovery';
  return null;
}

function hashFromLocation(hash: string): string {
  const value = hash.replace(/^#/, '');
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function EvidenceSection({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} className="evidence-section" tabIndex={-1}>
      {children}
    </section>
  );
}

function TabPanel({ tab, children }: { tab: Tab; children: ReactNode }) {
  return (
    <section role="tabpanel" id={`data-${tab}-panel`} aria-labelledby={`data-${tab}-tab`}>
      {children}
    </section>
  );
}

function fmtMetric(value: number | null | undefined, decimals = 0): string {
  return value == null ? '–' : value.toFixed(decimals);
}

function readinessTone(color: string | undefined): string {
  if (color === 'green') return 'var(--green)';
  if (color === 'amber') return 'var(--amber)';
  if (color === 'rose') return 'var(--rose)';
  if (color === 'blue') return 'var(--blue)';
  return 'var(--accent)';
}

function garminStatusLabel(status: string | undefined): string {
  if (status === 'ready') return 'Garmin bereit';
  if (status === 'stale') return 'Garmin alt';
  if (status === 'partial') return 'Garmin teilweise';
  if (status === 'empty') return 'Garmin leer';
  return 'Garmin lädt';
}

function garminTone(status: string | undefined): string {
  if (status === 'ready') return 'var(--green)';
  if (status === 'empty') return 'var(--rose)';
  if (status === 'stale' || status === 'partial') return 'var(--amber)';
  return 'var(--accent)';
}

function EvidenceTriage({ onOpen }: { onOpen: (tab: Tab, hash?: string) => void }) {
  const homeQuery = usePulseHome();
  const checkinToday = useCheckinToday();
  const navigate = useNavigate();
  const home = homeQuery.data;
  const garmin = home?.dataStatus.garmin;
  const hasCheckin = checkinToday.data?.checkin != null;
  const rows: Array<{
    id: string;
    tab: Tab;
    hash: string;
    targetPath?: string;
    label: string;
    value: string;
    detail: string;
    tone: string;
  }> = [
    {
      id: 'readiness',
      tab: 'trends',
      hash: 'data-recovery',
      label: 'Readiness / TSB',
      value: `Readiness ${fmtMetric(home?.readiness.score)}/100 · TSB ${fmtMetric(home?.fitnessLoad.tsb, 1)}`,
      detail: home
        ? `${home.readiness.shortLabel}; CTL ${fmtMetric(home.fitnessLoad.ctl, 1)}, ATL ${fmtMetric(home.fitnessLoad.atl, 1)}.`
        : 'Tagesform und Trainingslast werden geladen.',
      tone: readinessTone(home?.readiness.color),
    },
    {
      id: 'mental',
      tab: 'heute',
      hash: 'data-mental',
      label: 'Mental Check-in',
      value: checkinToday.isLoading ? 'Status wird geladen' : hasCheckin ? 'Heute vorhanden' : 'Heute offen',
      detail: hasCheckin
        ? 'Subjektives Signal ist heute im Kontext.'
        : 'Fehlt dieses Signal, bleiben Briefing und Plan vorsichtiger.',
      tone: hasCheckin ? 'var(--green)' : 'var(--amber)',
    },
    {
      id: 'garmin',
      tab: 'qualitaet',
      hash: 'data-garmin-quality',
      label: 'Garmin-Frische',
      value: `${garminStatusLabel(garmin?.status)} · ${garmin?.metricsDays14 ?? '–'} Metrik-Tage`,
      detail: `${garmin?.activitiesDays14 ?? '–'} Aktivitäten in 14 Tagen; letzte Tagesdaten ${garmin?.lastMetricDate ?? 'unbekannt'}.`,
      tone: garminTone(garmin?.status),
    },
    {
      id: 'plan-load',
      tab: 'analyse',
      hash: 'data-plan-trace',
      targetPath: '/plan?tab=training&source=data-load#plan-scenario-preview',
      label: 'Plan-/Load',
      value: `CTL ${fmtMetric(home?.fitnessLoad.ctl, 1)} · ATL ${fmtMetric(home?.fitnessLoad.atl, 1)}`,
      detail: 'Zur Szenario-Vorschau wechseln und Planwirkung prüfen.',
      tone: 'var(--accent)',
    },
  ];

  return (
    <section
      data-testid="data-evidence-triage"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 5,
        padding: '10px 11px',
        background: 'var(--surface-2)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginBottom: 8 }}>
        <div className="label-mono" style={{ color: 'var(--accent)' }}>Heute relevant</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: homeQuery.isFetching ? 'var(--amber)' : 'var(--text-3)', letterSpacing: 0, textTransform: 'uppercase' }}>
          {homeQuery.isFetching ? 'Aktualisiert' : home?.date ?? 'Live'}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
        {rows.map(row => (
          <button
            key={row.id}
            type="button"
            data-testid={`data-triage-${row.id}`}
            onClick={() => {
              if (row.targetPath) {
                navigate(row.targetPath);
                return;
              }
              onOpen(row.tab, row.hash);
            }}
            style={{
              minWidth: 44,
              minHeight: 58,
              width: '100%',
              padding: '9px 10px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${row.tone}`,
              borderRadius: 5,
              color: 'var(--text)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, color: row.tone, letterSpacing: 0, textTransform: 'uppercase' }}>
              {row.label}
            </span>
            <span style={{ display: 'block', marginTop: 4, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
              {row.value}
            </span>
            <span style={{ display: 'block', marginTop: 3, fontSize: 11, lineHeight: 1.35, color: 'var(--text-2)' }}>
              {row.detail}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function DataOverviewTab({ onOpen }: { onOpen: (tab: Tab, hash?: string) => void }) {
  const cards: Array<{ tab: Tab; hash?: string; title: string; text: string; cta: string }> = [
    {
      tab: 'analyse',
      title: 'Analyse',
      text: 'Auffälligkeiten und Planlogik gezielt öffnen, wenn du tiefer verstehen willst.',
      cta: 'Analyse öffnen',
    },
    {
      tab: 'heute',
      hash: 'data-mental',
      title: 'Mental Check-in',
      text: 'Schneller Tagesabgleich mit einfachen Zuständen und optionalen Details.',
      cta: 'Check-in öffnen',
    },
    {
      tab: 'trends',
      hash: 'data-recovery',
      title: 'Trends',
      text: 'Erholung, Schlaf und Gewicht als Verlauf prüfen, ohne einzelne Roh-Tabs zu suchen.',
      cta: 'Trends öffnen',
    },
  ];
  const provenance: Array<{ tab: Tab; hash: string; label: string; detail: string }> = [
    {
      tab: 'heute',
      hash: 'data-mental',
      label: 'Mental Check-in prüfen',
      detail: 'Subjektive Lage und Tagesnotizen.',
    },
    {
      tab: 'qualitaet',
      hash: 'data-garmin-quality',
      label: 'Garmin Abdeckung prüfen',
      detail: 'Frische, Lücken und Sync-Qualität.',
    },
    {
      tab: 'analyse',
      hash: 'data-plan-trace',
      label: 'Plan-/Load-Analyse prüfen',
      detail: 'TSB, Ziele, Risiko und Planlogik.',
    },
    {
      tab: 'analyse',
      hash: 'data-personal-response',
      label: 'Reaktionsmodell prüfen',
      detail: 'Welche Muster Pulse bei dir gerade wirklich lernen darf.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div className="label-mono" style={{ marginBottom: 3 }}>DATA · HEUTE RELEVANT</div>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Heute relevant
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
          Starte mit nutzbaren Signalen und öffne Details nur dann, wenn sie die Tagesentscheidung erklären.
        </p>
      </div>
      <EvidenceTriage onOpen={onOpen} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        {cards.map(card => (
          <div key={card.tab} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{card.title}</div>
              <p style={{ margin: '5px 0 0', color: 'var(--text-2)', fontSize: 12, lineHeight: 1.45 }}>{card.text}</p>
            </div>
            <button
              type="button"
              onClick={() => onOpen(card.tab, card.hash)}
              style={{
                alignSelf: 'flex-start',
                minWidth: 44,
                minHeight: 44,
                padding: '7px 10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                color: 'var(--accent)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: 0,
                textTransform: 'uppercase',
              }}
            >
              {card.cta}
            </button>
          </div>
        ))}
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '10px 11px', background: 'var(--surface-2)' }}>
        <div className="label-mono" style={{ marginBottom: 8, color: 'var(--accent)' }}>ENTSCHEIDUNGS-EVIDENZ</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {provenance.map(item => (
            <button
              key={item.hash}
              type="button"
              onClick={() => onOpen(item.tab, item.hash)}
              style={{
                minWidth: 44,
                minHeight: 44,
                maxWidth: '100%',
                padding: '8px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                color: 'var(--text-2)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: 0,
                textAlign: 'left',
                textTransform: 'uppercase',
              }}
              title={item.detail}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DataHeuteTab({ onOpen, focus }: { onOpen: (tab: Tab, hash?: string) => void; focus: DataFocus }) {
  if (focus === 'mental') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div className="label-mono" style={{ marginBottom: 3 }}>DATA · HEUTE RELEVANT</div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            Mental Check-in
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Subjektive Lage zuerst erfassen; Readiness, Garmin und Plan-Evidenz bleiben als Kontext erreichbar.
          </p>
        </div>
        <EvidenceSection id="data-mental"><MentalTab /></EvidenceSection>
        <EvidenceTriage onOpen={onOpen} />
      </div>
    );
  }

  return <DataOverviewTab onOpen={onOpen} />;
}

function DataTrendsTab({ focus }: { focus: DataFocus }) {
  const sections = [
    { id: 'data-recovery', key: 'recovery' as const, label: 'Erholung & Last', children: <MetrikenTab /> },
    { id: 'data-sleep', key: 'sleep' as const, label: 'Schlaf', children: <SchlafTab /> },
    { id: 'data-weight', key: 'weight' as const, label: 'Gewicht & Körper', children: <GewichtTab /> },
  ];
  const orderedSections = focus && focus !== 'mental'
    ? [...sections.filter(section => section.key === focus), ...sections.filter(section => section.key !== focus)]
    : sections;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div className="label-mono" style={{ marginBottom: 3 }}>DATA · TRENDS</div>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Trends
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
          Verlaufssignale für Erholung, Schlaf und Körperdaten. Details bleiben hier gesammelt, damit Data nicht wie sieben gleichrangige Wartungsbereiche startet.
        </p>
      </div>
      {orderedSections.map(section => (
        <EvidenceSection key={section.id} id={section.id}>
          <div className="label-mono" style={{ margin: '0 0 8px', color: 'var(--accent)' }}>{section.label}</div>
          {section.children}
        </EvidenceSection>
      ))}
    </div>
  );
}

export default function Data() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const searchKey = searchParams.toString();
  const tabParam = searchParams.get('tab');
  const tab = tabFromQuery(tabParam);
  const focus = focusFromQuery(tabParam, location.hash);

  function setTab(tabId: string, hash?: string) {
    const nextTab = tabId as Tab;
    if (!TAB_QUERY[nextTab]) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', TAB_QUERY[nextTab]);
    if (hash) {
      navigate({
        pathname: location.pathname,
        search: `?${next.toString()}`,
        hash: `#${hash}`,
      });
      return;
    }
    setSearchParams(next);
  }

  useEffect(() => {
    const hash = hashFromLocation(location.hash);
    if (!hash) return;

    const targetTab = HASH_TAB[hash];
    if (targetTab && targetTab !== tab) {
      const next = new URLSearchParams(searchKey);
      next.set('tab', TAB_QUERY[targetTab]);
      navigate({
        pathname: location.pathname,
        search: `?${next.toString()}`,
        hash: location.hash,
      }, { replace: true });
      return;
    }

    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(hash);
      if (!target) return;
      target.scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash, location.pathname, navigate, searchKey, tab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader eyebrow="DATA" title="Heute, Trends, Qualität & Analyse" />
      <SegmentedControl items={TABS} active={tab} onChange={setTab} ariaLabel="Data Bereiche" idPrefix="data" wrap />
      {tab === 'heute' && <TabPanel tab="heute"><DataHeuteTab onOpen={setTab} focus={focus} /></TabPanel>}
      {tab === 'trends' && <TabPanel tab="trends"><DataTrendsTab focus={focus} /></TabPanel>}
      {tab === 'qualitaet' && <TabPanel tab="qualitaet"><EvidenceSection id="data-garmin-quality"><CoverageTab /></EvidenceSection></TabPanel>}
      {tab === 'analyse' && <TabPanel tab="analyse"><EvidenceSection id="data-plan-trace"><DataAnalysenTab /></EvidenceSection></TabPanel>}
    </div>
  );
}
