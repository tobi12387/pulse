import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useCoachPreferences, useUpdateCoachPreferences } from '@/pulse/hooks';
import type { PulseCoachCommunicationStyle, PulseCoachPreferences } from '@coaching-os/shared/pulse';

type SettingsMessage = { text: string; ok: boolean } | null;

const COACH_DEFAULT_PREFERENCES: PulseCoachPreferences = {
  timeWindows: '',
  dislikedWorkoutPatterns: [],
  preferredLongDays: [],
  injurySensitiveConstraints: [],
  communicationStyle: 'data_first',
  updatedAt: null,
};

const COACH_DAYS = [
  { value: 0, label: 'So' },
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Di' },
  { value: 3, label: 'Mi' },
  { value: 4, label: 'Do' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
];

const COACH_STYLE_LABELS: Record<PulseCoachCommunicationStyle, string> = {
  data_first: 'Datenorientiert',
  direct: 'Direkt',
  gentle: 'Behutsam',
};

interface CoachPreferencesForm {
  timeWindows: string;
  dislikedWorkoutPatterns: string;
  preferredLongDays: number[];
  injurySensitiveConstraints: string;
  communicationStyle: PulseCoachCommunicationStyle;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

function Val({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>{children}</span>
  );
}

function WrapVal({ children }: { children: ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--text)',
      textAlign: 'right',
      overflowWrap: 'anywhere',
      minWidth: 0,
      maxWidth: '66%',
      lineHeight: 1.35,
    }}>
      {children}
    </span>
  );
}

function Pill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      letterSpacing: '0.1em',
      border: `1px solid ${color}`,
      borderRadius: 3,
      padding: '2px 6px',
      color,
    }}>
      {children}
    </span>
  );
}

function preferenceLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function preferencesToForm(preferences: PulseCoachPreferences): CoachPreferencesForm {
  return {
    timeWindows: preferences.timeWindows,
    dislikedWorkoutPatterns: preferences.dislikedWorkoutPatterns.join('\n'),
    preferredLongDays: preferences.preferredLongDays,
    injurySensitiveConstraints: preferences.injurySensitiveConstraints.join('\n'),
    communicationStyle: preferences.communicationStyle,
  };
}

const settingsTextAreaStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  resize: 'vertical',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '7px 8px',
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  color: 'var(--text)',
  outline: 'none',
  lineHeight: 1.45,
};

export function CoachPreferencesCard({ setMessage }: {
  setMessage: (message: SettingsMessage) => void;
}) {
  const preferencesQuery = useCoachPreferences();
  const updatePreferences = useUpdateCoachPreferences();
  const preferences = preferencesQuery.data?.preferences ?? COACH_DEFAULT_PREFERENCES;
  const [form, setForm] = useState<CoachPreferencesForm | null>(null);
  const selectedDays = form?.preferredLongDays ?? [];

  function openForm() {
    setForm(preferencesToForm(preferences));
  }

  function toggleLongDay(day: number) {
    setForm(current => {
      if (!current) return current;
      const days = current.preferredLongDays.includes(day)
        ? current.preferredLongDays.filter(value => value !== day)
        : [...current.preferredLongDays, day].sort((a, b) => a - b);
      return { ...current, preferredLongDays: days };
    });
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setMessage(null);
    try {
      await updatePreferences.mutateAsync({
        timeWindows: form.timeWindows.trim(),
        dislikedWorkoutPatterns: preferenceLines(form.dislikedWorkoutPatterns),
        preferredLongDays: form.preferredLongDays,
        injurySensitiveConstraints: preferenceLines(form.injurySensitiveConstraints),
        communicationStyle: form.communicationStyle,
      });
      setForm(null);
      setMessage({ text: 'Coach-Präferenzen gespeichert.', ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Coach-Präferenzen konnten nicht gespeichert werden.', ok: false });
    }
  }

  const longDayLabels = preferences.preferredLongDays
    .map(day => COACH_DAYS.find(item => item.value === day)?.label ?? String(day))
    .join(', ');

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span className="label-mono">Coach-Präferenzen</span>
        {!form && (
          <button
            onClick={openForm}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              minWidth: 44, minHeight: 44, padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            Bearbeiten
          </button>
        )}
      </div>

      {form ? (
        <form onSubmit={(e) => void handleSave(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Zeitfenster</span>
            <textarea
              value={form.timeWindows}
              onChange={e => setForm(current => current ? { ...current, timeWindows: e.target.value } : current)}
              rows={2}
              style={settingsTextAreaStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Unbeliebte Muster</span>
            <textarea
              value={form.dislikedWorkoutPatterns}
              onChange={e => setForm(current => current ? { ...current, dislikedWorkoutPatterns: e.target.value } : current)}
              rows={3}
              style={settingsTextAreaStyle}
            />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Lange Trainingstage</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(30px, 1fr))', gap: 5 }}>
              {COACH_DAYS.map(day => {
                const active = selectedDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleLongDay(day.value)}
                    style={{
                      minHeight: 40,
                      borderRadius: 4,
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'rgba(125,211,252,0.12)' : 'var(--surface-2)',
                      color: active ? 'var(--accent)' : 'var(--text-2)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Vorsicht / Constraints</span>
            <textarea
              value={form.injurySensitiveConstraints}
              onChange={e => setForm(current => current ? { ...current, injurySensitiveConstraints: e.target.value } : current)}
              rows={3}
              style={settingsTextAreaStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Kommunikation</span>
            <select
              value={form.communicationStyle}
              onChange={e => setForm(current => current ? { ...current, communicationStyle: e.target.value as PulseCoachCommunicationStyle } : current)}
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', minHeight: 40, padding: '7px 8px',
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)',
                outline: 'none',
              }}
            >
              <option value="data_first">Datenorientiert</option>
              <option value="direct">Direkt</option>
              <option value="gentle">Behutsam</option>
            </select>
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <button
              type="submit"
              disabled={updatePreferences.isPending}
              style={{
                flex: 1, background: 'var(--surface-2)', border: '1px solid var(--accent)',
                borderRadius: 'var(--radius)', minHeight: 40, padding: '8px',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--accent)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {updatePreferences.isPending ? 'Speichern…' : 'Coach speichern'}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              style={{
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', minHeight: 40, padding: '8px 14px',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--text-3)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row label="Zeitfenster">
            <WrapVal>{preferences.timeWindows || '–'}</WrapVal>
          </Row>
          <Row label="Meiden">
            <WrapVal>{preferences.dislikedWorkoutPatterns.length ? preferences.dislikedWorkoutPatterns.join(', ') : '–'}</WrapVal>
          </Row>
          <Row label="Lange Tage">
            <Val>{longDayLabels || '–'}</Val>
          </Row>
          <Row label="Constraints">
            <WrapVal>{preferences.injurySensitiveConstraints.length ? preferences.injurySensitiveConstraints.join(', ') : '–'}</WrapVal>
          </Row>
          <Row label="Kommunikation">
            <Pill color="var(--accent)">{COACH_STYLE_LABELS[preferences.communicationStyle].toUpperCase()}</Pill>
          </Row>
          {preferences.updatedAt && (
            <Row label="Aktualisiert">
              <Val>{new Date(preferences.updatedAt).toLocaleDateString('de-DE')}</Val>
            </Row>
          )}
        </div>
      )}
    </div>
  );
}
