import type { PulseMentalThemesResponse } from '@coaching-os/shared/pulse';

export interface MentalThemeRow {
  id: string;
  date: string;
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
  notes: string | null;
  themes: string[] | null;
}

const DAY_MS = 86_400_000;

function parseDay(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Date.UTC(year, month - 1, day);
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().split('T')[0]!;
}

function normalizeDay(date: string): string {
  const ms = parseDay(date);
  return Number.isNaN(ms) ? formatDay(Date.now()) : formatDay(ms);
}

function minusDays(date: string, days: number): string {
  return formatDay(parseDay(date) - days * DAY_MS);
}

function weekStart(date: string): string {
  const ms = parseDay(date);
  const day = new Date(ms).getUTCDay();
  const offset = (day + 6) % 7;
  return formatDay(ms - offset * DAY_MS);
}

function normalizeTheme(theme: string): string | null {
  const value = theme.trim().toLowerCase();
  return value.length > 0 ? value : null;
}

export function aggregateThemeRows(
  rows: MentalThemeRow[],
  anchorDate = formatDay(Date.now()),
  totalCheckins = rows.length,
): PulseMentalThemesResponse {
  const anchor = normalizeDay(anchorDate);
  const recentStart = minusDays(anchor, 13);
  const priorStart = minusDays(anchor, 43);
  const byTheme = new Map<string, MentalThemeRow[]>();

  for (const row of rows) {
    const themes = new Set((row.themes ?? [])
      .map(normalizeTheme)
      .filter((theme): theme is string => theme != null));

    for (const theme of themes) {
      const current = byTheme.get(theme) ?? [];
      current.push(row);
      byTheme.set(theme, current);
    }
  }

  const themes = Array.from(byTheme.entries())
    .map(([theme, occurrences]) => {
      const sorted = [...occurrences].sort((a, b) => a.date.localeCompare(b.date));
      const weekly = new Map<string, number>();
      for (const occurrence of sorted) {
        const key = weekStart(occurrence.date);
        weekly.set(key, (weekly.get(key) ?? 0) + 1);
      }

      const recentCount = sorted.filter((row) => row.date >= recentStart && row.date <= anchor).length;
      const priorCount = sorted.filter((row) => row.date >= priorStart && row.date < recentStart).length;

      return {
        theme,
        count: sorted.length,
        firstSeen: sorted[0]!.date,
        lastSeen: sorted.at(-1)!.date,
        weeklyFrequency: Array.from(weekly.entries())
          .map(([week, count]) => ({ weekStart: week, count }))
          .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
        isResurfacing: (recentCount / 14) > (priorCount / 30) * 1.5,
        isResolved: recentCount === 0 && priorCount >= 3,
        occurrences: sorted.map((row) => ({
          id: row.id,
          date: row.date,
          mood: row.mood,
          energy: row.energy,
          stress: row.stress,
          motivation: row.motivation,
          notes: row.notes,
        })),
      };
    })
    .filter((theme) => theme.count >= 2)
    .sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen) || a.theme.localeCompare(b.theme));

  return {
    themes,
    totalCheckins,
  };
}
