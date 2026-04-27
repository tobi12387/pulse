interface SparkLineProps {
  values: (number | null)[];
  height?: number;
  color?: string;
  fillOpacity?: number;
  className?: string;
}

export function SparkLine({
  values,
  height = 32,
  color = 'currentColor',
  fillOpacity = 0.12,
  className = '',
}: SparkLineProps) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return <div style={{ height }} className={`bg-muted rounded ${className}`} />;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const pad = 2;
  const W = 100; // viewBox units — SVG scales to container width
  const H = height - pad * 2;

  const pts: [number, number][] = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = v === null ? -1 : pad + H - ((v - min) / range) * H;
    return [x, y];
  });

  const vis = pts.filter(([, y]) => y >= 0);
  const line = vis.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const first = vis[0];
  const last  = vis[vis.length - 1];
  const area  = first && last
    ? `${line} L${last[0].toFixed(1)},${(pad + H).toFixed(1)} L${first[0].toFixed(1)},${(pad + H).toFixed(1)} Z`
    : '';

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className={className}
    >
      {area && <path d={area} fill={color} fillOpacity={fillOpacity} stroke="none" />}
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {last && <circle cx={last[0]} cy={last[1]} r={2} fill={color} />}
    </svg>
  );
}

interface SparkBarProps {
  values: (number | null)[];
  height?: number;
  color?: string;
  className?: string;
}

export function SparkBar({ values, height = 40, color = 'currentColor', className = '' }: SparkBarProps) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return <div style={{ height }} className={`bg-muted rounded ${className}`} />;

  const min = 0;
  const max = Math.max(...valid, 0.1);
  const W   = 100;
  const H   = height - 2;
  const bw  = (W / values.length) * 0.7;

  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" width="100%" height={height} className={className}>
      {values.map((v, i) => {
        if (v === null || v <= 0) return null;
        const x  = (i / values.length) * W + (W / values.length) * 0.15;
        const bh = ((v - min) / (max - min)) * H;
        return <rect key={i} x={x} y={H - bh + 1} width={bw} height={bh} fill={color} rx={1} />;
      })}
    </svg>
  );
}
