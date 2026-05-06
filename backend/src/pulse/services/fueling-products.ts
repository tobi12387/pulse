export interface FuelingProduct {
  id: string;
  name: string;
  carbsG: number;
  powderG?: number;
  servingVolumeMl?: number;
  sodiumMg?: number;
  proteinG?: number;
  bicarbonateG?: number;
  targetBottleVolumeMl?: number;
  targetBottleCarbsG?: number;
  maxBottleCarbsG?: number;
  maxBottlePowderG?: number;
}

export const TOBI_MNSTRY_PRODUCTS = {
  powerCarb: {
    id: 'mnstry-power-carb-sour-cherry-1-0-8',
    name: 'POWER CARB Sour Cherry 1:0.8',
    carbsG: 80.8,
    powderG: 85,
    servingVolumeMl: 500,
    sodiumMg: 320,
    targetBottleVolumeMl: 750,
    targetBottleCarbsG: 90,
    maxBottleCarbsG: 120,
    maxBottlePowderG: 126,
  },
  bicarbGel: {
    id: 'mnstry-bicarb-gel-40-lemon-1-0-8',
    name: 'BICARB GEL 40 Lemon 1:0.8',
    carbsG: 40,
    bicarbonateG: 5,
  },
  porridgeBar: {
    id: 'mnstry-porridge-bar-sour-cherry',
    name: 'PORRIDGE BAR Sour Cherry',
    carbsG: 46.9,
    sodiumMg: 200,
    proteinG: 3.9,
  },
  proteinBar: {
    id: 'mnstry-protein-bar-8-peanut-cranberry',
    name: 'PROTEIN BAR 8 Peanut & Cranberry',
    carbsG: 35,
    sodiumMg: 230,
    proteinG: 14,
  },
} as const satisfies Record<string, FuelingProduct>;

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLocaleLowerCase('de-DE')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function prefersTobiMnstryProducts(preferredProducts: string | null | undefined): boolean {
  const normalized = normalize(preferredProducts);
  if (!normalized.trim()) return false;
  return [
    'ministry',
    'mnstry',
    'power carb',
    'bicarb',
    'porridge',
    'protein bar',
    'sour cherry',
    'peanut',
  ].some(keyword => normalized.includes(keyword));
}

function formatGermanIntegerRange(min: number, max: number): string {
  return min === max ? `${min}` : `${min}-${max}`;
}

function formatGermanNumber(value: number): string {
  return Number.isInteger(value)
    ? `${value}`
    : value.toFixed(1).replace('.', ',');
}

function roundToNearest(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

function powderForCarbs(product: FuelingProduct, carbsG: number): number | null {
  if (!product.powderG || product.carbsG <= 0) return null;
  return roundToNearest(carbsG * (product.powderG / product.carbsG), 5);
}

export function buildMnstryPreWorkoutProductText(preferredProducts: string | null | undefined): string | null {
  if (!prefersTobiMnstryProducts(preferredProducts)) return null;
  const bar = TOBI_MNSTRY_PRODUCTS.porridgeBar;
  return `Ministry/MNSTRY ${bar.name} als optionaler Baustein: ${formatGermanNumber(bar.carbsG)} g Carbs pro Riegel, passend als Snack vor ruhigen oder langen Einheiten.`;
}

export function buildMnstryDuringCarbProductText(input: {
  preferredProducts: string | null | undefined;
  totalMinG: number;
  totalMaxG: number;
}): string | null {
  if (!prefersTobiMnstryProducts(input.preferredProducts)) return null;
  const mix = TOBI_MNSTRY_PRODUCTS.powerCarb;
  const bottleVolumeMl = mix.targetBottleVolumeMl ?? 750;
  const targetBottleCarbsG = mix.targetBottleCarbsG ?? 90;
  const bottleMin = Math.max(1, Math.ceil(input.totalMinG / targetBottleCarbsG));
  const bottleMax = Math.max(bottleMin, Math.ceil(input.totalMaxG / targetBottleCarbsG));
  const bottleRange = formatGermanIntegerRange(bottleMin, bottleMax);
  const powderPerBottleG = powderForCarbs(mix, targetBottleCarbsG);
  const powderMinG = powderForCarbs(mix, input.totalMinG);
  const powderMaxG = powderForCarbs(mix, input.totalMaxG);
  const sodiumPerBottleMg = powderPerBottleG && mix.powderG && mix.sodiumMg
    ? roundToNearest(mix.sodiumMg * (powderPerBottleG / mix.powderG), 10)
    : null;

  const powderText = powderPerBottleG && powderMinG && powderMaxG
    ? `je ca. ${powderPerBottleG} g Pulver (${targetBottleCarbsG} g Carbs), insgesamt ca. ${powderMinG}-${powderMaxG} g Pulver gesamt`
    : `je ca. ${targetBottleCarbsG} g Carbs`;
  const sodiumText = sodiumPerBottleMg
    ? `, ca. ${sodiumPerBottleMg} mg Natrium pro ${bottleVolumeMl} ml`
    : '';
  const maxText = mix.maxBottlePowderG && mix.maxBottleCarbsG
    ? `; maximale Hersteller-Dosierung fuer ${bottleVolumeMl} ml: ${mix.maxBottlePowderG} g Pulver fuer ca. ${mix.maxBottleCarbsG} g Carbs`
    : '';

  return `Ministry/MNSTRY ${mix.name} als Basis: ca. ${bottleRange} x ${bottleVolumeMl}-ml-Flaschen, ${powderText}${sodiumText}${maxText}; auf Trinkmenge und Verträglichkeit verteilen`;
}

export function buildMnstrySodiumProductText(preferredProducts: string | null | undefined): string | null {
  if (!prefersTobiMnstryProducts(preferredProducts)) return null;
  const mix = TOBI_MNSTRY_PRODUCTS.powerCarb;
  const bottleVolumeMl = mix.targetBottleVolumeMl ?? 750;
  const powderPerBottleG = mix.targetBottleCarbsG ? powderForCarbs(mix, mix.targetBottleCarbsG) : null;
  const sodiumPerBottleMg = powderPerBottleG && mix.powderG && mix.sodiumMg
    ? roundToNearest(mix.sodiumMg * (powderPerBottleG / mix.powderG), 10)
    : null;
  return sodiumPerBottleMg
    ? `${mix.name}: bei ca. ${powderPerBottleG} g Pulver in ${bottleVolumeMl} ml kommen etwa ${sodiumPerBottleMg} mg Natrium mit; bei Hitze separat anpassen.`
    : `${mix.name} liefert bereits Natrium mit; bei Hitze separat anpassen.`;
}

export function buildMnstryBicarbProductText(input: {
  preferredProducts: string | null | undefined;
  isRaceWeek: boolean;
  isHighIntensity: boolean;
}): string | null {
  if (!prefersTobiMnstryProducts(input.preferredProducts)) return null;
  if (!input.isRaceWeek && !input.isHighIntensity) return null;
  const gel = TOBI_MNSTRY_PRODUCTS.bicarbGel;
  return `${gel.name} nur race- oder intensitätsnah einsetzen, wenn getestet: ${gel.carbsG} g Carbs plus ${gel.bicarbonateG} g Bikarbonat pro Gel; Herstellerrahmen 1 bis maximal 3 Gele, nicht als Alltags-Gel zählen.`;
}

export function buildMnstryPostWorkoutProductText(preferredProducts: string | null | undefined): string | null {
  if (!prefersTobiMnstryProducts(preferredProducts)) return null;
  const bar = TOBI_MNSTRY_PRODUCTS.proteinBar;
  return `Ministry/MNSTRY ${bar.name} als pragmatischer Recovery-Baustein: ${bar.carbsG} g Carbs, ${bar.proteinG} g Protein und ${bar.sodiumMg} mg Natrium; danach normale Mahlzeit ergänzen.`;
}
