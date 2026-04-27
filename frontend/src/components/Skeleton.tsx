interface SkeletonProps {
  height?: number | string;
  width?: number | string;
  className?: string;
}

export function Skeleton({ height = 16, width = '100%', className = '' }: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        height,
        width,
        background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)',
        backgroundSize: '200% 100%',
        borderRadius: 'var(--radius)',
        animation: 'shimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Skeleton height={10} width="40%" />
      <Skeleton height={28} width="60%" />
      {rows > 2 && <Skeleton height={28} />}
      {rows > 3 && <Skeleton height={28} />}
    </div>
  );
}

export function StatGridSkeleton({ cols = 3 }: { cols?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
      {Array.from({ length: cols }).map((_, i) => (
        <CardSkeleton key={i} rows={2} />
      ))}
    </div>
  );
}
