import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

interface GarminStatus {
  connected: boolean;
  lastSync: string | null;
  syncStatus: 'ok' | 'stale' | 'never';
  errorMessage: string | null;
}

const SYNC_COLOR: Record<string, string> = {
  ok:    'var(--green)',
  stale: 'var(--amber)',
  never: 'var(--text-3)',
};

const SYNC_LABEL: Record<string, string> = {
  ok:    'AKTUELL',
  stale: 'VERALTET',
  never: 'KEIN SYNC',
};

export default function Settings() {
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
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
      setMessage({ text: 'Sync erfolgreich.', ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Sync fehlgeschlagen.', ok: false });
    } finally {
      setSyncing(false);
    }
  }

  const status = garminStatus?.syncStatus ?? 'never';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>Settings</h1>

      {message && (
        <div
          className="card"
          style={{
            borderColor: message.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)',
            padding: '10px 14px',
          }}
        >
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: message.ok ? 'var(--green)' : 'var(--rose)',
          }}>
            {message.text}
          </span>
        </div>
      )}

      {/* Garmin card */}
      <div className="card">
        <div className="label-mono" style={{ marginBottom: 14 }}>Garmin Connect</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row label="Verbindung">
            <Pill color="var(--green)">VERBUNDEN</Pill>
          </Row>
          <Row label="Datenstatus">
            <Pill color={SYNC_COLOR[status]}>{SYNC_LABEL[status]}</Pill>
          </Row>
          {garminStatus?.lastSync && (
            <Row label="Letzter Sync">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
                {new Date(garminStatus.lastSync).toLocaleString('de-DE')}
              </span>
            </Row>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            marginTop: 14, width: '100%',
            background: 'var(--surface-2)', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius)', padding: '10px',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--accent)',
            cursor: syncing ? 'default' : 'pointer',
          }}
        >
          {syncing ? '● Synchronisiere…' : 'Jetzt syncen'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</span>
      {children}
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
      border: `1px solid ${color}`, borderRadius: 3, padding: '2px 6px', color,
    }}>
      {children}
    </span>
  );
}
