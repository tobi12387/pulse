import { describe, expect, it, vi } from 'vitest';
import { garminApi } from './garmin-client.js';

function fakeGarminClient() {
  return {
    client: {
      get: vi.fn().mockResolvedValue({ ok: true }),
      post: vi.fn().mockResolvedValue({ workoutScheduleId: 123 }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    get: vi.fn().mockResolvedValue({ ok: true }),
  };
}

describe('garminApi raw endpoint adapter', () => {
  it('wraps workout calendar endpoints with named methods', async () => {
    const gc = fakeGarminClient();

    await garminApi.scheduleWorkout(gc, 'workout-1', '2026-05-04');
    await garminApi.getWorkout(gc, 'workout-1');
    await garminApi.deleteWorkoutSchedule(gc, 'schedule-1');
    await garminApi.deleteWorkout(gc, 'workout-1');
    await garminApi.getCalendarMonth(gc, 2026, 4);

    expect(gc.client.post).toHaveBeenCalledWith(
      'https://connectapi.garmin.com/workout-service/schedule/workout-1',
      { date: '2026-05-04' },
    );
    expect(gc.client.get).toHaveBeenCalledWith('https://connectapi.garmin.com/workout-service/workout/workout-1');
    expect(gc.client.delete).toHaveBeenCalledWith('https://connectapi.garmin.com/workout-service/schedule/schedule-1');
    expect(gc.client.delete).toHaveBeenCalledWith('https://connectapi.garmin.com/workout-service/workout/workout-1');
    expect(gc.client.get).toHaveBeenCalledWith('https://connectapi.garmin.com/calendar-service/year/2026/month/4');
  });

  it('wraps activity detail and daily summary raw reads', async () => {
    const gc = fakeGarminClient();

    await garminApi.getActivitySplits(gc, 'activity-1');
    await garminApi.getActivityHrTimeInZones(gc, 'activity-1');
    await garminApi.getDailyUserSummary(gc, 'Tobi Test', '2026-05-01');

    expect(gc.get).toHaveBeenCalledWith('https://connectapi.garmin.com/activity-service/activity/activity-1/splits');
    expect(gc.get).toHaveBeenCalledWith('https://connectapi.garmin.com/activity-service/activity/activity-1/hrTimeInZones');
    expect(gc.client.get).toHaveBeenCalledWith(
      'https://connectapi.garmin.com/usersummary-service/usersummary/daily/Tobi%20Test?calendarDate=2026-05-01',
    );
  });
});
