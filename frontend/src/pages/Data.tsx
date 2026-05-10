import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, SegmentedControl } from '@/components/PulseChrome';
import { CoverageTab } from '@/features/data/coverage/coverage-components';
import { MentalTab } from '@/features/data/mental/mental-components';
import { GewichtTab, MetrikenTab, SchlafTab } from '@/features/data/recovery/recovery-components';
import { DataAnalysenTab } from '@/pages/Insights';
import { useCheckinToday, usePulseHome } from '@/pulse/hooks';

type Tab = 'ueberblick' | 'abdeckung' | 'schlaf' | 'metriken' | 'gewicht' | 'mental' | 'analysen';

const TABS = [
  { id: 'ueberblick', label: 'Überblick' },
  { id: 'abdeckung', label: 'Abdeckung' },
  { id: 'schlaf', label: 'Schlaf' },
  { id: 'metriken', label: 'Metriken' },
  { id: 'gewicht', label: 'Gewicht' },
  { id: 'mental', label: 'Mental' },
  { id: 'analysen', label: 'Analysen' },
];

const TAB_QUERY: Record<Tab, string> = {
  ueberblick: 'overview',
  abdeckung: 'coverage',
  schlaf: 'sleep',
  metriken: 'metrics',
  gewicht: 'weight',
  mental: 'mental',
  analysen: 'analysen',
};

const QUERY_TAB: Record<string, Tab> = {
  overview: 'ueberblick',
  ueberblick: 'ueberblick',
  coverage: 'abdeckung',
  abdeckung: 'abdeckung',
  sleep: 'schlaf',
  schlaf: 'schlaf',
  metrics: 'metriken',
  metriken: 'metriken',
  weight: 'gewicht',
  gewicht: 'gewicht',
  mental: 'mental',
  analysen: 'analysen',
  analysis: 'analysen',
  insights: 'analysen',
};

const HASH_TAB: Record<string, Tab> = {
  'data-recovery': 'metriken',
  'data-mental': 'mental',
  'data-garmin-quality': 'abdeckung',
  'data-plan-trace': 'analysen',
};

function tabFromQuery(value: string | null): Tab {
  return value ? QUERY_TAB[value] ?? 'ueberblick' : 'ueberblick';
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
      tab: 'metriken',
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
      tab: 'mental',
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
      tab: 'abdeckung',
      hash: 'data-garmin-quality',
      label: 'Garmin-Frische',
      value: `${garminStatusLabel(garmin?.status)} · ${garmin?.metricsDays14 ?? '–'} Metrik-Tage`,
      detail: `${garmin?.activitiesDays14 ?? '–'} Aktivitäten in 14 Tagen; letzte Tagesdaten ${garmin?.lastMetricDate ?? 'unbekannt'}.`,
      tone: garminTone(garmin?.status),
    },
    {
      id: 'plan-load',
      tab: 'analysen',
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
  const cards: Array<{ tab: Tab; title: string; text: string; cta: string }> = [
    {
      tab: 'analysen',
      title: 'Analysen',
      text: 'Trends und Auffälligkeiten gezielt öffnen, ohne Wartungsstatus zuerst zu sehen.',
      cta: 'Analysen öffnen',
    },
    {
      tab: 'mental',
      title: 'Mental Check-in',
      text: 'Schneller Tagesabgleich mit einfachen Zuständen und optionalen Details.',
      cta: 'Check-in öffnen',
    },
    {
      tab: 'schlaf',
      title: 'Schlaf & Erholung',
      text: 'Schlaf, Metriken und Gewicht als Grundlage für Entscheidungen prüfen.',
      cta: 'Schlaf öffnen',
    },
  ];
  const provenance: Array<{ tab: Tab; hash: string; label: string; detail: string }> = [
    {
      tab: 'mental',
      hash: 'data-mental',
      label: 'Mental Check-in prüfen',
      detail: 'Subjektive Lage und Tagesnotizen.',
    },
    {
      tab: 'abdeckung',
      hash: 'data-garmin-quality',
      label: 'Garmin Abdeckung prüfen',
      detail: 'Frische, Lücken und Sync-Qualität.',
    },
    {
      tab: 'analysen',
      hash: 'data-plan-trace',
      label: 'Plan-/Load-Analyse prüfen',
      detail: 'TSB, Ziele, Risiko und Planlogik.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div className="label-mono" style={{ marginBottom: 3 }}>DATA · ÜBERBLICK</div>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Datenüberblick
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
          Starte mit nutzbaren Signalen und wechsle nur bei Bedarf zur Abdeckung.
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
              onClick={() => onOpen(card.tab)}
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

export default function Data() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const searchKey = searchParams.toString();
  const tab = tabFromQuery(searchParams.get('tab'));

  function setTab(tabId: string, hash?: string) {
    const nextTab = tabId as Tab;
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
      <PageHeader eyebrow="DATA" title="Schlaf, Metriken, Mental & Analysen" />
      <SegmentedControl items={TABS} active={tab} onChange={setTab} ariaLabel="Data Bereiche" idPrefix="data" wrap />
      {tab === 'ueberblick' && <TabPanel tab="ueberblick"><DataOverviewTab onOpen={setTab} /></TabPanel>}
      {tab === 'abdeckung' && <TabPanel tab="abdeckung"><EvidenceSection id="data-garmin-quality"><CoverageTab /></EvidenceSection></TabPanel>}
      {tab === 'schlaf' && <TabPanel tab="schlaf"><SchlafTab /></TabPanel>}
      {tab === 'metriken' && <TabPanel tab="metriken"><EvidenceSection id="data-recovery"><MetrikenTab /></EvidenceSection></TabPanel>}
      {tab === 'gewicht' && <TabPanel tab="gewicht"><GewichtTab /></TabPanel>}
      {tab === 'mental' && <TabPanel tab="mental"><EvidenceSection id="data-mental"><MentalTab /></EvidenceSection></TabPanel>}
      {tab === 'analysen' && <TabPanel tab="analysen"><EvidenceSection id="data-plan-trace"><DataAnalysenTab /></EvidenceSection></TabPanel>}
    </div>
  );
}
