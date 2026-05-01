import { sql } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { aggregateThemeRows, type MentalThemeRow } from './mental-theme-aggregate.js';

const DAY_MS = 86_400_000;

function dateDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString().split('T')[0]!;
}

export async function listMentalThemes(userId: string, days: number) {
  const since = dateDaysAgo(days);
  const today = new Date().toISOString().split('T')[0]!;

  const totalResult = await db.execute(sql`
    SELECT count(*)::int AS count
    FROM pulse_mental_checkins
    WHERE user_id = ${userId} AND date >= ${since}::date
  `);
  const totalRows = (totalResult as unknown as { rows: Array<{ count: number }> }).rows;
  const totalCheckins = Number(totalRows[0]?.count ?? 0);

  const result = await db.execute(sql`
    WITH t AS (
      SELECT DISTINCT
        lower(trim(raw.raw_theme)) AS theme,
        c.id,
        c.date::text AS date,
        c.mood,
        c.energy,
        c.stress,
        c.motivation,
        c.notes
      FROM pulse_mental_checkins c
      CROSS JOIN LATERAL unnest(c.themes) AS raw(raw_theme)
      WHERE c.user_id = ${userId}
        AND c.date >= ${since}::date
        AND trim(raw.raw_theme) <> ''
    ),
    recurring AS (
      SELECT theme
      FROM t
      GROUP BY theme
      HAVING count(*) >= 2
    )
    SELECT t.*
    FROM t
    JOIN recurring r ON r.theme = t.theme
    ORDER BY t.date ASC, t.theme ASC
  `);

  const rows = (result as unknown as {
    rows: Array<Omit<MentalThemeRow, 'themes'> & { theme: string }>;
  }).rows.map((row) => ({
    id: row.id,
    date: row.date,
    mood: row.mood,
    energy: row.energy,
    stress: row.stress,
    motivation: row.motivation,
    notes: row.notes,
    themes: [row.theme],
  }));

  return aggregateThemeRows(rows, today, totalCheckins);
}
