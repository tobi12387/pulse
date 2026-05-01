import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

function colorMix(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div className="label-mono" style={{ marginBottom: 3 }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', margin: 0 }}>
          {title}
        </h1>
        {description && (
          <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5, maxWidth: 560 }}>
            {description}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 1, minWidth: 0, maxWidth: '100%' }}>{action}</div>}
    </div>
  );
}

type SegmentedControlProps = {
  items: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  compact?: boolean;
};

export function SegmentedControl({ items, active, onChange, compact = false }: SegmentedControlProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        padding: 2,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 5,
        alignSelf: 'flex-start',
        maxWidth: '100%',
      }}
    >
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          aria-pressed={active === item.id}
          style={{
            flex: '0 0 auto',
            padding: compact ? '4px 8px' : '6px 8px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: 0,
            background: active === item.id ? 'var(--surface-2)' : 'transparent',
            color: active === item.id ? 'var(--accent)' : 'var(--text-2)',
            borderRadius: 3,
            textTransform: 'uppercase',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.12s, color 0.12s',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

type RangeControlProps = {
  value: number;
  onChange: (value: number) => void;
  options: { value: number; label: string }[];
};

export function RangeControl({ value, onChange, options }: RangeControlProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: '100%' }}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            padding: '4px 10px',
            borderRadius: 4,
            letterSpacing: 0,
            background: value === option.value ? 'var(--surface-2)' : 'transparent',
            color: value === option.value ? 'var(--text)' : 'var(--text-3)',
            border: '1px solid ' + (value === option.value ? 'var(--border)' : 'transparent'),
            cursor: 'pointer',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type IconBadgeProps = {
  icon: LucideIcon;
  color: string;
  label?: string;
};

export function IconBadge({ icon: Icon, color, label }: IconBadgeProps) {
  return (
    <span
      aria-label={label}
      style={{
        width: 24,
        height: 24,
        borderRadius: 'var(--radius)',
        border: `1px solid ${colorMix(color, 34)}`,
        background: colorMix(color, 8),
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}

type MiniButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'accent' | 'amber' | 'danger';
  type?: 'button' | 'submit';
};

const TONE_COLOR: Record<NonNullable<MiniButtonProps['tone']>, string> = {
  neutral: 'var(--text-2)',
  accent: 'var(--accent)',
  amber: 'var(--amber)',
  danger: 'var(--rose)',
};

export function MiniButton({ children, onClick, disabled, tone = 'neutral', type = 'button' }: MiniButtonProps) {
  const color = TONE_COLOR[tone];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'none',
        border: `1px solid ${tone === 'neutral' ? 'var(--border)' : colorMix(color, 34)}`,
        borderRadius: 'var(--radius)',
        padding: '3px 10px',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: 0,
        textTransform: 'uppercase',
        color: disabled ? 'var(--text-3)' : color,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
