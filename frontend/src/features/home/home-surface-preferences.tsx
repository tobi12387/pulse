import { useCallback, useState } from 'react';

export type HomeSurfaceFocus = 'balanced' | 'training' | 'mental' | 'review';

export type HomeFocusSlot =
  | 'delta'
  | 'todayOptions'
  | 'adaptation'
  | 'mental'
  | 'action'
  | 'history'
  | 'learning'
  | 'followUps';

export const HOME_SURFACE_STORAGE_KEY = 'pulse.home.surface.focus.v1';

export const HOME_SURFACE_ORDER: Record<HomeSurfaceFocus, HomeFocusSlot[]> = {
  balanced: ['delta', 'todayOptions', 'adaptation', 'mental', 'action', 'history', 'learning', 'followUps'],
  training: ['todayOptions', 'adaptation', 'action', 'delta', 'learning', 'followUps', 'mental', 'history'],
  mental: ['mental', 'todayOptions', 'action', 'delta', 'adaptation', 'learning', 'history', 'followUps'],
  review: ['delta', 'learning', 'history', 'adaptation', 'todayOptions', 'mental', 'action', 'followUps'],
};

const HOME_SURFACE_FOCUS_OPTIONS: Array<{
  value: HomeSurfaceFocus;
  label: string;
  summary: string;
}> = [
  { value: 'balanced', label: 'Standard', summary: 'Pulse-Reihenfolge' },
  { value: 'training', label: 'Training', summary: 'Optionen zuerst' },
  { value: 'mental', label: 'Mental', summary: 'Check-in zuerst' },
  { value: 'review', label: 'Rueckblick', summary: 'Gelerntes zuerst' },
];

function parseFocus(value: string | null): HomeSurfaceFocus {
  if (value === 'training' || value === 'mental' || value === 'review') return value;
  return 'balanced';
}

function readStoredFocus(): HomeSurfaceFocus {
  if (typeof window === 'undefined') return 'balanced';
  return parseFocus(window.localStorage.getItem(HOME_SURFACE_STORAGE_KEY));
}

export function useHomeSurfaceFocus() {
  const [focus, setFocusState] = useState<HomeSurfaceFocus>(readStoredFocus);

  const setFocus = useCallback((nextFocus: HomeSurfaceFocus) => {
    setFocusState(nextFocus);
    if (typeof window === 'undefined') return;
    if (nextFocus === 'balanced') {
      window.localStorage.removeItem(HOME_SURFACE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(HOME_SURFACE_STORAGE_KEY, nextFocus);
  }, []);

  const resetFocus = useCallback(() => {
    setFocusState('balanced');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(HOME_SURFACE_STORAGE_KEY);
    }
  }, []);

  return {
    focus,
    order: HOME_SURFACE_ORDER[focus],
    setFocus,
    resetFocus,
  };
}

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
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>Dieses Geraet</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
        {HOME_SURFACE_FOCUS_OPTIONS.map(option => {
          const active = option.value === focus;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onFocusChange(option.value)}
              style={{
                minHeight: 48,
                padding: '7px 6px',
                background: active ? 'rgba(94,230,207,0.14)' : 'var(--surface-2)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 5,
                color: active ? 'var(--text)' : 'var(--text-2)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, lineHeight: 1.15 }}>
                {option.label}
              </span>
              <span style={{ display: 'block', marginTop: 3, fontSize: 9.5, color: 'var(--text-3)', lineHeight: 1.2 }}>
                {option.summary}
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.45 }}>
        Sortiert nur diese Home-Fokuskarten auf diesem Geraet. Hauptkarte und Warnungen bleiben fest.
      </p>
    </section>
  );
}
