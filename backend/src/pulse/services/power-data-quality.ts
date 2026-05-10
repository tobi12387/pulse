export type PowerDataQualitySource = 'stream' | 'lap_approximation' | 'unavailable';
export type PowerDataQualityStatus = 'trusted' | 'usable_with_caution' | 'blocked';

export interface PowerDataQualityResult {
  source: PowerDataQualitySource;
  status: PowerDataQualityStatus;
  coveragePct: number;
  spikeCount: number;
  limitations: string[];
}

export function classifyPowerDataQuality(input: {
  durationSec: number;
  sampleRateHz: number | null;
  powerStream: readonly number[] | null;
  laps: Array<{ durationSec?: number | null; avgPowerW?: number | null }>;
}): PowerDataQualityResult {
  const duration = Math.max(1, input.durationSec);
  const expectedSamples = Math.max(1, Math.round(duration * (input.sampleRateHz ?? 1)));
  const stream = input.powerStream?.filter(value => Number.isFinite(value)) ?? [];
  const positive = stream.filter(value => value > 0 && value < 1800);
  const spikeCount = stream.filter(value => value >= 1800 || value < 0).length;
  const coveragePct = input.powerStream
    ? Math.round((positive.length / expectedSamples) * 1000) / 10
    : 0;
  const limitations: string[] = [];

  if (input.powerStream && coveragePct >= 85 && spikeCount <= 3) {
    return { source: 'stream', status: 'trusted', coveragePct, spikeCount, limitations };
  }

  if (input.powerStream) {
    limitations.push(`Coverage ${coveragePct}% oder ${spikeCount} Power-Spike(s) reichen nicht fuer Modellclaims.`);
    return { source: 'stream', status: 'blocked', coveragePct, spikeCount, limitations };
  }

  const powerLaps = input.laps.filter(lap => (lap.durationSec ?? 0) >= 60 && (lap.avgPowerW ?? 0) > 0);
  if (powerLaps.length >= 2) {
    limitations.push('Keine 1Hz-Power-Streams im Pulse-Datensatz.');
    limitations.push('Best efforts und Durability nur als Lap-Approximation verwenden.');
    return { source: 'lap_approximation', status: 'usable_with_caution', coveragePct: 0, spikeCount: 0, limitations };
  }

  limitations.push('Keine nutzbaren Power-Streams oder Power-Laps vorhanden.');
  return { source: 'unavailable', status: 'blocked', coveragePct: 0, spikeCount: 0, limitations };
}
