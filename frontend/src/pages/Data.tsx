import { useSearchParams } from 'react-router-dom';
import { PageHeader, SegmentedControl } from '@/components/PulseChrome';
import { CoverageTab } from '@/features/data/coverage/coverage-components';
import { MentalTab } from '@/features/data/mental/mental-components';
import { GewichtTab, MetrikenTab, SchlafTab } from '@/features/data/recovery/recovery-components';
import { DataAnalysenTab } from '@/pages/Insights';

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

function tabFromQuery(value: string | null): Tab {
  return value ? QUERY_TAB[value] ?? 'ueberblick' : 'ueberblick';
}

function DataOverviewTab({ onOpen }: { onOpen: (tab: Tab) => void }) {
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
    </div>
  );
}

export default function Data() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromQuery(searchParams.get('tab'));

  function setTab(tabId: string) {
    const nextTab = tabId as Tab;
    const next = new URLSearchParams(searchParams);
    next.set('tab', TAB_QUERY[nextTab]);
    setSearchParams(next);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader eyebrow="DATA" title="Schlaf, Metriken, Mental & Analysen" />
      <SegmentedControl items={TABS} active={tab} onChange={setTab} />
      {tab === 'ueberblick' && <DataOverviewTab onOpen={setTab} />}
      {tab === 'abdeckung' && <CoverageTab />}
      {tab === 'schlaf' && <SchlafTab />}
      {tab === 'metriken' && <MetrikenTab />}
      {tab === 'gewicht' && <GewichtTab />}
      {tab === 'mental' && <MentalTab />}
      {tab === 'analysen' && <DataAnalysenTab />}
    </div>
  );
}
