export interface PowerEffort {
  durationSec: number;
  avgPowerW: number;
  startSec: number;
}

export interface PowerDurationBestEffort extends PowerEffort {
  source: 'stream' | 'lap_approximation';
}

export interface PowerDurationLap {
  durationSec?: number | null;
  avgPowerW?: number | null;
  avgHr?: number | null;
}

export function bestPowerEfforts(powerStream: readonly number[], durationsSec: readonly number[]): PowerEffort[] {
  const prefix = [0];

  for (const value of powerStream) {
    prefix.push(prefix[prefix.length - 1]! + Math.max(0, Number.isFinite(value) ? value : 0));
  }

  return durationsSec
    .filter(duration => duration > 0 && duration <= powerStream.length)
    .map(duration => {
      let best = 0;
      let startSec = 0;

      for (let start = 0; start + duration <= powerStream.length; start += 1) {
        const avg = (prefix[start + duration]! - prefix[start]!) / duration;
        if (avg > best) {
          best = avg;
          startSec = start;
        }
      }

      return { durationSec: duration, avgPowerW: Math.round(best), startSec };
    });
}

export function bestPowerEffortsFromLaps(
  laps: readonly PowerDurationLap[],
  durationsSec: readonly number[],
): PowerDurationBestEffort[] {
  const usable = laps
    .map((lap, index) => ({
      index,
      durationSec: Math.max(0, lap.durationSec ?? 0),
      avgPowerW: lap.avgPowerW ?? 0,
    }))
    .filter(lap => lap.durationSec >= 60 && lap.avgPowerW > 0);

  const offsets: number[] = [];
  let offset = 0;
  for (const lap of usable) {
    offsets.push(offset);
    offset += lap.durationSec;
  }
  const totalDuration = usable.reduce((sum, lap) => sum + lap.durationSec, 0);

  return durationsSec
    .filter(duration => duration > 0 && (usable.some(lap => lap.durationSec >= duration) || totalDuration >= duration))
    .map(duration => {
      let best = 0;
      let startSec = 0;

      for (let start = 0; start < usable.length; start += 1) {
        let weightedPower = 0;
        let durationAccum = 0;
        for (let end = start; end < usable.length && durationAccum < duration; end += 1) {
          weightedPower += usable[end]!.avgPowerW * usable[end]!.durationSec;
          durationAccum += usable[end]!.durationSec;
        }
        if (durationAccum >= duration) {
          const avg = weightedPower / durationAccum;
          if (avg > best) {
            best = avg;
            startSec = offsets[start] ?? 0;
          }
        }
      }

      return { durationSec: duration, avgPowerW: Math.round(best), startSec, source: 'lap_approximation' };
    });
}

export interface DurabilitySignal {
  rating: 'strong' | 'watch' | 'limited';
  powerDropPct: number;
  hrDriftBpm: number;
  evidence: string[];
}

export function deriveDurabilitySignal(input: {
  durationSec: number;
  firstHalfPowerW: number;
  secondHalfPowerW: number;
  firstHalfHr: number;
  secondHalfHr: number;
}): DurabilitySignal {
  const powerDropPct = input.firstHalfPowerW > 0
    ? Math.round(((input.secondHalfPowerW - input.firstHalfPowerW) / input.firstHalfPowerW) * 100)
    : 0;
  const hrDriftBpm = Math.round(input.secondHalfHr - input.firstHalfHr);
  const rating = input.durationSec >= 10_800 && powerDropPct <= -18 && hrDriftBpm <= 8
    ? 'limited'
    : powerDropPct <= -10 || hrDriftBpm >= 10
      ? 'watch'
      : 'strong';

  return {
    rating,
    powerDropPct,
    hrDriftBpm,
    evidence: [
      `Power ${powerDropPct}%`,
      `HR ${hrDriftBpm >= 0 ? '+' : ''}${hrDriftBpm} bpm`,
      `${Math.round(input.durationSec / 60)} min`,
    ],
  };
}

function weightedAverage(rows: Array<{ value: number; durationSec: number }>): number | null {
  const totalDuration = rows.reduce((sum, row) => sum + row.durationSec, 0);
  if (totalDuration <= 0) return null;
  return rows.reduce((sum, row) => sum + row.value * row.durationSec, 0) / totalDuration;
}

export function deriveDurabilityFromLaps(laps: readonly PowerDurationLap[]): DurabilitySignal | null {
  const usable = laps
    .map(lap => ({
      durationSec: Math.max(0, lap.durationSec ?? 0),
      avgPowerW: lap.avgPowerW ?? 0,
      avgHr: lap.avgHr ?? 0,
    }))
    .filter(lap => lap.durationSec >= 60 && lap.avgPowerW > 0 && lap.avgHr > 0);
  const durationSec = usable.reduce((sum, lap) => sum + lap.durationSec, 0);
  if (durationSec < 10_800) return null;

  const midpoint = durationSec / 2;
  let cursor = 0;
  const firstHalf: Array<{ power: number; hr: number; durationSec: number }> = [];
  const secondHalf: Array<{ power: number; hr: number; durationSec: number }> = [];
  for (const lap of usable) {
    const lapStart = cursor;
    const lapEnd = cursor + lap.durationSec;
    const target = (lapStart + lapEnd) / 2 <= midpoint ? firstHalf : secondHalf;
    target.push({ power: lap.avgPowerW, hr: lap.avgHr, durationSec: lap.durationSec });
    cursor = lapEnd;
  }

  const firstHalfPowerW = weightedAverage(firstHalf.map(row => ({ value: row.power, durationSec: row.durationSec })));
  const secondHalfPowerW = weightedAverage(secondHalf.map(row => ({ value: row.power, durationSec: row.durationSec })));
  const firstHalfHr = weightedAverage(firstHalf.map(row => ({ value: row.hr, durationSec: row.durationSec })));
  const secondHalfHr = weightedAverage(secondHalf.map(row => ({ value: row.hr, durationSec: row.durationSec })));
  if (firstHalfPowerW == null || secondHalfPowerW == null || firstHalfHr == null || secondHalfHr == null) return null;

  return deriveDurabilitySignal({
    durationSec,
    firstHalfPowerW,
    secondHalfPowerW,
    firstHalfHr,
    secondHalfHr,
  });
}

export function deriveDurabilityFromStreams(input: {
  durationSec: number;
  powerStream: readonly number[];
  hrStream: readonly number[] | null;
}): DurabilitySignal | null {
  if (input.durationSec < 10_800 || input.powerStream.length < 2 || !input.hrStream?.length) return null;
  const samples = Math.min(input.powerStream.length, input.hrStream.length);
  const midpoint = Math.floor(samples / 2);
  if (midpoint <= 0) return null;
  const firstPower = input.powerStream.slice(0, midpoint).filter(value => value > 0 && value < 1800);
  const secondPower = input.powerStream.slice(midpoint, samples).filter(value => value > 0 && value < 1800);
  const firstHr = input.hrStream.slice(0, midpoint).filter(value => value > 0);
  const secondHr = input.hrStream.slice(midpoint, samples).filter(value => value > 0);
  if (!firstPower.length || !secondPower.length || !firstHr.length || !secondHr.length) return null;
  const avg = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return deriveDurabilitySignal({
    durationSec: input.durationSec,
    firstHalfPowerW: avg(firstPower),
    secondHalfPowerW: avg(secondPower),
    firstHalfHr: avg(firstHr),
    secondHalfHr: avg(secondHr),
  });
}
