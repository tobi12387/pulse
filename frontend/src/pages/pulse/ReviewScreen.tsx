import { usePulseReview, useGenerateReview } from '@/pulse/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ReviewScreen() {
  const { data, isLoading } = usePulseReview();
  const generate = useGenerateReview();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Wochenreview</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          {generate.isPending ? 'Erstelle…' : 'Neu erstellen'}
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm py-4 text-center">Lade…</p>}

      {!isLoading && !data && (
        <Card className="border-border">
          <CardContent className="px-4 py-6 text-center text-muted-foreground text-sm">
            Kein Wochenreview vorhanden. Klicke "Neu erstellen" um eine KI-Analyse der letzten Woche zu generieren.
          </CardContent>
        </Card>
      )}

      {data && (
        <Card className="border-border">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-foreground">
              {data.weekStart} – {data.weekEnd}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{data.narrative}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
