import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  pulseKeys,
  useDataCoverage,
  useGarminCoverage,
} from '@/pulse/hooks';
import { pulseApi } from '@/pulse/api-client';
import { api } from '@/api/client';
import { EquipmentList } from '@/components/EquipmentList';
import { GarminQualityList, GarminQualityPill } from '@/components/GarminQualityList';
import { PageHeader } from '@/components/PulseChrome';
import { CoachPreferencesCard } from '@/features/settings/coach/coach-components';
import { HealthStateCard } from '@/features/settings/health/health-components';
import { AthleteProfileCard } from '@/features/settings/profile/profile-components';
import { PushNotificationsCard, PwaDeviceCard } from '@/features/settings/push/push-components';
import type { PulseGarminCoverageRepairAction } from '@coaching-os/shared/pulse';

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
  const [syncingCalendar, setSyncingCalendar] = useState(false);

  const { data: garminStatus, refetch } = useQuery<GarminStatus>({
    queryKey: ['garmin-status'],
    queryFn: () => api.garmin.status() as Promise<GarminStatus>,
    refetchInterval: 30_000,
  });

  const qc = useQueryClient();
  const { data: coverage30 } = useDataCoverage({ days: 30 });
  const { data: garminCoverage } = useGarminCoverage(30);

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    try {
      await api.garmin.sync();
      await refetch();
      await qc.invalidateQueries({ queryKey: ['pulse', 'garmin-coverage'] });
      setMessage({ text: 'Sync erfolgreich.', ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Sync fehlgeschlagen.', ok: false });
    } finally {
      setSyncing(false);
    }
  }

  function openGarminRepair(action: PulseGarminCoverageRepairAction) {
    navigate(action.route.startsWith('/data') ? '/data' : action.route);
  }

  async function handleCalendarSync() {
    setSyncingCalendar(true);
    setMessage(null);
    try {
      const res = await pulseApi.garmin.calendarSync();
      await qc.invalidateQueries({ queryKey: pulseKeys.plan });
      const parts = [];
      if (res.uploaded > 0) parts.push(`${res.uploaded} hochgeladen`);
      if ((res.repaired ?? 0) > 0) parts.push(`${res.repaired} repariert`);
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
        <AthleteProfileCard setMessage={setMessage} />
      </SettingsGroup>

      <SettingsGroup
        title="Coach"
        description="Explizite Präferenzen steuern Ton, Zeitfenster und Trainingsmuster ohne versteckte Annahmen."
      >
        <CoachPreferencesCard setMessage={setMessage} />
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
          {garminCoverage && (
            <>
              <Row label="Domainqualität">
                <GarminQualityPill status={garminCoverage.domains.some(domain => domain.status === 'blocked')
                  ? 'blocked'
                  : garminCoverage.domains.some(domain => domain.status !== 'fresh')
                    ? 'partial'
                    : 'fresh'}
                />
              </Row>
              <GarminQualityList
                domains={garminCoverage.domains}
                showActions
                onRepairAction={openGarminRepair}
              />
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
        title="iPhone & PWA"
        description="Lokaler Zugriff, HTTPS und Browser-Fähigkeiten für iPhone/VPN bleiben sichtbar."
      >
        <PwaDeviceCard />
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
