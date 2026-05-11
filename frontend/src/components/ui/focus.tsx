import type { CSSProperties, ReactNode } from 'react';

type FCardProps = {
  eyebrow?: ReactNode;
  right?: ReactNode;
  pad?: string;
  children: ReactNode;
  testId?: string;
  style?: CSSProperties;
};

export function FCard({ eyebrow, right, pad = '14px 16px', children, testId, style }: FCardProps) {
  return (
    <section
      data-testid={testId}
      style={{
        padding: pad,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        ...style,
      }}
    >
      {(eyebrow || right) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
          {eyebrow && (
            <span className="label-mono" style={{ fontSize: 10 }}>
              {eyebrow}
            </span>
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

type FButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  ariaLabel?: string;
};

export function FButton({ children, onClick, variant = 'secondary', disabled, ariaLabel }: FButtonProps) {
  const primary = variant === 'primary';
  const ghost = variant === 'ghost';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        minHeight: 44,
        padding: '12px 18px',
        background: primary ? 'var(--accent)' : 'transparent',
        color: primary ? 'var(--bg)' : 'var(--text-2)',
        border: primary ? 'none' : `1px ${ghost ? 'dashed' : 'solid'} ${ghost ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

type FPillProps = {
  children: ReactNode;
  tone?: 'accent' | 'green' | 'amber' | 'rose' | 'muted';
  filled?: boolean;
};

const TONE_VAR = {
  accent: 'var(--accent)',
  green: 'var(--green)',
  amber: 'var(--amber)',
  rose: 'var(--rose)',
  muted: 'var(--text-3)',
} as const;

export function FPill({ children, tone = 'muted', filled = false }: FPillProps) {
  const color = TONE_VAR[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 18,
        padding: '2px 7px',
        border: filled ? 'none' : `1px solid ${color}`,
        borderRadius: 3,
        background: filled ? (tone === 'accent' ? 'var(--accent-dim)' : `color-mix(in srgb, ${color} 16%, transparent)`) : 'transparent',
        color,
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function StageStrip({ active }: { active: 'DECIDE' | 'EXECUTE' | 'REVIEW' }) {
  const stages = ['DECIDE', 'EXECUTE', 'REVIEW'] as const;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderBottom: '1px solid var(--border)' }}>
      {stages.map((stage, index) => {
        const isActive = stage === active;
        return (
          <div
            key={stage}
            style={{
              minHeight: 38,
              padding: '10px 14px',
              borderRight: index < stages.length - 1 ? '1px solid var(--border)' : 'none',
              background: isActive ? 'var(--surface-2)' : 'transparent',
              color: isActive ? 'var(--accent)' : index < stages.indexOf(active) ? 'var(--text-2)' : 'var(--text-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em' }}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em' }}>
              {stage}
            </span>
            {isActive && (
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em' }}>
                ● JETZT
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const ZONE_COLORS: Record<number, string> = {
  0: 'var(--text-3)',
  1: '#3F4854',
  2: 'var(--blue)',
  3: 'var(--green)',
  4: 'var(--amber)',
  5: 'var(--rose)',
};

const ZONE_HEIGHTS: Record<number, number> = {
  0: 8,
  1: 12,
  2: 22,
  3: 30,
  4: 42,
  5: 50,
};

export function WorkoutProfileBars({ profile }: { profile: { z: number; minutes: number }[] }) {
  const segments = profile.length > 0 ? profile : [{ z: 0, minutes: 1 }];

  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 50 }}>
      {segments.map((segment, index) => (
        <div
          key={`${segment.z}-${segment.minutes}-${index}`}
          style={{
            flex: Math.max(segment.minutes, 1),
            height: ZONE_HEIGHTS[segment.z] ?? 18,
            background: ZONE_COLORS[segment.z] ?? 'var(--text-3)',
            minWidth: 2,
          }}
        />
      ))}
    </div>
  );
}
