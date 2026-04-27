import { SparkLine } from './SparkChart';

const DELTA_COLORS: Record<string, string> = {
  green:   'var(--green)',
  rose:    'var(--rose)',
  amber:   'var(--amber)',
  neutral: 'var(--text-3)',
};

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  delta?: string;
  deltaColor?: 'green' | 'rose' | 'amber' | 'neutral';
  spark?: (number | null)[];
  sparkColor?: string;
  accent?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  unit,
  sub,
  delta,
  deltaColor = 'neutral',
  spark,
  sparkColor,
  accent = false,
  className = '',
}: StatCardProps) {
  return (
    <div
      className={`card flex flex-col gap-2 ${className}`}
      style={{ minWidth: 0 }}
    >
      {/* Label */}
      <span className="label-mono">{label}</span>

      {/* KPI row */}
      <div className="flex items-baseline gap-1.5">
        <span
          className="kpi-display"
          style={{ color: accent ? 'var(--accent)' : 'var(--text)' }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-3)',
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {/* Sub + delta row */}
      {(sub || delta) && (
        <div className="flex items-center justify-between gap-2">
          {sub && (
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{sub}</span>
          )}
          {delta && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: DELTA_COLORS[deltaColor],
              }}
            >
              {delta}
            </span>
          )}
        </div>
      )}

      {/* Sparkline */}
      {spark && spark.length > 1 && (
        <SparkLine
          values={spark}
          height={28}
          color={sparkColor ?? (accent ? 'var(--accent)' : 'var(--text-2)')}
          fillOpacity={0.1}
        />
      )}
    </div>
  );
}
