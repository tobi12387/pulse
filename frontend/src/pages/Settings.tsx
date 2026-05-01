import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  usePulseProfile, useUpdateProfile, pulseKeys,
  useHealthStates, useCreateHealthState, useResolveHealthState, useDeleteHealthState,
  usePushSettings, usePushSubscribe, usePushUnsubscribe, useUpdatePushTopics,
  useUpdatePushQuietHours, useSendTestPush, useDataCoverage,
} from '@/pulse/hooks';
import { pulseApi } from '@/pulse/api-client';
import { api } from '@/api/client';
import { getPushPermissionState, isPushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/push-client';
import { EquipmentList } from '@/components/EquipmentList';
import { MiniButton, PageHeader } from '@/components/PulseChrome';
import type { PushTopic } from '@coaching-os/shared/pulse';

interface GarminStatus {
  connected: boolean;
  lastSync: string | null;
  syncStatus: 'ok' | 'stale' | 'never';
  errorMessage: string | null;
}

interface GarminBackfillSnapshot {
  at: string;
  dryRun: boolean;
  from: string;
  to: string;
  planned: number;
  synced: number;
  skipped: number;
  failed: number;
}

const BACKFILL_LAST_STORAGE_KEY = 'pulse-garmin-backfill-last';

function loadLastBackfillSnapshot(): GarminBackfillSnapshot | null {
  try {
    const raw = localStorage.getItem(BACKFILL_LAST_STORAGE_KEY);
    return raw ? JSON.parse(raw) as GarminBackfillSnapshot : null;
  } catch {
    return null;
  }
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
  const navigate = useNavigate();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [lastBackfill] = useState<GarminBackfillSnapshot | null>(() => loadLastBackfillSnapshot());
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
  const { data: coverage30 } = useDataCoverage({ days: 30 });
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
      <PageHeader eyebrow="SETTINGS" title="Profil, Garmin & Geräte" />

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

      <SettingsGroup
        title="Profil"
        description="Trainingszonen, Wochenziel und Phase steuern Plan- und Coach-Kontext."
      >
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span className="label-mono">Athletenprofil</span>
          {!profileForm && (
            <div style={{ display: 'flex', gap: 6 }}>
              <MiniButton
                onClick={handleSyncProfile}
                disabled={syncingProfile}
                tone="accent"
              >
                {syncingProfile ? '…' : 'Von Garmin'}
              </MiniButton>
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
      </SettingsGroup>

      <SettingsGroup
        title="Verbindung"
        description="Kalender-Sync und Backfill sind getrennt von Profil- und Push-Aktionen."
      >
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
          {coverage30 && (
            <>
              <Row label="Metriken 30T">
                <Val>{coverage30.summary.dailyMetricsDays}/{coverage30.range.days}</Val>
              </Row>
              <Row label="Schlaf 30T">
                <Val>{coverage30.summary.sleepDays}/{coverage30.range.days}</Val>
              </Row>
              <Row label="Aktivität/Wetter">
                <Val>{coverage30.summary.activities} / {coverage30.summary.weatherActivities}</Val>
              </Row>
              <Row label="Profilstatus">
                <Pill color={coverage30.profile.missing.length === 0 ? 'var(--green)' : 'var(--amber)'}>
                  {coverage30.profile.missing.length === 0 ? 'VOLLSTÄNDIG' : `${coverage30.profile.missing.length} FEHLT`}
                </Pill>
              </Row>
              <Row label="Backfill">
                <button
                  type="button"
                  onClick={() => navigate('/data')}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--text-2)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    padding: '4px 8px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  Abdeckung
                </button>
              </Row>
              <Row label="Backfill-Regel">
                <Val>31 Tage max.</Val>
              </Row>
              <Row label="Letzter Backfill">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: lastBackfill ? 'var(--text-2)' : 'var(--text-3)', textAlign: 'right', overflowWrap: 'anywhere', minWidth: 0, maxWidth: '62%', lineHeight: 1.35 }}>
                  {lastBackfill
                    ? `${lastBackfill.dryRun ? 'Vorschau' : 'Sync'} ${lastBackfill.from}–${lastBackfill.to} · ${lastBackfill.synced}/${lastBackfill.planned}`
                    : 'Noch keiner'}
                </span>
              </Row>
            </>
          )}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Nachladen passiert in Data → Abdeckung. Die Vorschau bleibt read-only; ein echter Backfill schreibt Garmin-Daten in Pulse.
        </p>
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
            {syncingCalendar ? '● Kalender sync…' : 'Kalender synchronisieren'}
          </button>
          <p style={{ margin: 0, fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.45 }}>
            Lädt fehlende geplante Workouts zu Garmin und entfernt veraltete Pulse-Kalendereinträge.
          </p>
        </div>
      </div>
      </SettingsGroup>

      <SettingsGroup
        title="Datenpflege"
        description="Equipment, Abdeckung und Wartung bleiben bei wiederholten Alltagsaufgaben zusammen."
      >
        <EquipmentList setMessage={setMessage} />
      </SettingsGroup>

      <SettingsGroup
        title="Benachrichtigungen"
        description="Push-Regeln betreffen Geräte und Erlaubnisse, nicht Garmin-Daten."
      >
        <PushNotificationsCard setMessage={setMessage} />
      </SettingsGroup>

      <SettingsGroup
        title="Health-State"
        description="Health-State setzt harte Trainingsgrenzen und ist bewusst separat."
      >
        <HealthStateCard />
      </SettingsGroup>
    </div>
  );
}

function SettingsGroup({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <h2 style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          {title}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.45 }}>
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

function Val({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>{children}</span>
  );
}

const PUSH_TOPIC_LABELS: Record<PushTopic, { label: string; hint: string }> = {
  briefing: { label: 'Daily Briefing', hint: 'nach dem Morgen-Sync' },
  checkin_reminder: { label: 'Check-in Reminder', hint: 'abends' },
  risk_critical: { label: 'Risiko-Warnungen', hint: 'sofort' },
};

function isIosSafariWithoutStandalone(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIos && !isStandalone;
}

function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Browser';
  return (navigator.platform || 'Browser').slice(0, 64);
}

function maskPushEndpoint(endpoint: string): string {
  const host = endpoint.replace(/^https?:\/\//, '').split('/')[0] || 'Push-Endpunkt';
  return `${host} · Endpunkt gespeichert`;
}

function PushNotificationsCard({ setMessage }: {
  setMessage: (message: { text: string; ok: boolean } | null) => void;
}) {
  const settings = usePushSettings();
  const subscribe = usePushSubscribe();
  const unsubscribe = usePushUnsubscribe();
  const updateTopics = useUpdatePushTopics();
  const updateQuietHours = useUpdatePushQuietHours();
  const sendTest = useSendTestPush();
  const { data: permission, refetch: refetchPermission } = useQuery({
    queryKey: ['push-permission'],
    queryFn: getPushPermissionState,
    staleTime: 5_000,
  });

  const supported = isPushSupported();
  const data = settings.data;
  const topics = data?.topics ?? { briefing: true, checkin_reminder: true, risk_critical: true };
  const activeSubscriptions = data?.subscriptions.filter(sub => sub.enabled) ?? [];
  const permissionState = supported ? permission ?? 'default' : 'unsupported';
  const pushSummary = (() => {
    if (!data?.configured) {
      return {
        label: 'Server nicht bereit',
        color: 'var(--amber)',
        detail: 'VAPID-Schlüssel fehlen auf dem Server; neue Geräte können keine Push-Abos anlegen.',
      };
    }
    if (!supported) {
      return {
        label: 'Browser nicht unterstützt',
        color: 'var(--amber)',
        detail: 'Dieser Browser kann keine Web-Push-Benachrichtigungen empfangen.',
      };
    }
    if (permissionState === 'denied') {
      return {
        label: 'Browser blockiert',
        color: 'var(--amber)',
        detail: 'Server ist bereit, aber dieser Browser erlaubt keine neuen Push-Abos. Bereits gespeicherte Geräte bleiben sichtbar.',
      };
    }
    if (activeSubscriptions.length > 0) {
      return {
        label: 'Aktiv',
        color: 'var(--green)',
        detail: 'Test sendet an alle aktiven registrierten Geräte.',
      };
    }
    if (permissionState === 'granted') {
      return {
        label: 'Bereit zur Aktivierung',
        color: 'var(--accent)',
        detail: 'Der Browser erlaubt Push; aktiviere dieses Gerät, um Briefings und Warnungen zu erhalten.',
      };
    }
    return {
      label: 'Erlaubnis fehlt',
      color: 'var(--text-3)',
      detail: 'Server ist bereit. Der Browser fragt beim Aktivieren nach der Push-Erlaubnis.',
    };
  })();

  async function handleEnable() {
    setMessage(null);
    try {
      if (!data?.publicKey) throw new Error('VAPID Public Key fehlt auf dem Server.');
      const subscription = await subscribeToPush(data.publicKey);
      await refetchPermission();
      if (!subscription) {
        setMessage({ text: 'Push-Berechtigung wurde nicht erteilt.', ok: false });
        return;
      }
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error('Browser lieferte keine vollständige Push-Subscription.');
      }
      await subscribe.mutateAsync({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        deviceLabel: deviceLabel(),
      });
      setMessage({ text: 'Push für dieses Gerät aktiviert.', ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Push-Aktivierung fehlgeschlagen.', ok: false });
    }
  }

  async function handleDisableCurrent() {
    setMessage(null);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await unsubscribe.mutateAsync(endpoint);
      setMessage({ text: endpoint ? 'Push für dieses Gerät deaktiviert.' : 'Keine lokale Push-Subscription gefunden.', ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Push-Deaktivierung fehlgeschlagen.', ok: false });
    }
  }

  async function handleRemoveDevice(endpoint: string) {
    setMessage(null);
    try {
      await unsubscribe.mutateAsync(endpoint);
      setMessage({ text: 'Gerät entfernt.', ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Gerät konnte nicht entfernt werden.', ok: false });
    }
  }

  async function handleTestPush() {
    setMessage(null);
    try {
      const res = await sendTest.mutateAsync();
      setMessage({ text: `Test-Push: ${res.result.sent} gesendet, ${res.result.skipped} übersprungen.`, ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Test-Push fehlgeschlagen.', ok: false });
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span className="label-mono">Benachrichtigungen</span>
        <Pill color={pushSummary.color}>
          {pushSummary.label.toUpperCase()}
        </Pill>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
        {pushSummary.detail}
      </p>

      {isIosSafariWithoutStandalone() && (
        <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--amber)', lineHeight: 1.5 }}>
          Auf iPhone musst du Pulse zuerst zum Home-Bildschirm hinzufügen, um Push zu erhalten.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          onClick={() => void handleEnable()}
          disabled={!supported || !data?.configured || permissionState === 'denied' || subscribe.isPending}
          style={{
            flex: 1, background: 'var(--surface-2)', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius)', padding: '9px',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: supported && data?.configured && permissionState !== 'denied' ? 'var(--accent)' : 'var(--text-3)',
            cursor: supported && data?.configured && permissionState !== 'denied' ? 'pointer' : 'default',
          }}
        >
          {subscribe.isPending ? 'Aktiviere…' : 'Push aktivieren'}
        </button>
        <button
          onClick={() => void handleTestPush()}
          disabled={!data?.configured || activeSubscriptions.length === 0 || sendTest.isPending}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: data?.configured && activeSubscriptions.length > 0 ? 'var(--text-2)' : 'var(--text-3)',
            cursor: data?.configured && activeSubscriptions.length > 0 ? 'pointer' : 'default',
          }}
        >
          Test
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        <Row label="Server">
          <Val>{data?.configured ? 'bereit' : 'nicht bereit'}</Val>
        </Row>
        <Row label="Browser">
          <Val>{permissionState}</Val>
        </Row>
        <Row label="Geräte">
          <Val>{activeSubscriptions.length} aktiv</Val>
        </Row>
        <Row label="Test">
          <Val>{data?.configured && activeSubscriptions.length > 0 ? 'möglich' : 'nicht möglich'}</Val>
        </Row>
        {(Object.keys(PUSH_TOPIC_LABELS) as PushTopic[]).map(topic => (
          <label key={topic} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{PUSH_TOPIC_LABELS[topic].label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{PUSH_TOPIC_LABELS[topic].hint}</span>
            </span>
            <input
              type="checkbox"
              checked={topics[topic]}
              disabled={updateTopics.isPending}
              onChange={e => updateTopics.mutate({ [topic]: e.target.checked })}
            />
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>Stille Zeiten</span>
        <input
          key={`quiet-start-${data?.quietHours.start ?? 'loading'}`}
          type="time"
          defaultValue={data?.quietHours.start ?? '22:00'}
          onBlur={e => data && updateQuietHours.mutate({ start: e.target.value, end: data.quietHours.end })}
          style={{ width: 92, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '5px 6px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>bis</span>
        <input
          key={`quiet-end-${data?.quietHours.end ?? 'loading'}`}
          type="time"
          defaultValue={data?.quietHours.end ?? '06:30'}
          onBlur={e => data && updateQuietHours.mutate({ start: data.quietHours.start, end: e.target.value })}
          style={{ width: 92, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '5px 6px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
          Geräte ({activeSubscriptions.length})
        </span>
        <button
          type="button"
          onClick={() => void handleDisableCurrent()}
          disabled={unsubscribe.isPending}
          style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          Dieses Gerät aus
        </button>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.45 }}>
        Dieses Gerät aus deaktiviert nur die lokale Browser-Subscription; das × entfernt ein gespeichertes Gerät vom Server.
      </p>

      {settings.isLoading ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>Lade Push-Status…</p>
      ) : activeSubscriptions.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>Noch kein Gerät registriert.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {activeSubscriptions.map(sub => (
            <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface-2)' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text)' }}>
                  {sub.deviceLabel ?? 'Browser'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {maskPushEndpoint(sub.endpoint)}
                </span>
              </span>
              <button
                onClick={() => void handleRemoveDevice(sub.endpoint)}
                disabled={unsubscribe.isPending}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthStateCard() {
  const { data } = useHealthStates();
  const create = useCreateHealthState();
  const resolve = useResolveHealthState();
  const remove = useDeleteHealthState();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{
    type: 'illness'|'injury'|'fatigue'|'travel';
    severity: 'mild'|'moderate'|'severe';
    bodyPart: string;
    notes: string;
    durationDays: number;
  }>({ type: 'illness', severity: 'mild', bodyPart: '', notes: '', durationDays: 3 });

  const active = data?.active ?? [];
  const recent = (data?.recent ?? []).filter(s => s.resolvedAt != null).slice(0, 5);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      type:         form.type,
      severity:     form.severity,
      durationDays: form.durationDays,
      ...(form.bodyPart ? { bodyPart: form.bodyPart } : {}),
      ...(form.notes    ? { notes:    form.notes }    : {}),
    });
    setAdding(false);
    setForm({ type: 'illness', severity: 'mild', bodyPart: '', notes: '', durationDays: 3 });
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span className="label-mono">Gesundheits-Status</span>
        {!adding && (
          <MiniButton
            onClick={() => setAdding(true)}
          >
            + Hinzufügen
          </MiniButton>
        )}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
        Aktive Status beeinflussen Plan, Risk Watch und Coach-Kontext. Erledigt beendet das Signal; Löschen entfernt es aus der aktiven Bewertung.
      </p>

      {adding && (
        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as typeof f.type }))}
              style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}
            >
              <option value="illness">Krankheit</option>
              <option value="injury">Verletzung</option>
              <option value="fatigue">Erschöpfung</option>
              <option value="travel">Reise</option>
            </select>
            <select
              value={form.severity}
              onChange={e => setForm(f => ({ ...f, severity: e.target.value as typeof f.severity }))}
              style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}
            >
              <option value="mild">Leicht</option>
              <option value="moderate">Mittel</option>
              <option value="severe">Schwer</option>
            </select>
          </div>
          {form.type === 'injury' && (
            <input
              placeholder="Körperregion (z.B. knee_left, achilles_right)"
              value={form.bodyPart}
              onChange={e => setForm(f => ({ ...f, bodyPart: e.target.value }))}
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}
            />
          )}
          <input
            placeholder="Notiz (optional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 8px', fontSize: 12, color: 'var(--text)' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Dauer (Tage)</span>
            <input
              type="number"
              min={1} max={60}
              value={form.durationDays}
              onChange={e => setForm(f => ({ ...f, durationDays: Number(e.target.value) }))}
              style={{ width: 70, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '5px 8px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', textAlign: 'right' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={create.isPending}
              style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '8px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', cursor: 'pointer' }}
            >
              {create.isPending ? '…' : 'Speichern'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 14px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', cursor: 'pointer' }}
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {active.length === 0 && !adding && (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Aktuell keine aktiven Status. Plan läuft normal.</p>
      )}

      {active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.map(s => (
            <div key={s.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
                <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em' }}>
                  {s.type.toUpperCase()} / {s.severity}{s.bodyPart ? ` · ${s.bodyPart}` : ''}
                </span>
                <span style={{ color: 'var(--text-3)', fontSize: 10 }}>
                  {s.startDate}{s.endDate ? ` → ${s.endDate}` : ''}
                  {s.notes ? ` · ${s.notes.slice(0, 50)}` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => resolve.mutate(s.id)}
                  disabled={resolve.isPending}
                  style={{ background: 'none', border: '1px solid var(--green)', borderRadius: 3, padding: '3px 8px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--green)', cursor: 'pointer' }}
                >
                  ERLEDIGT
                </button>
                <button
                  onClick={() => remove.mutate(s.id)}
                  disabled={remove.isPending}
                  style={{ background: 'none', border: '1px solid var(--text-3)', borderRadius: 3, padding: '3px 8px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-3)', cursor: 'pointer' }}
                >
                  LÖSCHEN
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
            ZULETZT ERLEDIGT ({recent.length})
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {recent.map(s => (
              <div key={s.id} style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {s.startDate}: {s.type}/{s.severity}{s.bodyPart ? ` (${s.bodyPart})` : ''}
              </div>
            ))}
          </div>
        </details>
      )}
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
