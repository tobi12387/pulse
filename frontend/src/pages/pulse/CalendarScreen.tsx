import { Card, CardContent } from '@/components/ui/card';

export default function CalendarScreen() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-foreground">Kalender</h1>
      <Card className="border-border">
        <CardContent className="px-4 py-6 text-center text-muted-foreground text-sm">
          Google Kalender-Sync wird in einer zukünftigen Version verfügbar sein.
        </CardContent>
      </Card>
    </div>
  );
}
