import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePulseProfile, useUpdateProfile, pulseKeys } from '@/pulse/hooks';
import { pulseApi } from '@/pulse/api-client';
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
  const [syncingProfile, setSyncingProfile] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);

  const { data: garminStatus, refetch } = useQuery<GarminStatus>({
    queryKey: ['garmin-status'],
    queryFn: () => api.garmin.status() as Promise<GarminStatus>,
    refetchInterval: 30_000,
  });

  const qc = useQueryClient();
  const { data: profile } = usePulseProfile();
  const updateProfile = useUpdateProfile();

  const [profileForm, setProfileForm] = useState<{
    ftpWatts: string; maxHrBpm: string; weeklyHoursTarget: string; trainingPhase: string;
  } | null>(null);

  function openProfile() {
    setProfileForm({
      ftpWatts:          String(profile?.ftpWatts ?? ''),
      maxHrBpm:          String(profile?.maxHrBpm ?? ''),
      weeklyHoursTarget: String(profile?.weeklyHoursTarget ?? ''),
      trainingPhase:     profile?.trainingPhase ?? 'base',
    });
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profileForm) return;
    const data: Record<string, number | string> = {};
    if (profileForm.ftpWatts)          data.ftpWatts          = Number(profileForm.ftpWatts);
    if (profileForm.maxHrBpm)          data.maxHrBpm          = Number(profileForm.maxHrBpm);
    if (profileForm.weeklyHoursTarget) data.weeklyHoursTarget = Number(profileForm.weeklyHoursTarget);
    if (profileForm.trainingPhase)     data.trainingPhase     = profileForm.trainingPhase;
    await updateProfile.mutateAsync(data);
    setProfileForm(null);
    setMessage({ text: 'Profil gespeichert.', ok: true });
  }

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

  async function handleSyncProfile() {
    setSyncingProfile(true);
    setMessage(null);
    try {
      const res = await pulseApi.garmin.syncProfile();
      const { vo2max, maxHrBpm, lactateThresholdHr, ftpWatts } = res.synced;
      await qc.invalidateQueries({ queryKey: pulseKeys.profile });
      const parts = [];
      if (ftpWatts != null)           parts.push(`FTP ${ftpWatts} W`);
      if (vo2max != null)             parts.push(`VO2max ${vo2max}`);
      if (maxHrBpm != null)           parts.push(`MaxHR ${maxHrBpm} bpm`);
      if (lactateThresholdHr != null) parts.push(`Schwellen-HR ${lactateThresholdHr} bpm`);
      setMessage({ text: `Garmin Profil geladen: ${parts.join(', ') || 'keine neuen Werte'}.`, ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Profil-Sync fehlgeschlagen.', ok: false });
    } finally {
      setSyncingProfile(false);
    }
  }

  async function handleCalendarSync() {
    setSyncingCalendar(true);
    setMessage(null);
    try {
      const res = await pulseApi.garmin.calendarSync();
      await qc.invalidateQueries({ queryKey: pulseKeys.plan });
      const parts = [];
      if (res.uploaded > 0) parts.push(`${res.uploaded} hochgeladen`);
      if (res.removed > 0) parts.push(`${res.removed} entfernt`);
      setMessage({ text: `Garmin Kalender synchronisiert: ${parts.join(', ') || 'keine Änderungen'}.`, ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Kalender-Sync fehlgeschlagen.', ok: false });
    } finally {
      setSyncingCalendar(false);
    }
  }

  const status = garminStatus?.syncStatus ?? 'never';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>Settings</h1>

      {message && (
        <div className="card" style={{
          borderColor: message.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)',
          padding: '10px 14px',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: message.ok ? 'var(--green)' : 'var(--rose)',
          }}>
            {message.text}
          </span>
        </div>
      )}

      {/* Athletenprofil */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span className="label-mono">Athletenprofil</span>
          {!profileForm && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleSyncProfile}
                disabled={syncingProfile}
                style={{
                  background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
                  padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: 9,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: syncingProfile ? 'var(--text-3)' : 'var(--accent)', cursor: syncingProfile ? 'default' : 'pointer',
                }}
              >
                {syncingProfile ? '…' : 'Von Garmin'}
              </button>
              <button
                onClick={openProfile}
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: 9,
                  letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)', cursor: 'pointer',
                }}
              >
                Bearbeiten
              </button>
            </div>
          )}
        </div>

        {profileForm ? (
          <form onSubmit={(e) => void handleProfileSave(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
              FTP, Max-HR + VO2max werden automatisch von Garmin geladen.
            </p>
            {([
              ['FTP (Watt)', 'ftpWatts', 'number'],
              ['Max. Puls (bpm)', 'maxHrBpm', 'number'],
              ['Wochenstunden', 'weeklyHoursTarget', 'number'],
            ] as [string, keyof typeof profileForm, string][]).map(([label, key, type]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>{label}</span>
                <input
                  type={type}
                  value={profileForm[key]}
                  onChange={e => setProfileForm(f => f ? { ...f, [key]: e.target.value } : f)}
                  style={{
                    width: 80, background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '5px 8px',
                    fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)',
                    outline: 'none', textAlign: 'right',
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Trainingsphase</span>
              <select
                value={profileForm.trainingPhase}
                onChange={e => setProfileForm(f => f ? { ...f, trainingPhase: e.target.value } : f)}
                style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '5px 8px',
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)',
                  outline: 'none',
                }}
              >
                <option value="base">Base</option>
                <option value="build">Build</option>
                <option value="peak">Peak</option>
                <option value="taper">Taper</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="submit"
                disabled={updateProfile.isPending}
                style={{
                  flex: 1, background: 'var(--surface-2)', border: '1px solid var(--accent)',
                  borderRadius: 'var(--radius)', padding: '8px',
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: 'var(--accent)', cursor: 'pointer',
                }}
              >
                {updateProfile.isPending ? 'Speichern…' : 'Speichern'}
              </button>
              <button
                type="button"
                onClick={() => setProfileForm(null)}
                style={{
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '8px 14px',
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: 'var(--text-3)', cursor: 'pointer',
                }}
              >
                Abbrechen
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="FTP">
              <Val>{profile?.ftpWatts ? `${profile.ftpWatts} W` : '–'}</Val>
            </Row>
            <Row label="Max. Puls">
              <Val>{profile?.maxHrBpm ? `${profile.maxHrBpm} bpm` : '–'}</Val>
            </Row>
            <Row label="Wochenstunden">
              <Val>{profile?.weeklyHoursTarget ? `${profile.weeklyHoursTarget} h` : '–'}</Val>
            </Row>
            <Row label="Phase">
              <Pill color="var(--accent)">{(profile?.trainingPhase ?? 'base').toUpperCase()}</Pill>
            </Row>
          </div>
        )}
      </div>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              width: '100%',
              background: 'var(--surface-2)', border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)', padding: '10px',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'var(--accent)',
              cursor: syncing ? 'default' : 'pointer',
            }}
          >
            {syncing ? '● Synchronisiere…' : 'Jetzt syncen'}
          </button>
          <button
            onClick={handleCalendarSync}
            disabled={syncingCalendar}
            style={{
              width: '100%',
              background: 'var(--surface-2)', border: '1px solid var(--text-3)',
              borderRadius: 'var(--radius)', padding: '10px',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'var(--text-2)',
              cursor: syncingCalendar ? 'default' : 'pointer',
            }}
          >
            {syncingCalendar ? '● Kalender sync…' : 'Kalender bereinigen'}
          </button>
        </div>
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

function Val({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>{children}</span>
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
