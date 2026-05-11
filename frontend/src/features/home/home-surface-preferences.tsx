import { HOME_SURFACE_FOCUS_OPTIONS, type HomeSurfaceFocus } from './home-surface-preferences-model';

export function HomeSurfaceFocusCard({
  focus,
  onFocusChange,
}: {
  focus: HomeSurfaceFocus;
  onFocusChange: (focus: HomeSurfaceFocus) => void;
}) {
  return (
    <section
      data-testid="home-surface-focus-card"
      style={{
        padding: '10px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginBottom: 8 }}>
        <span className="label-mono" style={{ color: 'var(--text-3)' }}>Heute-Fokus</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>lokal</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
        {HOME_SURFACE_FOCUS_OPTIONS.map(option => {
          const active = option.value === focus;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              aria-label={`${option.label}: ${option.summary}`}
              onClick={() => onFocusChange(option.value)}
              style={{
                minHeight: 44,
                padding: '7px 5px',
                background: active ? 'rgba(94,230,207,0.14)' : 'var(--surface-2)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 5,
                color: active ? 'var(--text)' : 'var(--text-2)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, lineHeight: 1.15, overflowWrap: 'anywhere' }}>
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ margin: '7px 0 0', fontSize: 10, color: 'var(--text-3)', lineHeight: 1.35 }}>
        Lokale Reihenfolge; Hauptkarte und Warnungen bleiben fest.
      </p>
    </section>
  );
}
