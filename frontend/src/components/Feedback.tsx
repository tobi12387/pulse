type Tone = 'error' | 'warning' | 'info';

const TONE_STYLES: Record<Tone, { color: string; background: string; border: string }> = {
  error: {
    color: 'var(--rose)',
    background: 'rgba(248, 113, 113, 0.08)',
    border: 'rgba(248, 113, 113, 0.32)',
  },
  warning: {
    color: 'var(--amber)',
    background: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.32)',
  },
  info: {
    color: 'var(--accent)',
    background: 'rgba(94, 230, 207, 0.07)',
    border: 'rgba(94, 230, 207, 0.28)',
  },
};

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

export function InlineFeedback({
  title,
  message,
  tone = 'error',
  actionLabel,
  onAction,
  actionPending = false,
}: {
  title: string;
  message: string;
  tone?: Tone;
  actionLabel?: string;
  onAction?: () => void;
  actionPending?: boolean;
}) {
  const colors = TONE_STYLES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        padding: '10px 12px',
        background: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: colors.color, letterSpacing: 0, textTransform: 'uppercase', marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>
          {message}
        </div>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          disabled={actionPending}
          style={{
            flexShrink: 0,
            minHeight: 40,
            padding: '7px 10px',
            background: 'transparent',
            border: `1px solid ${colors.border}`,
            borderRadius: 4,
            color: actionPending ? 'var(--text-3)' : colors.color,
            cursor: actionPending ? 'default' : 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: 0,
            textTransform: 'uppercase',
          }}
        >
          {actionPending ? 'Läuft…' : actionLabel}
        </button>
      )}
    </div>
  );
}
