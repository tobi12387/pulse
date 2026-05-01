// Phase 9: Recovery & Fueling Depth — pure functions on daily metrics history.
//
// Conventions:
// - Input is the last ~30 days of pulse_daily_metrics, **newest first**.
// - All functions tolerate missing fields (return null status / 0 if no data).
// - Sleep target defaults to 8.0 h, override per user via profile.

export interface SleepDebt {
  hours: number;                      // sum(baseline - actual) over last 7 days, negative = surplus
  targetH: number;                    // baseline used (adaptive median of days 8-60, or default if too little data)
  baselineSource: 'adaptive' | 'fixed_default' | 'garmin_sleep_need';
  status: 'ok' | 'mild' | 'severe';   // <2h ok, 2-5h mild, >5h severe (vs personal baseline)
}

export interface HrvDeviation {
  pct: number;                        // recent7 vs baseline23 (% change)
  recentMs: number | null;
  baselineMs: number | null;
  status: 'recovering' | 'stable' | 'declining';   // >+5% recovering, ±5 stable, <-5 declining
}

export interface RhrDrift {
  bpmAboveBaseline: number;           // recent7 avg minus min(baseline23)
  recent: number | null;
  baseline: number | null;
  status: 'normal' | 'elevated';       // > +5 bpm = elevated
}

export interface RecoveryMetrics {
  sleepDebt7d: SleepDebt;
  hrvDeviation7d: HrvDeviation;
  rhrDrift7d: RhrDrift;
  recoveryScore: number;               // 0-100 composite
  recommendation: string;              // single-sentence actionable hint
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface Sample {
  sleepHours: number | null;
  hrvRmssd: number | null;
  restingHr: number | null;
  sleepNeedMin?: number | null;
  sleepActualMin?: number | null;
  highStressSec?: number | null;
  bodyBatteryAtWake?: number | null;
  bodyBatteryCharged?: number | null;
  bodyBatteryDrained?: number | null;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function avgN(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length === 0 ? null : avg(v);
}

function minN(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length === 0 ? null : Math.min(...v);
}

// ─── Sleep debt ──────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[m - 1]! + sorted[m]!) / 2
    : sorted[m]!;
}

// Personal sleep baseline = median of days 8..60 (excluding last week to avoid
// recent dip leaking into target). Floored at 6.5h to refuse normalizing chronic
// deprivation, capped at 9.0h to avoid unrealistic ceilings.
function computeAdaptiveBaseline(samples: Sample[], fallbackH: number): { h: number; source: SleepDebt['baselineSource'] } {
  const baselineSamples = samples
    .slice(7, 60)
    .map(s => s.sleepHours)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 2 && v < 14);
  if (baselineSamples.length < 14) {
    return { h: fallbackH, source: 'fixed_default' };
  }
  const m = median(baselineSamples);
  const clamped = Math.min(9.0, Math.max(6.5, m));
  return { h: Math.round(clamped * 10) / 10, source: 'adaptive' };
}

function computeSleepDebt(samples: Sample[], fallbackTargetH: number): SleepDebt {
  const sleepNeedRows = samples.slice(0, 7).filter(s =>
    typeof s.sleepNeedMin === 'number' &&
    Number.isFinite(s.sleepNeedMin) &&
    typeof s.sleepActualMin === 'number' &&
    Number.isFinite(s.sleepActualMin)
  );
  if (sleepNeedRows.length >= 3) {
    let debtMin = sleepNeedRows.reduce((sum, row) =>
      sum + Math.max(0, (row.sleepNeedMin ?? 0) - (row.sleepActualMin ?? 0)), 0);
    if (sleepNeedRows.length < 7) debtMin = (debtMin / sleepNeedRows.length) * 7;
    const hours = Math.round((debtMin / 60) * 10) / 10;
    const targetH = Math.round(avg(sleepNeedRows.map(row => (row.sleepNeedMin ?? 0) / 60)) * 10) / 10;
    const status: SleepDebt['status'] = hours < 2 ? 'ok' : hours < 5 ? 'mild' : 'severe';
    return { hours, targetH, baselineSource: 'garmin_sleep_need', status };
  }

  const baseline = computeAdaptiveBaseline(samples, fallbackTargetH);
  const targetH = baseline.h;

  const last7 = samples.slice(0, 7);
  let debt = 0;
  let counted = 0;
  for (const s of last7) {
    if (typeof s.sleepHours === 'number' && Number.isFinite(s.sleepHours)) {
      debt += targetH - s.sleepHours;
      counted++;
    }
  }
  if (counted < 3) {
    return { hours: 0, targetH, baselineSource: baseline.source, status: 'ok' };
  }
  if (counted < 7) debt = (debt / counted) * 7;

  // Only positive debt (= shortfall) is bad. Surplus (negative) stays 'ok'.
  const status: SleepDebt['status'] = debt < 2 ? 'ok' : debt < 5 ? 'mild' : 'severe';
  return { hours: Math.round(debt * 10) / 10, targetH, baselineSource: baseline.source, status };
}

// ─── HRV deviation ───────────────────────────────────────────────────────────

function computeHrvDeviation(samples: Sample[]): HrvDeviation {
  const last7     = samples.slice(0, 7).map(s => s.hrvRmssd);
  const baseline23 = samples.slice(7, 30).map(s => s.hrvRmssd);

  const recent   = avgN(last7);
  const baseline = avgN(baseline23);

  if (recent == null || baseline == null || baseline <= 0) {
    return { pct: 0, recentMs: recent, baselineMs: baseline, status: 'stable' };
  }

  const pct = ((recent - baseline) / baseline) * 100;
  const status: HrvDeviation['status'] =
    pct >  5 ? 'recovering' :
    pct < -5 ? 'declining'  : 'stable';

  return {
    pct: Math.round(pct * 10) / 10,
    recentMs: Math.round(recent),
    baselineMs: Math.round(baseline),
    status,
  };
}

// ─── RHR drift ───────────────────────────────────────────────────────────────

function computeRhrDrift(samples: Sample[]): RhrDrift {
  const last7     = samples.slice(0, 7).map(s => s.restingHr);
  const baseline23 = samples.slice(7, 30).map(s => s.restingHr);

  const recent   = avgN(last7);
  const baseline = minN(baseline23);   // use min() not avg() — best baseline = lowest healthy RHR

  if (recent == null || baseline == null) {
    return { bpmAboveBaseline: 0, recent, baseline, status: 'normal' };
  }

  const drift = recent - baseline;
  const status: RhrDrift['status'] = drift > 5 ? 'elevated' : 'normal';

  return {
    bpmAboveBaseline: Math.round(drift * 10) / 10,
    recent: Math.round(recent),
    baseline,
    status,
  };
}

// ─── Composite recovery score ────────────────────────────────────────────────

function computeRecoveryScore(d: SleepDebt, h: HrvDeviation, r: RhrDrift, samples: Sample[]): number {
  // sleep factor: 100 at debt=0, linear -10/hour shortfall, surplus capped at 100
  const sleepFactor = Math.max(0, 100 - Math.max(0, d.hours) * 10);
  // hrv factor: 100 at +10%, linear -3 per pct point below 0
  const hrvFactor =
    h.recentMs == null || h.baselineMs == null ? 60 :
    Math.max(0, Math.min(100, 70 + h.pct * 3));
  // rhr factor: 100 at baseline, -8 per bpm above baseline
  const rhrFactor =
    r.recent == null || r.baseline == null ? 60 :
    Math.max(0, 100 - r.bpmAboveBaseline * 8);

  const highStressAvg = avgN(samples.slice(0, 7).map(s => s.highStressSec));
  const wakeBatteryAvg = avgN(samples.slice(0, 7).map(s => s.bodyBatteryAtWake));
  const stressPenalty = highStressAvg != null && highStressAvg >= 5400 ? 5 : 0;
  const batteryPenalty = wakeBatteryAvg != null && wakeBatteryAvg < 35 ? 5 : 0;

  const score = sleepFactor * 0.4 + hrvFactor * 0.4 + rhrFactor * 0.2 - stressPenalty - batteryPenalty;
  return Math.max(0, Math.round(score));
}

function buildRecommendation(d: SleepDebt, h: HrvDeviation, r: RhrDrift, score: number, samples: Sample[]): string {
  // Pick the dominant deficit
  const issues: { weight: number; msg: string }[] = [];

  const sleepLabel = d.baselineSource === 'garmin_sleep_need' ? 'Schlafbedarf-Lücke' : 'Schlafdefizit';
  if (d.status === 'severe')      issues.push({ weight: 3, msg: `${sleepLabel} ${d.hours.toFixed(1)}h — heute Z2 statt Z4, 8.5h Schlaf anpeilen` });
  else if (d.status === 'mild')   issues.push({ weight: 2, msg: `${sleepLabel} ${d.hours.toFixed(1)}h — eine Z2-Einheit reicht heute, früh ins Bett` });

  if (h.status === 'declining')   issues.push({ weight: 3, msg: `HRV ${h.pct.toFixed(1)}% unter 30d-Baseline — Intensität diese Woche reduzieren` });
  else if (h.status === 'recovering' && score >= 75) issues.push({ weight: 1, msg: 'HRV im Aufwärtstrend — Intensität geht klar' });

  if (r.status === 'elevated')    issues.push({ weight: 3, msg: `Ruhepuls +${r.bpmAboveBaseline.toFixed(0)} bpm über Baseline — Erkältungsanzeichen, Z1 oder Pause` });

  const highStressAvg = avgN(samples.slice(0, 7).map(s => s.highStressSec));
  if (highStressAvg != null && highStressAvg >= 5400) {
    issues.push({ weight: 2, msg: 'Hohe Stressdauer in den letzten Tagen — Intensität nur mit gutem Tagesgefühl.' });
  }

  const wakeBatteryAvg = avgN(samples.slice(0, 7).map(s => s.bodyBatteryAtWake));
  if (wakeBatteryAvg != null && wakeBatteryAvg < 35) {
    issues.push({ weight: 2, msg: 'Body Battery morgens niedrig — Training eher locker halten.' });
  }

  if (issues.length === 0) {
    if (score >= 80)  return 'Recovery exzellent — geplante Intensität voll umsetzen.';
    if (score >= 65)  return 'Recovery gut — Plan wie geplant durchziehen.';
    return 'Recovery moderat — Belastung im Auge behalten, kein zusätzlicher Stress.';
  }

  issues.sort((a, b) => b.weight - a.weight);
  return issues[0]!.msg;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function computeRecovery(args: {
  daily: Sample[];           // newest first; >= 1 row required, ideally 7-60 for adaptive baseline
  sleepTargetH?: number;     // user override; defaults to 8.0h fallback when adaptive baseline unavailable
}): RecoveryMetrics {
  const targetH = args.sleepTargetH ?? 8.0;
  const samples = args.daily.slice(0, 60);

  const sleepDebt7d   = computeSleepDebt(samples, targetH);
  const hrvDeviation7d = computeHrvDeviation(samples);
  const rhrDrift7d    = computeRhrDrift(samples);
  const recoveryScore = computeRecoveryScore(sleepDebt7d, hrvDeviation7d, rhrDrift7d, samples);
  const recommendation = buildRecommendation(sleepDebt7d, hrvDeviation7d, rhrDrift7d, recoveryScore, samples);

  return { sleepDebt7d, hrvDeviation7d, rhrDrift7d, recoveryScore, recommendation };
}
