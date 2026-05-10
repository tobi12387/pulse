export const ACTIVITY_LABEL: Record<string, string> = {
  run: 'Laufen',
  bike: 'Radfahren',
  swim: 'Schwimmen',
  strength: 'Kraft',
  hike: 'Wandern',
  other: 'Sonstiges',
};

export function activityLabel(activityType: string | null | undefined): string {
  if (!activityType) return 'Training';
  return ACTIVITY_LABEL[activityType] ?? activityType;
}
