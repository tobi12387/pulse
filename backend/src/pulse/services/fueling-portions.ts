export interface CarbPortionEquivalentInput {
  durationMin: number;
  minCarbsPerHour: number;
  maxCarbsPerHour: number;
  gelCarbsG?: number;
}

export interface CarbPortionEquivalent {
  totalMinG: number;
  totalMaxG: number;
  gelMin: number;
  gelMax: number;
  text: string;
}

export interface SodiumBottleEquivalentInput {
  minSodiumMgPerL: number;
  maxSodiumMgPerL: number;
}

export interface SodiumBottleEquivalent {
  bottle500MinMg: number;
  bottle500MaxMg: number;
  bottle750MinMg: number;
  bottle750MaxMg: number;
  text: string;
}

function rounded(value: number): number {
  return Math.round(value);
}

export function buildCarbPortionEquivalent(input: CarbPortionEquivalentInput): CarbPortionEquivalent {
  const gelCarbsG = input.gelCarbsG ?? 25;
  const hours = Math.max(0, input.durationMin) / 60;
  const totalMinG = rounded(input.minCarbsPerHour * hours);
  const totalMaxG = rounded(input.maxCarbsPerHour * hours);
  const gelMin = Math.max(1, rounded(totalMinG / gelCarbsG));
  const gelMax = Math.max(gelMin, rounded(totalMaxG / gelCarbsG));

  return {
    totalMinG,
    totalMaxG,
    gelMin,
    gelMax,
    text: `Für ${input.durationMin} min: ${totalMinG}-${totalMaxG} g gesamt, grob ${gelMin}-${gelMax} Gel-Äquivalente à ${gelCarbsG} g.`,
  };
}

export function buildSodiumBottleEquivalent(input: SodiumBottleEquivalentInput): SodiumBottleEquivalent {
  const bottle500MinMg = rounded(input.minSodiumMgPerL * 0.5);
  const bottle500MaxMg = rounded(input.maxSodiumMgPerL * 0.5);
  const bottle750MinMg = rounded(input.minSodiumMgPerL * 0.75);
  const bottle750MaxMg = rounded(input.maxSodiumMgPerL * 0.75);

  return {
    bottle500MinMg,
    bottle500MaxMg,
    bottle750MinMg,
    bottle750MaxMg,
    text: `entspricht grob ${bottle500MinMg}-${bottle500MaxMg} mg pro 500 ml oder ${bottle750MinMg}-${bottle750MaxMg} mg pro 750 ml Flasche`,
  };
}
