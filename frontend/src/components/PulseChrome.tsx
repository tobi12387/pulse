import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

function colorMix(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  mobileTitle?: string;
  description?: string;
  action?: ReactNode;
};

export function PageHeader({ eyebrow, title, mobileTitle, description, action }: PageHeaderProps) {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 600px)').matches : false
  ));

  useEffect(() => {
    const media = window.matchMedia('(max-width: 600px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const visibleTitle = mobileTitle && isMobile ? mobileTitle : title;

  return (
    <header className="pulse-page-header">
      <div className="pulse-page-header-copy">
        {(eyebrow || description) && (
          <div className="pulse-page-kicker">
            {eyebrow && (
              <span className="label-mono pulse-page-eyebrow">
                {eyebrow}
              </span>
            )}
            {description && (
              <span className="pulse-page-mode">
                Arbeitsfläche
              </span>
            )}
          </div>
        )}
        <h1 className="pulse-page-heading">
          {visibleTitle}
        </h1>
        {description && (
          <p className="pulse-page-description">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pulse-page-header-action" aria-label="Ansicht wechseln">{action}</div>}
    </header>
  );
}

type SegmentedControlProps = {
  items: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  compact?: boolean;
  wrap?: boolean;
  ariaLabel?: string;
  idPrefix?: string;
};

export function SegmentedControl({ items, active, onChange, compact = false, wrap = false, ariaLabel = 'Bereiche', idPrefix }: SegmentedControlProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    tabRefs.current[active]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active, wrap]);

  function focusAndChange(index: number) {
    const next = items[index];
    if (!next) return;
    onChange(next.id);
    window.requestAnimationFrame(() => tabRefs.current[next.id]?.focus());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (items.length === 0) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusAndChange((index + 1) % items.length);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusAndChange((index - 1 + items.length) % items.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusAndChange(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusAndChange(items.length - 1);
    }
  }

  return (
    <div
      className={`pulse-segmented-control ${wrap ? 'pulse-segmented-control--wrap' : ''}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item, index) => {
        const tabId = idPrefix ? `${idPrefix}-${item.id}-tab` : undefined;
        const panelId = idPrefix ? `${idPrefix}-${item.id}-panel` : undefined;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            id={tabId}
            className={`pulse-segmented-tab ${compact ? 'pulse-segmented-tab--compact' : ''} ${isActive ? 'pulse-segmented-tab--active' : ''}`}
            aria-controls={panelId}
            ref={(node) => {
              tabRefs.current[item.id] = node;
            }}
            type="button"
            role="tab"
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
          >
            {item.label}
          </button>
        );
      })}
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
    <div className="pulse-range-control">
      {options.map(option => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`pulse-range-option ${active ? 'pulse-range-option--active' : ''}`}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
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
        borderRadius: 'var(--radius-md)',
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
  ariaLabel?: string;
};

const TONE_COLOR: Record<NonNullable<MiniButtonProps['tone']>, string> = {
  neutral: 'var(--text-2)',
  accent: 'var(--accent)',
  amber: 'var(--amber)',
  danger: 'var(--rose)',
};

export function MiniButton({ children, onClick, disabled, tone = 'neutral', type = 'button', ariaLabel }: MiniButtonProps) {
  const color = TONE_COLOR[tone];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        background: 'none',
        border: `1px solid ${tone === 'neutral' ? 'var(--border)' : colorMix(color, 34)}`,
        borderRadius: 'var(--radius)',
        minWidth: 44,
        minHeight: 44,
        padding: '8px 12px',
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        fontWeight: 650,
        letterSpacing: 0,
        textTransform: 'none',
        color: disabled ? 'var(--text-3)' : color,
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}
