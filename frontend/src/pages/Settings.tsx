import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface GarminStatus {
  connected: boolean;
  lastSync: string | null;
  syncStatus: 'ok' | 'stale' | 'error' | 'never';
  errorMessage: string | null;
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const { data: garminStatus, refetch } = useQuery<GarminStatus>({
    queryKey: ['garmin-status'],
    queryFn: () => api.garmin.status() as Promise<GarminStatus>,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const garmin = searchParams.get('garmin');
    if (garmin === 'connected') {
      setMessage({ text: 'Garmin erfolgreich verbunden!', type: 'success' });
      setSearchParams(new URLSearchParams(), { replace: true });
    } else if (garmin === 'error') {
      setMessage({ text: 'Garmin-Verbindung fehlgeschlagen. Bitte erneut versuchen.', type: 'error' });
      setSearchParams(new URLSearchParams(), { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function handleConnect() {
    try {
      const { url } = await api.garmin.getConnectUrl();
      window.location.href = url;
    } catch {
      setMessage({ text: 'Verbindung konnte nicht gestartet werden.', type: 'error' });
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await api.garmin.sync();
      await refetch();
      setMessage({ text: 'Sync erfolgreich!', type: 'success' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Sync fehlgeschlagen.', type: 'error' });
    } finally {
      setSyncing(false);
    }
  }

  function StatusBadge() {
    switch (garminStatus?.syncStatus) {
      case 'ok':
        return <Badge className="bg-green-700 text-white border-0">Synced</Badge>;
      case 'stale':
        return <Badge className="bg-yellow-600 text-white border-0">Veraltet</Badge>;
      case 'error':
        return <Badge variant="destructive">Fehler</Badge>;
      default:
        return <Badge variant="outline">Nicht verbunden</Badge>;
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
            <span className="text-sm text-muted-foreground">Status</span>
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

          {garminStatus?.errorMessage && (
            <p className="text-xs text-destructive">{garminStatus.errorMessage}</p>
          )}

          <div className="flex gap-2 pt-1">
            {!garminStatus?.connected ? (
              <Button onClick={handleConnect} className="flex-1 bg-primary text-primary-foreground">
                Garmin verbinden
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSync}
                  variant="outline"
                  className="flex-1 border-border text-foreground hover:bg-card"
                  disabled={syncing}
                >
                  {syncing ? 'Syncing...' : 'Jetzt syncen'}
                </Button>
                <Button
                  onClick={handleConnect}
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Neu verbinden
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
