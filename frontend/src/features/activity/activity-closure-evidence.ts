import type { PulseFuelingOutcomeBaseline } from '@coaching-os/shared/pulse';
import type { NutritionLog, NutritionLogPatch } from '../../pulse/api-client';
import { fuelingTrendEvidenceLabel as sharedFuelingTrendEvidenceLabel } from '../../pulse/fueling-learning';

const POWER_CARB_ID = 'mnstry-power-carb-sour-cherry-1-0-8';

export const FUELING_PRODUCT_LABELS: Record<string, string> = {
  [POWER_CARB_ID]: 'POWER CARB',
  'mnstry-bicarb-gel-40-lemon-1-0-8': 'BICARB GEL',
  'mnstry-porridge-bar-sour-cherry': 'PORRIDGE BAR',
  'mnstry-protein-bar-8-peanut-cranberry': 'PROTEIN BAR 8',
  mars: 'Mars',
};

export const GI_COMFORT_LABELS: Record<NonNullable<NutritionLog['giComfort']>, string> = {
  ok: 'Magen ok',
  mild_issue: 'Magen leicht unruhig',
  issue: 'Magenprobleme',
};

export type FuelingEvidenceCompletion = {
  label: string;
  patch: NutritionLogPatch;
};

export type FuelingEvidenceQuality = {
  label: string;
  detail: string;
  items: string[];
  tone: 'green' | 'amber';
  giComfortCompletionLogId: string | null;
  giComfortCompletionDetail: string | null;
  detailCompletionLogId: string | null;
  detailCompletions: FuelingEvidenceCompletion[];
};

const hydrationMeasurementGuard = 'Sodium, Hitze und Schweißrate nur ergänzen, wenn du sie wirklich gemessen hast.';

function isLongFuelingActivity(activityType: string, durationMin: number): boolean {
  return ['bike', 'run', 'hike'].includes(activityType) && durationMin >= 75;
}

function hasFuelingCarbEvidence(log: NutritionLog): boolean {
  return log.carbsG != null;
}

export function fuelingTrendEvidenceLabel(baseline: PulseFuelingOutcomeBaseline | null): string {
  const learningReadiness = baseline?.learningReadiness ?? null;
  if (!learningReadiness) return 'Trend-Evidenz offen';
  return sharedFuelingTrendEvidenceLabel(baseline);
}

function parseGermanNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function fuelingLogText(log: NutritionLog): string {
  return [log.description, log.notes].filter((item): item is string => Boolean(item)).join(' ');
}

function inferBottles750Ml(log: NutritionLog): number | null {
  if (log.bottles750Ml != null || log.drinksMl == null || log.drinksMl <= 0) return null;
  const bottles = log.drinksMl / 750;
  return Number.isInteger(bottles) && bottles > 0 && bottles <= 40 ? bottles : null;
}

function inferPowerCarbPowderG(log: NutritionLog): number | null {
  if (log.powderG != null) return null;
  const text = fuelingLogText(log);
  const match = text.match(/(\d+(?:[,.]\d+)?)\s*g\s+power\s*carb\s+pulver/i)
    ?? text.match(/power\s*carb\s+(\d+(?:[,.]\d+)?)\s*g\s+pulver/i)
    ?? text.match(/(\d+(?:[,.]\d+)?)\s*g\s+power\s*carb/i);
  if (!match?.[1]) return null;
  const powderG = parseGermanNumber(match[1]);
  return powderG != null && powderG > 0 && powderG <= 3000 ? Math.round(powderG) : null;
}

function uniqueFuelingProducts(products: string[], productId: string): string[] {
  return products.includes(productId) ? products : [...products, productId];
}

function inferMarsProduct(log: NutritionLog): boolean {
  return !log.fuelingProducts.includes('mars') && /\bmars(?:riegel)?\b/i.test(fuelingLogText(log));
}

function fuelingEvidenceCompletions(log: NutritionLog): FuelingEvidenceCompletion[] {
  const completions: FuelingEvidenceCompletion[] = [];
  const bottles750Ml = inferBottles750Ml(log);
  if (bottles750Ml != null) {
    completions.push({
      label: `${bottles750Ml} x 750 ml übernehmen`,
      patch: { bottles750Ml },
    });
  }

  const powderG = inferPowerCarbPowderG(log);
  if (powderG != null) {
    completions.push({
      label: `${powderG} g Pulver übernehmen`,
      patch: {
        powderG,
        fuelingProducts: fuelingLogText(log).toLocaleLowerCase('de-DE').includes('power carb')
          ? uniqueFuelingProducts(log.fuelingProducts, POWER_CARB_ID)
          : undefined,
      },
    });
  }

  if (inferMarsProduct(log)) {
    completions.push({
      label: 'Mars übernehmen',
      patch: { fuelingProducts: uniqueFuelingProducts(log.fuelingProducts, 'mars') },
    });
  }

  return completions;
}

export function mergeFuelingEvidenceCompletionPatches(completions: FuelingEvidenceCompletion[]): NutritionLogPatch {
  return completions.reduce<NutritionLogPatch>((merged, completion) => {
    const { fuelingProducts, ...nextPatch } = completion.patch;
    const mergedPatch: NutritionLogPatch = { ...merged, ...nextPatch };
    if (fuelingProducts != null) {
      mergedPatch.fuelingProducts = Array.from(new Set([
        ...(merged.fuelingProducts ?? []),
        ...fuelingProducts,
      ]));
    }
    return mergedPatch;
  }, {});
}

function carbsEvidenceItem(log: NutritionLog, durationMin: number): string {
  if (!hasFuelingCarbEvidence(log)) return 'Carbs fehlen';
  const durationHours = durationMin / 60;
  const carbsPerHour = durationHours > 0 && log.carbsG != null
    ? Math.round(log.carbsG / durationHours)
    : null;
  return carbsPerHour != null ? `Carbs erfasst · ${carbsPerHour} g/h` : 'Carbs erfasst';
}

function hydrationEvidenceItems(log: NutritionLog, durationMin: number): string[] {
  const measured = log.sodiumMg != null || log.ambientTempC != null || log.sweatRateLPerHour != null;
  if (!measured) return ['Hydration-Kontext offen'];

  const items = ['Hydration-Kontext gemessen'];
  const durationHours = durationMin / 60;
  if (log.sodiumMg != null && durationHours > 0) {
    items.push(`Sodium ca. ${Math.round(log.sodiumMg / durationHours)} mg/h`);
  }
  if (log.ambientTempC != null) {
    items.push(`${Math.round(log.ambientTempC)}°C`);
  }
  if (log.sweatRateLPerHour != null) {
    items.push(`Schweißrate ${log.sweatRateLPerHour.toFixed(1)} l/h`);
  }
  return items;
}

function closureItems({
  latest,
  durationMin,
  feedbackCaptured,
  trendEvidence,
}: {
  latest: NutritionLog;
  durationMin: number;
  feedbackCaptured: boolean;
  trendEvidence: string;
}): string[] {
  return [
    feedbackCaptured ? 'RPE erfasst' : 'RPE fehlt',
    `Dauer ${Math.round(durationMin)} min`,
    carbsEvidenceItem(latest, durationMin),
    latest.giComfort != null ? 'GI-Komfort erfasst' : 'GI-Komfort fehlt',
    ...hydrationEvidenceItems(latest, durationMin),
    trendEvidence,
  ];
}

function giComfortCompletionDetail(trendEvidence: string): string {
  return `Wähle die echte Magenreaktion; nicht aus Notizen, Route, RPE, g/h oder Ergebnis ableiten. Danach kann dieser vorhandene Carb-Log in die Trend-Evidenz einfließen; aktuell ${trendEvidence}. Plan und Garmin bleiben unverändert.`;
}

export function buildFuelingEvidenceQuality({
  logs,
  activityType,
  durationMin,
  feedbackCaptured,
  trendEvidence,
}: {
  logs: NutritionLog[];
  activityType: string;
  durationMin: number;
  feedbackCaptured: boolean;
  trendEvidence: string;
}): FuelingEvidenceQuality | null {
  if (!isLongFuelingActivity(activityType, durationMin)) return null;

  const feedbackSuffix = feedbackCaptured
    ? ''
    : ' Feedback danach kurz erfassen, damit Belastung ebenfalls eingeordnet bleibt.';
  const duringLogs = logs.filter(log => log.context === 'during' || log.context == null);
  const latest = duringLogs[0] ?? null;
  if (!latest) {
    return {
      label: 'Fueling-Evidence zuerst schließen',
      detail: `Fueling-Evidence zuerst schließen: Für diese lange Einheit fehlt noch ein During-Log mit Dauer, Carbs und GI-Komfort.${feedbackSuffix}`,
      items: [
        feedbackCaptured ? 'RPE erfasst' : 'RPE fehlt',
        `Dauer ${Math.round(durationMin)} min`,
        'During-Log fehlt',
        'Carbs fehlen',
        'GI-Komfort fehlt',
        'Hydration-Kontext offen',
        trendEvidence,
      ],
      tone: 'amber',
      giComfortCompletionLogId: null,
      giComfortCompletionDetail: null,
      detailCompletionLogId: null,
      detailCompletions: [],
    };
  }

  const hasCarbs = hasFuelingCarbEvidence(latest);
  const hasGiComfort = latest.giComfort != null;
  const detailCompletions = fuelingEvidenceCompletions(latest);
  const hydrationGuard = hydrationEvidenceItems(latest, durationMin).includes('Hydration-Kontext offen')
    ? ` ${hydrationMeasurementGuard}`
    : '';
  if (!hasCarbs || !hasGiComfort) {
    return {
      label: 'Fueling-Evidence zuerst schließen',
      detail: `Fueling-Evidence zuerst schließen: Dieser lange Log zählt erst für Trends, wenn Dauer, Carbs und GI-Komfort zusammen vorliegen.${feedbackSuffix}${hydrationGuard}`,
      items: closureItems({ latest, durationMin, feedbackCaptured, trendEvidence }),
      tone: 'amber',
      giComfortCompletionLogId: hasCarbs && !hasGiComfort ? latest.id : null,
      giComfortCompletionDetail: hasCarbs && !hasGiComfort ? giComfortCompletionDetail(trendEvidence) : null,
      detailCompletionLogId: detailCompletions.length > 0 ? latest.id : null,
      detailCompletions,
    };
  }

  return {
    label: 'Lernevidenz vollständig',
    detail: `Fueling-Evidence geschlossen: Dieser During-Log hat Dauer, Carbs und GI-Komfort und kann in die Fueling-Baseline einfließen.${hydrationGuard}`,
    items: closureItems({ latest, durationMin, feedbackCaptured, trendEvidence }),
    tone: 'green',
    giComfortCompletionLogId: null,
    giComfortCompletionDetail: null,
    detailCompletionLogId: detailCompletions.length > 0 ? latest.id : null,
    detailCompletions,
  };
}
