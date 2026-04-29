import { useState } from 'react';
import { usePulseWeight } from '@/pulse/hooks';
import { SparkLine } from '@/components/SparkChart';

type Metric = 'weight' | 'fat' | 'muscle';

const TABS: { id: Metric; label: string; color: string }[] = [
  { id: 'weight', label: 'Gewicht', color: 'var(--accent)' },
  { id: 'fat',    label: 'KFA',     color: 'var(--amber)'  },
  { id: 'muscle', label: 'Muskel',  color: 'var(--green)'  },
];

function fmtDelta(delta: number | null, unit: string): string {
  if (delta == null) return '';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)} ${unit}`;
}

export function BodyCompChart() {
  const [active, setActive] = useState<Metric>('weight');
  const { data, isLoading } = usePulseWeight(90);

  const entries = data?.entries ?? [];
  // entries are newest-first from the API — reverse for chronological
  const chronological = [...entries].reverse();

  if (isLoading || chronological.length < 2) return null;

  const weights  = chronological.map(e => e.weightKg);
  const fats     = chronological.map(e => e.bodyFatPct ?? null);
  const muscles  = chronological.map(e => e.muscleMassKg ?? null);

  const hasFat    = fats.some(v => v != null);
  const hasMuscle = muscles.some(v => v != null);

  // Compute 30d trend: latest vs closest entry >= 30 days ago
  const latest = chronological[chronological.length - 1];
  const cutoff = new Date(latest!.date);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const base = [...chronological].reverse().find(e => e.date <= cutoffStr);

  const deltaWeight = base != null ? latest!.weightKg - base.weightKg : null;
  const deltaFat    = (base != null && base.bodyFatPct != null && latest!.bodyFatPct != null)
    ? latest!.bodyFatPct - base.bodyFatPct : null;
  const deltaMuscle = (base != null && base.muscleMassKg != null && latest!.muscleMassKg != null)
    ? latest!.muscleMassKg - base.muscleMassKg : null;

  const captionParts: string[] = [];
  if (deltaWeight != null) captionParts.push(fmtDelta(deltaWeight, 'kg'));
  if (deltaFat    != null) captionParts.push(fmtDelta(deltaFat,    '% BF'));
  if (deltaMuscle != null) captionParts.push(fmtDelta(deltaMuscle, 'kg M'));

  const values  = active === 'weight' ? weights : active === 'fat' ? fats : muscles;
  const valid   = values.filter((v): v is number => v != null);
  const vMin    = valid.length > 0 ? Math.min(...valid) : 0;
  const vMax    = valid.length > 0 ? Math.max(...valid) : 0;

  // Only show tabs for available metrics
  const visibleTabs = TABS.filter(t => {
    if (t.id === 'fat'    && !hasFat)    return false;
    if (t.id === 'muscle' && !hasMuscle) return false;
    return true;
  });

  // If active tab has no data, reset to weight
  const displayActive = visibleTabs.find(t => t.id === active) ? active : 'weight';
  const displayValues = displayActive === 'weight' ? weights : displayActive === 'fat' ? fats : muscles;
  const displayColor  = visibleTabs.find(t => t.id === displayActive)?.color ?? 'var(--accent)';

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      {/* Header: tab selector + min/max */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{
          display: 'flex', gap: 1, padding: 2,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 4,
        }}>
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              style={{
                padding: '4px 10px',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em',
                background: displayActive === t.id ? 'var(--surface)' : 'transparent',
                color: displayActive === t.id ? t.color : 'var(--text-3)',
                borderRadius: 3, border: 'none', cursor: 'pointer',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
            max {vMax.toFixed(1)}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
            min {vMin.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Spark line */}
      <SparkLine values={displayValues} height={72} color={displayColor} fillOpacity={0.12} />

      {/* Caption */}
      {captionParts.length > 0 && (
        <div style={{
          marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--text-3)', lineHeight: 1.5,
        }}>
          30T-Trend: {captionParts.join(' · ')}
        </div>
      )}
    </div>
  );
}
