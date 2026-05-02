// Mock-Daten in der Form, in der die Pulse-Hooks sie liefern.
// (Schemen aus frontend/src/pages/Home.tsx, Coach.tsx, Data.tsx, Plan.tsx)

const PULSE_DATA = {
  date: 'Mo · 26. Apr 2026',
  user: { name: 'Tobi', initial: 'T' },
  readiness: { score: 78, label: 'good' },
  prognosis: {
    alert: true,
    message: 'Form ist gut, HRV stabil — heute eignet sich für die Schwellen-Einheit. Achte morgen auf längere Regeneration.',
    factors: ['HRV balanced', 'Body Battery 86%', 'TSB +4', 'Schlaf 7.6h'],
  },
  briefing: {
    briefing_text: 'Guten Morgen Tobi. Du bist erholt — Schlaf war tief, HRV im grünen Bereich. Plan: 70 min Z3 mit 3×8\' an der Schwelle. Hydratation im Blick behalten, gestern lag sie unter Soll.',
  },
  fitnessLoad: { ctl: 64, atl: 60, tsb: 4 },
  todayMetrics: {
    sleepHours: 7.6, sleepScore: 84,
    hrvRmssd: 58, hrvStatus: 'balanced',
    bodyBatteryMax: 86, bodyBatteryMin: 22,
    steps: 8420,
    restingHr: 48,
  },
  nextWorkout: {
    plannedDate: 'Heute · 17:30',
    activityType: 'Laufen', zone: 3, durationMin: 70,
    description: 'Schwelle: 15\' Ein, 3×8\' @ Z4 mit 3\' Trab, 10\' Aus',
  },
  recentActivities: [
    { id: 1, name: 'Sa Long Run', activityType: 'Laufen', durationSec: 5400, distanceM: 16800, tss: 92, avgHr: 142 },
    { id: 2, name: 'Fr Krafttraining', activityType: 'Strength', durationSec: 3000, distanceM: null, tss: 38, avgHr: 118 },
    { id: 3, name: 'Do Recovery', activityType: 'Laufen', durationSec: 2400, distanceM: 7100, tss: 28, avgHr: 128 },
  ],
  // 14 Tage CTL/ATL/TSB für Sparklines
  loadHistory: [
    { ctl: 58, atl: 55, tsb:  3 }, { ctl: 59, atl: 62, tsb: -3 },
    { ctl: 60, atl: 64, tsb: -4 }, { ctl: 60, atl: 58, tsb:  2 },
    { ctl: 61, atl: 56, tsb:  5 }, { ctl: 61, atl: 68, tsb: -7 },
    { ctl: 62, atl: 71, tsb: -9 }, { ctl: 62, atl: 64, tsb: -2 },
    { ctl: 63, atl: 60, tsb:  3 }, { ctl: 63, atl: 58, tsb:  5 },
    { ctl: 63, atl: 67, tsb: -4 }, { ctl: 64, atl: 65, tsb: -1 },
    { ctl: 64, atl: 61, tsb:  3 }, { ctl: 64, atl: 60, tsb:  4 },
  ],
  // 7 Tage HRV
  hrvHistory: [54, 51, 56, 49, 55, 58, 58],
  sleepHistory: [
    { date: 'So', durationH: 7.6, deepSleepH: 1.4, remSleepH: 1.7, lightSleepH: 4.2, awakeH: 0.3, sleepScore: 84 },
    { date: 'Sa', durationH: 8.1, deepSleepH: 1.6, remSleepH: 1.9, lightSleepH: 4.3, awakeH: 0.3, sleepScore: 88 },
    { date: 'Fr', durationH: 6.9, deepSleepH: 1.1, remSleepH: 1.3, lightSleepH: 4.1, awakeH: 0.4, sleepScore: 72 },
    { date: 'Do', durationH: 7.2, deepSleepH: 1.3, remSleepH: 1.5, lightSleepH: 4.0, awakeH: 0.4, sleepScore: 78 },
    { date: 'Mi', durationH: 7.8, deepSleepH: 1.5, remSleepH: 1.7, lightSleepH: 4.3, awakeH: 0.3, sleepScore: 82 },
  ],
  checkin: { mood: 7, energy: 8, stress: 3, motivation: 8, themes: ['fokus', 'lauftraining'] },
  goals: [
    { id: 1, title: 'Halbmarathon < 1:30', description: 'Berlin Halbmarathon', targetDate: '2026-09-14', progress: 0.62, status: 'active' },
    { id: 2, title: 'Schlafhygiene', description: '8h Ø über 30 Tage', targetDate: '2026-05-30', progress: 0.84, status: 'active' },
    { id: 3, title: 'FTP +20W', description: 'Schwellenleistung steigern', targetDate: '2026-07-01', progress: 0.41, status: 'active' },
  ],
  chatHistory: [
    { id: 1, role: 'user', content: 'Wie war meine Woche?' },
    { id: 2, role: 'assistant', content: 'Solide Woche — 4 Einheiten, TSS 268. CTL +1, du baust Form auf. HRV stabil bei 56ms Ø. Einziger Punkt: Freitag warst du knapp am Kipp-Punkt (TSB −9). Heute frisch genug für Schwelle.' },
    { id: 3, role: 'user', content: 'Soll ich morgen noch ein Intervall einbauen?' },
    { id: 4, role: 'assistant', content: 'Eher nicht. Nach heute brauchst du 36–48h Regeneration. Morgen Z2-Lauf 50 min, Mittwoch dann das nächste Quality-Workout.' },
  ],
};

window.PULSE_DATA = PULSE_DATA;
