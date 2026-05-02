import { useState } from 'react';
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

export default function Data() {
  const [tab, setTab] = useState<Tab>('abdeckung');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader eyebrow="DATA" title="Schlaf, Metriken & Mental" />
      <SegmentedControl items={TABS} active={tab} onChange={id => setTab(id as Tab)} />
      {tab === 'abdeckung' && <CoverageTab />}
      {tab === 'schlaf' && <SchlafTab />}
      {tab === 'metriken' && <MetrikenTab />}
      {tab === 'gewicht' && <GewichtTab />}
      {tab === 'mental' && <MentalTab />}
    </div>
  );
}
