import { RPE_BUCKETS, bucketize } from '@coaching-os/shared/pulse-thresholds';
import { colorOf } from '@/lib/thresholds';

export function RpeBar({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4, marginBottom: 7 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(v => {
          const active = value === v;
          const bucket = bucketize(v, RPE_BUCKETS);
          const color = colorOf(bucket.color);
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              title={`${bucket.label}: ${bucket.description}`}
              style={{
                aspectRatio: '1 / 1',
                minWidth: 0,
                border: `1px solid ${active ? color : 'var(--border)'}`,
                background: active ? color : 'var(--surface-2)',
                color: active ? 'var(--bg)' : 'var(--text-2)',
                borderRadius: 5,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                cursor: 'pointer',
              }}
              aria-label={`RPE ${v}`}
            >
              {v}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
        <span>locker</span>
        <span>alles geben</span>
      </div>
    </div>
  );
}
