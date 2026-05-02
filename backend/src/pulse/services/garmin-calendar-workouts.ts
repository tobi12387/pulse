import { garminApi } from '../../lib/garmin-client.js';

export type GarminCalendarWorkout = {
  id: string;
  workoutId: string;
  date: string;
};

// Garmin calendar-service uses 0-indexed months.
export async function fetchGarminCalendarWorkouts(
  gc: Parameters<typeof garminApi.getCalendarMonth>[0],
  today: string,
): Promise<GarminCalendarWorkout[]> {
  const result: GarminCalendarWorkout[] = [];
  const now = new Date();

  for (let offset = 0; offset < 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    try {
      const cal = await garminApi.getCalendarMonth(gc, year, month) as { calendarItems?: Array<Record<string, unknown>> } | null;
      const items = cal?.calendarItems ?? [];
      for (const item of items) {
        if (item.itemType !== 'workout') continue;
        if (!item.workoutId) continue;
        const date = typeof item.date === 'string' ? item.date : '';
        if (date < today) continue;
        result.push({ id: String(item.id), workoutId: String(item.workoutId), date });
      }
    } catch {
      // Non-fatal: one missing calendar month should not block sync cleanup.
    }
  }

  return result;
}
