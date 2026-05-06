import { describe, expect, it } from 'vitest';
import {
  buildCarbPortionEquivalent,
  buildSodiumBottleEquivalent,
} from './fueling-portions.js';

describe('fueling portion equivalents', () => {
  it('turns carb per hour ranges into total carbs and gel equivalents', () => {
    expect(buildCarbPortionEquivalent({
      durationMin: 180,
      minCarbsPerHour: 60,
      maxCarbsPerHour: 90,
    })).toEqual({
      totalMinG: 180,
      totalMaxG: 270,
      gelMin: 7,
      gelMax: 11,
      text: 'Für 180 min: 180-270 g gesamt, grob 7-11 Gel-Äquivalente à 25 g.',
    });
  });

  it('turns sodium per liter ranges into bottle equivalents', () => {
    expect(buildSodiumBottleEquivalent({
      minSodiumMgPerL: 400,
      maxSodiumMgPerL: 800,
    })).toEqual({
      bottle500MinMg: 200,
      bottle500MaxMg: 400,
      bottle750MinMg: 300,
      bottle750MaxMg: 600,
      text: 'entspricht grob 200-400 mg pro 500 ml oder 300-600 mg pro 750 ml Flasche',
    });
  });
});
