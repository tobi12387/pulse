import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface GarminStatus {
  connected: boolean;
  lastSync: string | null;
  syncStatus: 'ok' | 'stale' | 'never';
  errorMessage: string | null;
}

export default function Settings() {
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const { data: garminStatus, refetch } = useQuery<GarminStatus>({
    queryKey: ['garmin-status'],
    queryFn: () => api.garmin.status() as Promise<GarminStatus>,
    refetchInterval: 30_000,
  });

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    try {
      await api.garmin.sync();
      await refetch();
      setMessage({ text: 'Sync erfolgreich! Garmin-Daten aktualisiert.', type: 'success' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Sync fehlgeschlagen.', type: 'error' });
    } finally {
      setSyncing(false);
    }
  }

  function StatusBadge() {
    switch (garminStatus?.syncStatus) {
      case 'ok':
        return <Badge className="bg-green-700 text-white border-0">Aktuell</Badge>;
      case 'stale':
        return <Badge className="bg-yellow-600 text-white border-0">Veraltet</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Noch kein Sync</Badge>;
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Einstellungen</h1>

      {message && (
        <div className={`p-3 rounded-lg border text-sm ${
          message.type === 'success'
            ? 'border-green-700 text-green-400 bg-green-900/20'
            : 'border-destructive text-destructive bg-destructive/10'
        }`}>
          {message.text}
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">Garmin Connect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Verbindung</span>
            <Badge className="bg-green-700 text-white border-0">Verbunden</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Datenstatus</span>
            <StatusBadge />
          </div>
          {garminStatus?.lastSync && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Letzter Sync</span>
              <span className="text-sm text-foreground">
                {new Date(garminStatus.lastSync).toLocaleString('de-DE')}
              </span>
            </div>
          )}
          <Button
            onClick={handleSync}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
            disabled={syncing}
          >
            {syncing ? 'Synchronisiere...' : 'Jetzt syncen'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
