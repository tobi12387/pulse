// Phase 8: Activity Intelligence — pure functions on raw streams.
//
// Conventions:
// - Streams are 1Hz arrays (one sample per second).
// - HR in bpm, pace in sec/km, speed in m/s, power in W.
// - We skip the first 10 minutes (warmup) and last 60 seconds (cooldown) for
//   metrics that need stationarity (decoupling, EF). HR-drift uses end vs
//   start *blocks* and similarly skips warmup.

export interface AerobicDecoupling {
  firstHalfRatio: number;        // for run: pace_per_hr (sec/km/bpm); for bike: power_per_hr (W/bpm)
  secondHalfRatio: number;
  decouplingPct: number;         // (second-first)/first * 100
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface EfficiencyFactor {
  ef: number;                    // run: pace-based (lower = faster at given HR); bike: power-based (higher = better)
  unit: 'sec/km/bpm' | 'W/bpm';
}

const WARMUP_SEC = 600;
const COOLDOWN_SEC = 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trim(arr: readonly number[], from: number, to: number): number[] {
  return arr.slice(from, arr.length - to);
}

function avg(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0, n = 0;
  for (const v of values) {
    if (Number.isFinite(v)) { sum += v; n++; }
  }
  return n === 0 ? 0 : sum / n;
}

// Centered moving average. windowSec applied to a 1Hz stream.
function smooth(values: readonly number[], windowSec: number): number[] {
  if (windowSec <= 1 || values.length === 0) return [...values];
  const half = Math.floor(windowSec / 2);
  const out = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(values.length, i + half + 1);
    out[i] = avg(values.slice(lo, hi));
  }
  return out;
}

// ─── Decoupling (Pa:HR for run, Pw:HR for bike) ───────────────────────────────
// Joe Friel's threshold:  <  3% excellent
//                         <  5% good
//                         <  7% fair
//                         >= 7% poor (likely fatigued, dehydrated, or aerobic-limit reached)

export function computeDecoupling(args: {
  hrStream: readonly number[];
  // For run: paceStream in sec/km. For bike: powerStream in W. Pass exactly one.
  paceStream?: readonly number[];      // sec/km
  powerStream?: readonly number[];     // W
}): AerobicDecoupling | null {
  const { hrStream } = args;
  if (hrStream.length < WARMUP_SEC + 600) return null;   // need at least 20min total post-warmup

  const hr = trim(hrStream, WARMUP_SEC, COOLDOWN_SEC);
  const sm = smooth(hr, 30);
  const half = Math.floor(sm.length / 2);

  let ratio: (idx: number) => number;
  if (args.paceStream) {
    const pace = smooth(trim(args.paceStream, WARMUP_SEC, COOLDOWN_SEC), 30);
    // Pa:HR = pace_per_hr — but pace is "lower=faster", so we invert (1/pace) to mean
    // "speed_per_hr" so that decoupling > 0 actually means "slower at same HR".
    // Practical Pa:HR convention: ratio = (1/pace) / hr. Higher early-half ratio = better.
    // Decoupling % = (firstHalfRatio - secondHalfRatio)/firstHalfRatio * 100 (positive = drift)
    ratio = (i) => {
      const p = pace[i]!;
      const h = sm[i]!;
      if (!Number.isFinite(p) || p <= 0 || h <= 0) return NaN;
      return (1 / p) / h;
    };
  } else if (args.powerStream) {
    const pw = smooth(trim(args.powerStream, WARMUP_SEC, COOLDOWN_SEC), 30);
    ratio = (i) => {
      const p = pw[i]!;
      const h = sm[i]!;
      if (!Number.isFinite(p) || p <= 0 || h <= 0) return NaN;
      return p / h;
    };
  } else {
    return null;
  }

  const firstVals: number[] = [];
  const secondVals: number[] = [];
  for (let i = 0; i < half; i++) {
    const r = ratio(i);
    if (Number.isFinite(r)) firstVals.push(r);
  }
  for (let i = half; i < sm.length; i++) {
    const r = ratio(i);
    if (Number.isFinite(r)) secondVals.push(r);
  }
  if (firstVals.length < 60 || secondVals.length < 60) return null;

  const firstHalfRatio  = avg(firstVals);
  const secondHalfRatio = avg(secondVals);
  if (firstHalfRatio <= 0) return null;

  // % drift: positive = ratio decreased (HR up at same speed/power = aerobic decoupling)
  const decouplingPct = ((firstHalfRatio - secondHalfRatio) / firstHalfRatio) * 100;

  const rating: AerobicDecoupling['rating'] =
    decouplingPct < 3 ? 'excellent' :
    decouplingPct < 5 ? 'good' :
    decouplingPct < 7 ? 'fair' : 'poor';

  return { firstHalfRatio, secondHalfRatio, decouplingPct, rating };
}

// ─── Efficiency Factor ────────────────────────────────────────────────────────
// Run-EF (pace-based): mean(speed_m_s) / mean(hr) — higher is better
// Bike-EF (power-based): mean(power) / mean(hr) — higher is better
// Both reported per-bpm so we have a fitness trendable scalar over time.

export function computeEf(args: {
  hrStream: readonly number[];
  speedStream?: readonly number[];      // m/s for run
  powerStream?: readonly number[];      // W for bike
}): EfficiencyFactor | null {
  const { hrStream } = args;
  if (hrStream.length < WARMUP_SEC + 300) return null;

  const hr = trim(hrStream, WARMUP_SEC, COOLDOWN_SEC);
  const meanHr = avg(hr.filter(v => v > 0));
  if (meanHr <= 0) return null;

  if (args.speedStream) {
    const speed = trim(args.speedStream, WARMUP_SEC, COOLDOWN_SEC);
    const meanSpeed = avg(speed.filter(v => v > 0));
    if (meanSpeed <= 0) return null;
    // Convert to "min/km/bpm"-style is tricky; we keep raw sec/km/bpm by inverting.
    // Higher meanSpeed/meanHr = better. We expose as sec/km/bpm by formula:
    //   pace_sec_per_km = 1000 / meanSpeed
    //   ef = pace_sec_per_km / meanHr  (lower = better — but more standard is to report m/s/bpm)
    // We keep `ef` as m/s/bpm × 1000 for human-readable scale (~5–8 typical for trained athletes).
    return { ef: (meanSpeed / meanHr) * 1000, unit: 'sec/km/bpm' };
  }
  if (args.powerStream) {
    const pw = trim(args.powerStream, WARMUP_SEC, COOLDOWN_SEC);
    const meanPw = avg(pw.filter(v => v > 0));
    if (meanPw <= 0) return null;
    return { ef: meanPw / meanHr, unit: 'W/bpm' };
  }
  return null;
}

// ─── HR Drift (compare-to-self end vs start blocks) ───────────────────────────
// Returns avg HR of last 30 min minus avg HR of first 30 min (post-warmup).
// Positive = HR drifted up (fatigue/dehydration); near zero = stable aerobic state.
// Only meaningful for >50min activities at relatively constant effort.

export function computeHrDrift(hrStream: readonly number[]): number | null {
  if (hrStream.length < WARMUP_SEC + 60 * 60) return null;   // need 60min post-warmup
  const post = trim(hrStream, WARMUP_SEC, COOLDOWN_SEC);
  const blockSec = 30 * 60;
  if (post.length < blockSec * 2) return null;

  const firstBlock = post.slice(0, blockSec).filter(v => v > 0);
  const lastBlock  = post.slice(post.length - blockSec).filter(v => v > 0);
  if (firstBlock.length < 60 || lastBlock.length < 60) return null;

  return avg(lastBlock) - avg(firstBlock);
}

// ─── From-laps fallback (used when full 1Hz streams are not persisted) ──────
// Garmin already gives us per-lap avgHR/avgPower/avgSpeed/duration. We can
// derive a useful decoupling signal by comparing the first vs second half of
// the lap sequence, weighted by duration. EF uses the duration-weighted means
// across all laps. Coarser than a 1Hz stream but enough to surface drift.

export interface LapForAnalytics {
  index: number;
  durationSec: number | null;
  avgHr: number | null;
  avgPowerW: number | null;
  avgSpeedMs: number | null;          // m/s; for run we use 1/speed as pace
}

export function computeFromLaps(args: {
  activityType: string;
  laps: LapForAnalytics[];
}): AnalyticsResult {
  const usable = args.laps.filter(l =>
    (l.durationSec ?? 0) >= 60 &&
    (l.avgHr ?? 0) > 0 &&
    ((l.avgPowerW ?? 0) > 0 || (l.avgSpeedMs ?? 0) > 0),
  );
  if (usable.length < 2) return { ef: null, decoupling: null, hrDriftBpm: null };

  const isBike = args.activityType === 'bike';
  const isRun  = args.activityType === 'run';
  if (!isBike && !isRun) return { ef: null, decoupling: null, hrDriftBpm: null };

  // Drop a warmup lap if first lap looks much easier (HR ≥10% lower than mean)
  const meanHrAll = usable.reduce((s, l) => s + l.avgHr!, 0) / usable.length;
  let workSet = usable;
  if (usable.length >= 4 && usable[0]!.avgHr! < meanHrAll * 0.9) {
    workSet = usable.slice(1);
  }

  // Duration-weighted means
  const totalDur = workSet.reduce((s, l) => s + l.durationSec!, 0);
  const wMean = (pick: (l: LapForAnalytics) => number | null): number => {
    let num = 0;
    for (const l of workSet) {
      const v = pick(l);
      if (v != null && Number.isFinite(v)) num += v * l.durationSec!;
    }
    return num / totalDur;
  };

  const meanHr = wMean(l => l.avgHr);
  let ef: EfficiencyFactor | null = null;
  if (isBike) {
    const meanPw = wMean(l => l.avgPowerW);
    if (meanHr > 0 && meanPw > 0) ef = { ef: meanPw / meanHr, unit: 'W/bpm' };
  } else if (isRun) {
    const meanSp = wMean(l => l.avgSpeedMs);
    if (meanHr > 0 && meanSp > 0) ef = { ef: (meanSp / meanHr) * 1000, unit: 'sec/km/bpm' };
  }

  // Decoupling: split workSet by cumulative duration into halves
  const halfDur = totalDur / 2;
  let cum = 0;
  const firstLaps: LapForAnalytics[] = [];
  const secondLaps: LapForAnalytics[] = [];
  for (const l of workSet) {
    if (cum + l.durationSec! / 2 <= halfDur) firstLaps.push(l);
    else secondLaps.push(l);
    cum += l.durationSec!;
  }
  // Decoupling needs at least 4 laps (≥2 per half) and ≥30min total to be meaningful.
  // Below that, lap structure dominates the signal.
  if (firstLaps.length < 2 || secondLaps.length < 2 || totalDur < 60 * 30) {
    return { ef, decoupling: null, hrDriftBpm: null };
  }

  const halfRatio = (laps: LapForAnalytics[]): number | null => {
    const dur = laps.reduce((s, l) => s + l.durationSec!, 0);
    if (dur === 0) return null;
    let hrSum = 0, denomSum = 0;
    for (const l of laps) {
      hrSum += l.avgHr! * l.durationSec!;
      const denom = isBike ? (l.avgPowerW ?? 0) : (l.avgSpeedMs ?? 0);
      denomSum += denom * l.durationSec!;
    }
    const hr = hrSum / dur;
    const den = denomSum / dur;
    if (hr <= 0 || den <= 0) return null;
    return den / hr;          // power/hr or speed/hr — higher = more efficient
  };

  const r1 = halfRatio(firstLaps);
  const r2 = halfRatio(secondLaps);

  let decoupling: AerobicDecoupling | null = null;
  if (r1 != null && r2 != null && r1 > 0) {
    const decouplingPct = ((r1 - r2) / r1) * 100;
    const rating: AerobicDecoupling['rating'] =
      decouplingPct < 3 ? 'excellent' :
      decouplingPct < 5 ? 'good' :
      decouplingPct < 7 ? 'fair' : 'poor';
    decoupling = { firstHalfRatio: r1, secondHalfRatio: r2, decouplingPct, rating };
  }

  // HR drift from laps: avg HR of last 30% by duration vs first 30%
  let hrDriftBpm: number | null = null;
  if (totalDur >= 60 * 50) {
    const block = totalDur * 0.3;
    let used = 0;
    const firstBlockLaps: LapForAnalytics[] = [];
    for (const l of workSet) {
      if (used >= block) break;
      firstBlockLaps.push(l);
      used += l.durationSec!;
    }
    used = 0;
    const lastBlockLaps: LapForAnalytics[] = [];
    for (let i = workSet.length - 1; i >= 0 && used < block; i--) {
      lastBlockLaps.push(workSet[i]!);
      used += workSet[i]!.durationSec!;
    }
    const blockHr = (laps: LapForAnalytics[]): number => {
      const d = laps.reduce((s, l) => s + l.durationSec!, 0);
      const h = laps.reduce((s, l) => s + l.avgHr! * l.durationSec!, 0);
      return d > 0 ? h / d : 0;
    };
    const a = blockHr(firstBlockLaps);
    const b = blockHr(lastBlockLaps);
    if (a > 0 && b > 0) hrDriftBpm = b - a;
  }

  return { ef, decoupling, hrDriftBpm };
}

// ─── Convenience: compute all ─────────────────────────────────────────────────

export interface AnalyticsResult {
  ef: EfficiencyFactor | null;
  decoupling: AerobicDecoupling | null;
  hrDriftBpm: number | null;
}

export function computeAll(args: {
  activityType: string;
  hrStream: readonly number[];
  paceStream?: readonly number[];
  speedStream?: readonly number[];
  powerStream?: readonly number[];
}): AnalyticsResult {
  const isBike = args.activityType === 'bike';
  const isRun  = args.activityType === 'run';

  let decoupling: AerobicDecoupling | null = null;
  let ef: EfficiencyFactor | null = null;

  if (isRun) {
    decoupling = args.paceStream ? computeDecoupling({ hrStream: args.hrStream, paceStream: args.paceStream }) : null;
    ef = args.speedStream ? computeEf({ hrStream: args.hrStream, speedStream: args.speedStream }) : null;
  } else if (isBike) {
    decoupling = args.powerStream ? computeDecoupling({ hrStream: args.hrStream, powerStream: args.powerStream }) : null;
    ef = args.powerStream ? computeEf({ hrStream: args.hrStream, powerStream: args.powerStream }) : null;
  }

  const hrDriftBpm = computeHrDrift(args.hrStream);
  return { ef, decoupling, hrDriftBpm };
}
