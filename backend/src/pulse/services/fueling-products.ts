export interface FuelingProduct {
  id: string;
  name: string;
  carbsG: number;
  sodiumMg?: number;
  proteinG?: number;
  bicarbonateG?: number;
}

export const TOBI_MNSTRY_PRODUCTS = {
  powerCarb: {
    id: 'mnstry-power-carb-sour-cherry-1-0-8',
    name: 'POWER CARB Sour Cherry 1:0.8',
    carbsG: 80,
    sodiumMg: 320,
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

function roundToHalf(value: number): number {
  return Math.ceil(value * 2) / 2;
}

function formatGermanNumber(value: number): string {
  return Number.isInteger(value)
    ? `${value}`
    : value.toFixed(1).replace('.', ',');
}

function formatBottleRange(totalMinG: number, totalMaxG: number, carbsPerBottleG: number): string {
  const minBottles = Math.max(0.5, roundToHalf(totalMinG / carbsPerBottleG));
  const maxBottles = Math.max(minBottles, roundToHalf(totalMaxG / carbsPerBottleG));
  return `${formatGermanNumber(minBottles)}-${formatGermanNumber(maxBottles)}`;
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
  const bottleRange = formatBottleRange(input.totalMinG, input.totalMaxG, mix.carbsG);
  return `Ministry/MNSTRY ${mix.name} als Basis: ca. ${bottleRange} hoch dosierte 500-ml-Flaschen-Äquivalente (${mix.carbsG} g Carbs, ${mix.sodiumMg} mg Natrium je Flasche), auf Trinkmenge und Verträglichkeit verteilen`;
}

export function buildMnstrySodiumProductText(preferredProducts: string | null | undefined): string | null {
  if (!prefersTobiMnstryProducts(preferredProducts)) return null;
  const mix = TOBI_MNSTRY_PRODUCTS.powerCarb;
  return `${mix.name} liegt bei hoher Dosierung mit ${mix.sodiumMg} mg Natrium pro 500 ml schon in der konservativen Sodium-Range; bei Hitze separat anpassen.`;
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
