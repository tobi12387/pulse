import { useMemo, useState } from 'react';
import type { PulseMentalThemeSummary } from '@coaching-os/shared/pulse';
import { useMentalThemes } from '@/pulse/hooks';
import { Skeleton } from './Skeleton';

const DAY_MS = 86_400_000;
const THEME_DAYS = 90;

function parseDay(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return Date.now();
  return Date.UTC(year, month - 1, day);
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().split('T')[0]!;
}

function weekStart(date: string): string {
  const ms = parseDay(date);
  const day = new Date(ms).getUTCDay();
  const offset = (day + 6) % 7;
  return formatDay(ms - offset * DAY_MS);
}

function fmtDate(date: string): string {
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.` : date;
}

function noteSnippet(note: string | null): string {
  if (!note) return 'Keine Notiz';
  return note.length > 180 ? `${note.slice(0, 177)}...` : note;
}

function buildWeekSlots(themes: PulseMentalThemeSummary[]): string[] {
  const latest = themes.reduce((acc, theme) => theme.lastSeen > acc ? theme.lastSeen : acc, themes[0]?.lastSeen ?? formatDay(Date.now()));
  const currentWeek = weekStart(latest);
  return Array.from({ length: 13 }, (_, index) => formatDay(parseDay(currentWeek) - (12 - index) * 7 * DAY_MS));
}

function ThemeBars({ theme, weekSlots }: { theme: PulseMentalThemeSummary; weekSlots: string[] }) {
  const counts = new Map(theme.weeklyFrequency.map((week) => [week.weekStart, week.count]));
  const max = Math.max(1, ...theme.weeklyFrequency.map((week) => week.count));

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${weekSlots.length}, minmax(0, 1fr))`,
      gap: 3,
      alignItems: 'end',
      height: 24,
      minWidth: 150,
    }}>
      {weekSlots.map((week) => {
        const count = counts.get(week) ?? 0;
        return (
          <span
            key={week}
            title={`${fmtDate(week)}: ${count}`}
            style={{
              display: 'block',
              height: count > 0 ? Math.max(4, Math.round((count / max) * 22)) : 3,
              borderRadius: 2,
              background: count > 0 ? 'var(--accent)' : 'var(--surface-2)',
              opacity: theme.isResolved ? 0.35 : count > 0 ? 0.8 : 1,
            }}
          />
        );
      })}
    </div>
  );
}

function ThemeModal({ theme, onClose }: { theme: PulseMentalThemeSummary; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${theme.theme} Check-ins`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(7, 10, 18, 0.72)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: 'min(720px, 100%)',
          maxHeight: 'min(78vh, 680px)',
          overflow: 'auto',
          borderColor: 'var(--accent)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div className="label-mono" style={{ marginBottom: 5 }}>{theme.theme}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
              {theme.count} Check-ins · {fmtDate(theme.firstSeen)} bis {fmtDate(theme.lastSeen)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schliessen"
            style={{
              width: 30,
              height: 30,
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            x
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...theme.occurrences].reverse().map((occurrence) => (
            <div key={occurrence.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 5 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{occurrence.date}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
                  Mood {occurrence.mood}/10 · Energie {occurrence.energy}/10 · Stress {occurrence.stress}/10
                </span>
              </div>
              <p style={{ margin: 0, color: occurrence.notes ? 'var(--text)' : 'var(--text-3)', fontSize: 12, lineHeight: 1.5 }}>
                {noteSnippet(occurrence.notes)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ThemeTimeline() {
  const { data, isLoading, error } = useMentalThemes(THEME_DAYS);
  const [selectedTheme, setSelectedTheme] = useState<PulseMentalThemeSummary | null>(null);
  const themes = useMemo(() => data?.themes ?? [], [data?.themes]);
  const weekSlots = useMemo(() => buildWeekSlots(themes), [themes]);

  if (isLoading) {
    return (
      <div className="card">
        <div className="label-mono" style={{ marginBottom: 12 }}>Themen · 90 Tage</div>
        <Skeleton height={84} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="label-mono" style={{ marginBottom: 8 }}>Themen · 90 Tage</div>
        <p style={{ margin: 0, color: 'var(--rose)', fontSize: 12 }}>{error.message}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <span className="label-mono">Themen · 90 Tage</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          {data?.totalCheckins ?? 0} Check-ins
        </span>
      </div>

      {themes.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 12, textAlign: 'center', padding: '18px 0' }}>
          Noch keine wiederkehrenden Themen.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {themes.slice(0, 8).map((theme) => (
            <button
              key={theme.theme}
              type="button"
              onClick={() => setSelectedTheme(theme)}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(110px, 1fr) minmax(150px, 1.4fr)',
                gap: 12,
                alignItems: 'center',
                width: '100%',
                padding: '9px 0',
                border: 'none',
                borderTop: '1px solid var(--border)',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
                opacity: theme.isResolved ? 0.55 : 1,
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: 'var(--text)', overflowWrap: 'anywhere' }}>{theme.theme}</span>
                  {theme.isResurfacing && <span title="Haeuft sich aktuell" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rose)', flexShrink: 0 }} />}
                  {theme.isResolved && (
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      letterSpacing: '0.1em',
                      color: 'var(--green)',
                      textTransform: 'uppercase',
                    }}>
                      resolved
                    </span>
                  )}
                </span>
                <span style={{ display: 'block', marginTop: 3, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
                  {theme.count}x · zuletzt {fmtDate(theme.lastSeen)}
                </span>
              </span>
              <ThemeBars theme={theme} weekSlots={weekSlots} />
            </button>
          ))}
        </div>
      )}

      {selectedTheme && <ThemeModal theme={selectedTheme} onClose={() => setSelectedTheme(null)} />}
    </div>
  );
}
