import { useSearchParams } from 'react-router-dom';
import { PageHeader, SegmentedControl } from '@/components/PulseChrome';
import { CoverageTab } from '@/features/data/coverage/coverage-components';
import { MentalTab } from '@/features/data/mental/mental-components';
import { GewichtTab, MetrikenTab, SchlafTab } from '@/features/data/recovery/recovery-components';

type Tab = 'abdeckung' | 'schlaf' | 'metriken' | 'gewicht' | 'mental';

const TABS = [
  { id: 'abdeckung', label: 'Abdeckung' },
  { id: 'schlaf', label: 'Schlaf' },
  { id: 'metriken', label: 'Metriken' },
  { id: 'gewicht', label: 'Gewicht' },
  { id: 'mental', label: 'Mental' },
];

const TAB_QUERY: Record<Tab, string> = {
  abdeckung: 'coverage',
  schlaf: 'sleep',
  metriken: 'metrics',
  gewicht: 'weight',
  mental: 'mental',
};

const QUERY_TAB: Record<string, Tab> = {
  coverage: 'abdeckung',
  abdeckung: 'abdeckung',
  sleep: 'schlaf',
  schlaf: 'schlaf',
  metrics: 'metriken',
  metriken: 'metriken',
  weight: 'gewicht',
  gewicht: 'gewicht',
  mental: 'mental',
};

function tabFromQuery(value: string | null): Tab {
  return value ? QUERY_TAB[value] ?? 'abdeckung' : 'abdeckung';
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
      <PageHeader eyebrow="DATA" title="Schlaf, Metriken & Mental" />
      <SegmentedControl items={TABS} active={tab} onChange={setTab} />
      {tab === 'abdeckung' && <CoverageTab />}
      {tab === 'schlaf' && <SchlafTab />}
      {tab === 'metriken' && <MetrikenTab />}
      {tab === 'gewicht' && <GewichtTab />}
      {tab === 'mental' && <MentalTab />}
    </div>
  );
}
