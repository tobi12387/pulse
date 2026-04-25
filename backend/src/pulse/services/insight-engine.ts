import { db } from '../../lib/db.js';
import { pulseInsightsCache } from '../../db/pulse-schema.js';
import { eq, and, gt } from 'drizzle-orm';
import { llmComplete, FAST_MODEL } from '../../lib/llm.js';

export function getRuleInsight(metricKey: string, value: number): string | null {
  switch (metricKey) {
    case 'hrv_rmssd':
      return value < 30
        ? `HRV ${value.toFixed(0)} ms ist niedrig. Dein Nervensystem braucht Erholung — kein intensives Training heute.`
        : value < 50
        ? `HRV ${value.toFixed(0)} ms ist moderat. Moderates Training ist ok, kein Highintensity.`
        : `HRV ${value.toFixed(0)} ms ist gut. Dein Nervensystem ist erholt und bereit.`;

    case 'sleep_hours':
      return value < 6
        ? `${value.toFixed(1)} Stunden Schlaf ist zu wenig. Priorisiere heute Erholung statt intensivem Training.`
        : value < 7.5
        ? `${value.toFixed(1)} Stunden Schlaf ist ok, aber etwas wenig für optimale Erholung. Versuche 7.5-9h zu schlafen.`
        : `${value.toFixed(1)} Stunden Schlaf — das ist ausgezeichnet! Optimale Erholung für das Training.`;

    case 'body_battery_max':
      return value < 30
        ? `Körperbatterie ${value}% — sehr erschöpft. Heute maximal leichtes Spazieren.`
        : value < 60
        ? `Körperbatterie ${value}% — moderat. Moderates Training möglich.`
        : `Körperbatterie ${value}% — gut geladen. Gute Voraussetzungen für Training.`;

    case 'steps':
      return value < 5000
        ? `${value.toLocaleString('de')} Schritte — wenig Alltagsbewegung heute. Bewegungspausen einbauen!`
        : value >= 10000
        ? `${value.toLocaleString('de')} Schritte — ausgezeichnet! Du bist sehr aktiv.`
        : `${value.toLocaleString('de')} Schritte — gute Alltagsaktivität.`;

    case 'resting_hr':
      return value > 65
        ? `Ruhepuls ${value} bpm — etwas erhöht. Mögliche Ursachen: Schlafmangel, Stress, beginnende Erkrankung.`
        : value <= 50
        ? `Ruhepuls ${value} bpm — ausgezeichnet. Zeigt gute kardiovaskuläre Fitness.`
        : `Ruhepuls ${value} bpm — im normalen Bereich für Ausdauersportler.`;

    default:
      return null;
  }
}

export async function getInsight(userId: string, metricKey: string, value: number): Promise<string> {
  // Check 1h cache
  const [cached] = await db.select({ insight: pulseInsightsCache.insight })
    .from(pulseInsightsCache)
    .where(and(
      eq(pulseInsightsCache.userId, userId),
      eq(pulseInsightsCache.metricKey, metricKey),
      gt(pulseInsightsCache.expiresAt, new Date()),
    ))
    .limit(1);

  if (cached) return cached.insight;

  // Rule-based
  const ruleInsight = getRuleInsight(metricKey, value);
  const insight = ruleInsight ?? await llmComplete(
    'Du bist Sportwissenschaftler. Erkläre kurz (max 80 Wörter) was dieser Messwert für einen Ausdauersportler bedeutet. Antworte auf Deutsch.',
    `Metrik: ${metricKey}, Wert: ${value}`,
    FAST_MODEL,
  );
  const source = ruleInsight ? 'rule' : 'llm';

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await db.insert(pulseInsightsCache).values({
    userId, metricKey, insight, expiresAt,
    source: source as 'rule' | 'llm',
  });

  return insight;
}
