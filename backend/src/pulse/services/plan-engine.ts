import { llmComplete, SMART_MODEL } from '../../lib/llm.js';

type Phase = 'base' | 'build' | 'peak' | 'taper';
type ActivityType = 'run' | 'bike' | 'swim' | 'strength';

interface WeekWorkout {
  plannedDate: string;
  activityType: ActivityType;
  zone: number;
  durationMin: number;
  targetTss: number;
  description: string;
}

// ─── TSS / intensity helpers ──────────────────────────────────────────────────

// Intensity Factor per zone (fraction of FTP-equivalent effort)
const IF_BY_ZONE: Record<number, number> = {
  1: 0.55,
  2: 0.70,
  3: 0.82,
  4: 0.93,
  5: 1.08,
};

function tssFromWorkout(durationMin: number, zone: number): number {
  const ef = IF_BY_ZONE[zone] ?? 0.70;
  return Math.round((durationMin / 60) * ef * ef * 100);
}

// ─── Mesocycle position ───────────────────────────────────────────────────────

// 3+1 periodization: weeks 1-3 progressive load, week 4 recovery
function getMesocycleWeek(weekStart: string): 1 | 2 | 3 | 4 {
  const d = new Date(weekStart + 'T00:00:00Z');
  // ISO week number (1-53)
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const dayOfYear = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86_400_000);
  const weekNum = Math.ceil((dayOfYear + jan4.getUTCDay()) / 7);
  return (((weekNum - 1) % 4) + 1) as 1 | 2 | 3 | 4;
}

// ─── Weekly TSS target ────────────────────────────────────────────────────────

function computeWeeklyTssTarget(params: {
  ctl: number;
  tsb: number;
  weeklyHoursTarget: number;
  mesocycleWeek: 1 | 2 | 3 | 4;
  phase: Phase;
}): number {
  const { ctl, tsb, weeklyHoursTarget, mesocycleWeek, phase } = params;

  // Base: maintain current CTL (CTL * 7 = approximate weekly TSS to stay flat)
  const baseTss = Math.max(120, ctl * 7);

  // 3+1 mesocycle progression multipliers
  const mesoMult = (mesocycleWeek === 4)
    ? 0.65                                               // recovery week
    : ([1.00, 1.08, 1.16] as number[])[mesocycleWeek - 1] ?? 1.00; // progressive build

  // Phase modifier: taper = sharp reduction, peak = slight boost
  const phaseMult = { base: 1.00, build: 1.05, peak: 1.10, taper: 0.55 }[phase] ?? 1.00;

  // Fatigue gate: protect athlete when TSB is very negative
  const tsbMult = tsb < -25 ? 0.70 : tsb < -15 ? 0.85 : 1.00;

  // Ceiling: what's actually achievable in the available hours
  // Mixed training yields ~55-70 TSS/hour; use 63 as a realistic mean
  const hoursCap = weeklyHoursTarget * 63;

  const target = Math.round(baseTss * mesoMult * phaseMult * tsbMult);
  return Math.min(hoursCap, Math.max(80, Math.min(900, target)));
}

// ─── Sport rotation by phase ──────────────────────────────────────────────────

// Ordered template: for N available days, take the first N entries
const SPORT_ROTATION: Record<Phase, ActivityType[]> = {
  //         Primary sport (bike=aerobic base), quality run, strength, long run/ride...
  base:  ['bike', 'run',      'bike', 'strength', 'run',      'bike', 'run'],
  build: ['run',  'bike',     'run',  'bike',      'strength', 'run',  'bike'],
  peak:  ['run',  'bike',     'run',  'run',       'bike',     'run',  'bike'],
  taper: ['run',  'bike',     'run',  'bike',      'run',      'bike', 'run'],
};

// Base session duration (min) per sport per zone — used as sanity-check floor/ceiling
const BASE_DURATION: Record<ActivityType, Record<number, number>> = {
  run:      { 1: 40, 2: 60,  3: 65,  4: 55,  5: 45 },
  bike:     { 1: 70, 2: 100, 3: 90,  4: 75,  5: 60 },
  swim:     { 1: 45, 2: 55,  3: 50,  4: 45,  5: 40 },
  strength: { 1: 50, 2: 50,  3: 50,  4: 45,  5: 45 },
};

// ─── Hard-day selector ────────────────────────────────────────────────────────

// Polarized: ~20% of sessions are Z4-5, rest Z2.
// Rules: no hard day first session of the week, no consecutive hard days.
function selectHardDays(sortedDays: number[], hardCount: number): Set<number> {
  if (hardCount === 0) return new Set();

  const result = new Set<number>();
  // Skip the very first day (recovery from prior week)
  const candidates = sortedDays.slice(1);

  for (const day of candidates) {
    if (result.size >= hardCount) break;
    // Ensure at least 1 easy day between hard sessions
    const lastHard = [...result].at(-1) ?? -99;
    if (day - lastHard > 1) result.add(day);
  }

  // If we couldn't find enough, relax the gap constraint
  if (result.size < hardCount && candidates.length > 0) {
    for (const day of candidates) {
      if (result.size >= hardCount) break;
      result.add(day);
    }
  }

  return result;
}

// ─── Polarized week builder ───────────────────────────────────────────────────

function buildPolarizedWorkouts(params: {
  weekStart: string;
  availableDays: number[];
  phase: Phase;
  weeklyTss: number;
  weeklyHoursTarget: number;
  tsb: number;
}): WeekWorkout[] {
  const { weekStart, availableDays, phase, weeklyTss, weeklyHoursTarget, tsb } = params;
  const sorted = [...availableDays].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return [];

  // 80/20 polarization: ~22% of sessions are hard (Z4-5), 0 if very fatigued
  const hardCount = tsb < -20 ? 0 : Math.min(2, Math.max(1, Math.round(n * 0.22)));
  const hardDays = selectHardDays(sorted, hardCount);

  const rotation = SPORT_ROTATION[phase];
  const startDate = new Date(weekStart + 'T00:00:00Z');
  const workouts: WeekWorkout[] = [];
  let tssLeft = weeklyTss;

  for (let i = 0; i < n; i++) {
    const dayOffset = sorted[i]!;
    const remaining = n - i;
    const isHard = hardDays.has(dayOffset);

    // Zone: Z4 in base/build, Z5 for peak quality sessions, Z2 for easy days
    const zone = isHard
      ? (phase === 'peak' ? 5 : 4)
      : 2;

    const activityType = rotation[i % rotation.length]!;
    const ef = IF_BY_ZONE[zone] ?? 0.70;

    // Derive duration from TSS budget share
    const tssShare = Math.round(tssLeft / remaining);
    const derivedMin = Math.round((tssShare / (ef * ef * 100)) * 60);

    // Cross-check bounds
    const baseDur = BASE_DURATION[activityType]?.[zone] ?? 60;
    const maxMinPerDay = Math.round((weeklyHoursTarget * 60) / remaining * 1.4);

    const durationMin = Math.max(
      20,
      Math.min(
        180,
        Math.min(maxMinPerDay, isHard ? derivedMin : Math.max(derivedMin, Math.round(baseDur * 0.8))),
      ),
    );

    const tss = tssFromWorkout(durationMin, zone);
    tssLeft -= tss;

    const plannedDate = new Date(startDate);
    plannedDate.setUTCDate(startDate.getUTCDate() + dayOffset);

    workouts.push({
      plannedDate: plannedDate.toISOString().split('T')[0]!,
      activityType,
      zone,
      durationMin,
      targetTss: tss,
      description: '',
    });
  }

  return workouts;
}

// ─── History aggregation ──────────────────────────────────────────────────────

interface WeekSummary {
  weekStart: string;
  totalTss: number;
  totalHours: number;
  sports: Partial<Record<string, { sessions: number; tss: number }>>;
}

function aggregateHistory(activities: Array<{
  date: string;
  activityType: string;
  durationMin: number;
  tss: number;
}>): WeekSummary[] {
  const map = new Map<string, WeekSummary>();

  for (const act of activities) {
    const d = new Date(act.date + 'T00:00:00Z');
    const dow = d.getUTCDay(); // 0=Sun
    const offset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + offset);
    const key = monday.toISOString().split('T')[0]!;

    if (!map.has(key)) map.set(key, { weekStart: key, totalTss: 0, totalHours: 0, sports: {} });
    const w = map.get(key)!;
    w.totalTss += act.tss;
    w.totalHours += act.durationMin / 60;
    const s = w.sports[act.activityType] ?? { sessions: 0, tss: 0 };
    s.sessions++;
    s.tss += act.tss;
    w.sports[act.activityType] = s;
  }

  return [...map.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// ─── LLM description enrichment ──────────────────────────────────────────────

async function enrichDescriptions(
  workouts: WeekWorkout[],
  ctx: {
    phase: Phase;
    mesocycleWeek: 1 | 2 | 3 | 4;
    weeklyTss: number;
    ctl: number;
    atl: number;
    tsb: number;
    ftpWatts: number;
    maxHrBpm: number;
    weekSummaries: WeekSummary[];
    goals: Array<{ title: string; targetDate: string | null; category: string | null }>;
  },
): Promise<WeekWorkout[]> {
  const phaseLabel = { base: 'Grundlagenaufbau', build: 'Aufbau', peak: 'Wettkampfvorbereitung', taper: 'Tapering' }[ctx.phase];
  const mesoLabel = ctx.mesocycleWeek === 4 ? 'Regenerationswoche (Woche 4)' : `Aufbauwoche ${ctx.mesocycleWeek}/3`;

  const historyStr = ctx.weekSummaries.slice(-6).map(w => {
    const sports = Object.entries(w.sports)
      .map(([s, d]) => `${s}×${d!.sessions}`)
      .join('+');
    return `${w.weekStart}: TSS=${w.totalTss.toFixed(0)}, ${w.totalHours.toFixed(1)}h (${sports})`;
  }).join('\n  ');

  const goalsStr = ctx.goals.length > 0
    ? ctx.goals.map(g => `${g.title}${g.targetDate ? ` bis ${g.targetDate}` : ''}`).join(', ')
    : 'keine';

  const zoneRef = [
    `Rad Z2: ${Math.round(ctx.ftpWatts * 0.56)}–${Math.round(ctx.ftpWatts * 0.75)}W`,
    `Rad Z4: ${Math.round(ctx.ftpWatts * 0.90)}–${Math.round(ctx.ftpWatts * 1.05)}W`,
    `Rad Z5: >${Math.round(ctx.ftpWatts * 1.05)}W`,
    `Lauf Z2: ${Math.round(ctx.maxHrBpm * 0.68)}–${Math.round(ctx.maxHrBpm * 0.78)}bpm`,
    `Lauf Z4: ${Math.round(ctx.maxHrBpm * 0.88)}–${Math.round(ctx.maxHrBpm * 0.95)}bpm`,
  ].join(' | ');

  const workoutList = workouts
    .map((w, i) => `[${i}] ${w.plannedDate} | ${w.activityType.toUpperCase()} | Z${w.zone} | ${w.durationMin}min | TSS≈${w.targetTss}`)
    .join('\n');

  const totalTss = workouts.reduce((s, w) => s + w.targetTss, 0);
  const hardCount = workouts.filter(w => w.zone >= 4).length;
  const easyPct = Math.round(((workouts.length - hardCount) / workouts.length) * 100);

  const prompt = `Du bist Sportwissenschaftler und Ausdauercoach. Schreibe präzise Trainingsbeschreibungen.

ATHLETEN-STATUS:
- Phase: ${phaseLabel}, ${mesoLabel}
- Fitness CTL=${ctx.ctl.toFixed(0)}, Ermüdung ATL=${ctx.atl.toFixed(0)}, Form TSB=${ctx.tsb.toFixed(0)}
- FTP: ${ctx.ftpWatts}W | Max-HF: ${ctx.maxHrBpm}bpm
- Ziele: ${goalsStr}

TRAININGSHISTORIE (letzte 6 Wochen):
  ${historyStr || 'keine Daten'}

DIESE WOCHE: ${workouts.length} Einheiten | Ziel-TSS ${totalTss} | ${easyPct}% extensiv (polarisiertes Modell 80/20)
${workoutList}

Intensitätsbereiche: ${zoneRef}

Erstelle für jedes Workout eine 1-2-sätzige Beschreibung auf Deutsch:
- Z2/Z1-Workouts: Fokus auf Aerob-Effizienz, Fettstoffwechsel, Regeneration
- Z4/Z5-Workouts: Konkrete Zielintensität, Intervalstruktur-Empfehlung, Trainingseffekt
- Berücksichtige den Wochenverlauf (Ermüdung akkumuliert)
${ctx.tsb < -15 ? '- ACHTUNG: Hohe Ermüdung — betone Erholungscharakter, keine Zusatzreize\n' : ''}
Antworte NUR mit JSON-Array (gleiche Reihenfolge wie oben):
[{"index":0,"description":"..."}]`;

  const raw = await llmComplete(
    'Du bist Sportwissenschaftler. Antworte nur mit validem JSON-Array.',
    prompt,
    SMART_MODEL,
  );

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return workouts;

  const items = JSON.parse(jsonMatch[0]) as Array<{ index: number; description: string }>;
  return workouts.map((w, i) => ({
    ...w,
    description: items.find(it => it.index === i)?.description ?? w.description,
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ScientificPlanInput {
  weekStart: string;
  phase: Phase;
  weeklyHoursTarget: number;
  availableDays: number[];
  ctl: number;
  atl: number;
  tsb: number;
  ftpWatts: number;
  maxHrBpm: number;
  recentActivities: Array<{
    date: string;
    activityType: string;
    durationMin: number;
    tss: number;
  }>;
  goals: Array<{
    title: string;
    targetDate: string | null;
    category: string | null;
  }>;
}

export async function generateScientificWeekPlan(input: ScientificPlanInput): Promise<WeekWorkout[]> {
  const mesocycleWeek = getMesocycleWeek(input.weekStart);
  const phase = input.phase as Phase;

  const weeklyTss = computeWeeklyTssTarget({
    ctl: input.ctl,
    tsb: input.tsb,
    weeklyHoursTarget: input.weeklyHoursTarget,
    mesocycleWeek,
    phase,
  });

  const workouts = buildPolarizedWorkouts({
    weekStart: input.weekStart,
    availableDays: input.availableDays,
    phase,
    weeklyTss,
    weeklyHoursTarget: input.weeklyHoursTarget,
    tsb: input.tsb,
  });

  if (workouts.length === 0) return [];

  const weekSummaries = aggregateHistory(input.recentActivities);

  try {
    return await enrichDescriptions(workouts, {
      phase,
      mesocycleWeek,
      weeklyTss,
      ctl: input.ctl,
      atl: input.atl,
      tsb: input.tsb,
      ftpWatts: input.ftpWatts,
      maxHrBpm: input.maxHrBpm,
      weekSummaries,
      goals: input.goals,
    });
  } catch (err) {
    // Return workouts with empty descriptions rather than fail entirely
    return workouts;
  }
}

// ─── Simple template fallback (last resort if DB/LLM both fail) ──────────────

const PHASE_TEMPLATES: Record<Phase, Array<{ activityType: ActivityType; zone: number; durationMin: number; description: string }>> = {
  base: [
    { activityType: 'bike',     zone: 2, durationMin: 90, description: 'Z2-Ausfahrt — Grundlagenausdauer' },
    { activityType: 'run',      zone: 2, durationMin: 60, description: 'Lockerer Z2-Lauf' },
    { activityType: 'run',      zone: 4, durationMin: 55, description: 'Schwellenintervalle' },
    { activityType: 'strength', zone: 1, durationMin: 45, description: 'Kraft & Stabilität' },
  ],
  build: [
    { activityType: 'run',  zone: 4, durationMin: 60,  description: 'Schwellenintervalle 4×10min' },
    { activityType: 'bike', zone: 2, durationMin: 120, description: 'Langer Z2-Block' },
    { activityType: 'run',  zone: 5, durationMin: 50,  description: 'VO2max-Intervalle' },
    { activityType: 'bike', zone: 2, durationMin: 75,  description: 'Z2-Ausfahrt' },
  ],
  peak: [
    { activityType: 'run',  zone: 5, durationMin: 45, description: 'VO2max-Intervalle 6×4min' },
    { activityType: 'bike', zone: 4, durationMin: 75, description: 'Renn-Simulation' },
    { activityType: 'run',  zone: 2, durationMin: 40, description: 'Aktivierungslauf' },
  ],
  taper: [
    { activityType: 'run',  zone: 2, durationMin: 30, description: 'Lockeres Eintrotteln' },
    { activityType: 'bike', zone: 2, durationMin: 45, description: 'Lockere Aktivierung' },
    { activityType: 'run',  zone: 4, durationMin: 20, description: 'Kurze Aktivierungsintervalle' },
  ],
};

export function generateWeekWorkouts(params: {
  weekStart: string;
  phase: string;
  weeklyHoursTarget: number;
  availableDays: number[];
}): WeekWorkout[] {
  const phase = (params.phase as Phase) ?? 'base';
  const templates = PHASE_TEMPLATES[phase];
  const sorted = [...params.availableDays].sort((a, b) => a - b);
  const n = Math.min(sorted.length, templates.length);
  const totalMin = params.weeklyHoursTarget * 60;
  const selectedTemplates = templates.slice(0, n);
  const templateTotal = selectedTemplates.reduce((s, t) => s + t.durationMin, 0);
  const scale = totalMin / templateTotal;
  const startDate = new Date(params.weekStart + 'T00:00:00Z');

  return selectedTemplates.map((t, i) => {
    const durationMin = Math.round(t.durationMin * scale);
    const plannedDate = new Date(startDate);
    plannedDate.setUTCDate(startDate.getUTCDate() + sorted[i]!);
    return {
      plannedDate: plannedDate.toISOString().split('T')[0]!,
      activityType: t.activityType,
      zone: t.zone,
      durationMin,
      targetTss: tssFromWorkout(durationMin, t.zone),
      description: t.description,
    };
  });
}

export function adaptIntensityForReadiness(
  workout: { durationMin: number; zone: number },
  readiness: number,
): { durationMin: number; zone: number } {
  if (readiness >= 65) return workout;
  if (readiness < 35) return { durationMin: Math.round(workout.durationMin * 0.5), zone: Math.max(1, workout.zone - 2) };
  return { durationMin: Math.round(workout.durationMin * 0.7), zone: Math.min(workout.zone, 3) };
}
