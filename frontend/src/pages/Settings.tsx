import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  pulseKeys,
  useDataCoverage,
  useGarminCoverage,
  useGarminSync,
  usePushSettings,
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
import { getPushPermissionState, isPushSupported, type PushPermissionState } from '@/lib/push-client';
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

type SettingsDiagnosticAction = { label: string; path: string };
type SettingsDiagnosticRow = {
  key: string;
  label: string;
  value: string;
  color: string;
  detail: string;
  action: SettingsDiagnosticAction;
  secondaryAction?: SettingsDiagnosticAction;
  blocksReadiness: boolean;
  optionalSetup?: boolean;
};

const BACKFILL_LAST_STORAGE_KEY = 'pulse-garmin-backfill-last';
type SettingsSection = 'profile' | 'coach' | 'garmin' | 'equipment' | 'push' | 'device' | 'health';
const SETTINGS_SECTIONS = new Set<SettingsSection>(['profile', 'coach', 'garmin', 'equipment', 'push', 'device', 'health']);

function settingsSectionFromQuery(value: string | null): SettingsSection | null {
  if (value === 'connection') return 'garmin';
  if (value === 'pwa') return 'device';
  return value && SETTINGS_SECTIONS.has(value as SettingsSection) ? value as SettingsSection : null;
}

function browserDeviceStatus() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      origin: 'Browser',
      secure: false,
      standalone: false,
      serviceWorker: false,
      localNetwork: false,
    };
  }

  return {
    origin: window.location.origin,
    secure: window.isSecureContext,
    standalone: window.matchMedia?.('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    serviceWorker: Boolean(navigator.serviceWorker && typeof navigator.serviceWorker.register === 'function'),
    localNetwork: /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(window.location.hostname),
  };
}

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
  const [searchParams] = useSearchParams();

  const {
    data: garminStatus,
    refetch,
    isLoading: garminStatusLoading,
    isError: garminStatusError,
  } = useQuery<GarminStatus>({
    queryKey: ['garmin-status'],
    queryFn: () => api.garmin.status() as Promise<GarminStatus>,
    refetchInterval: 30_000,
  });

  const qc = useQueryClient();
  const coverage30Query = useDataCoverage({ days: 30 });
  const garminCoverageQuery = useGarminCoverage(30);
  const { data: coverage30 } = coverage30Query;
  const { data: garminCoverage } = garminCoverageQuery;
  const garminSync = useGarminSync();
  const pushSettings = usePushSettings();
  const { data: pushPermission } = useQuery({
    queryKey: ['push-permission'],
    queryFn: getPushPermissionState,
    staleTime: 5_000,
  });
  const activeSection = settingsSectionFromQuery(searchParams.get('section'));

  useEffect(() => {
    if (!activeSection) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`settings-section-${activeSection}`)?.scrollIntoView({ block: 'start' });
    });
  }, [activeSection]);

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    try {
      await garminSync.mutateAsync();
      await refetch();
      setMessage({ text: 'Sync erfolgreich.', ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Sync fehlgeschlagen.', ok: false });
    } finally {
      setSyncing(false);
    }
  }

  function openGarminRepair(action: PulseGarminCoverageRepairAction) {
    if (action.type === 'calendar_sync') {
      void handleCalendarSync();
      return;
    }
    navigate(action.route);
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
    <div className="settings-layout">
      <PageHeader eyebrow="SETTINGS" title="Profil, Garmin & Geräte" mobileTitle="Settings" />

      <div className="settings-primary-grid">
        <SettingsDiagnosticsMatrix
          garminStatus={garminStatus ?? null}
          garminBlocked={garminCoverage?.domains.some(domain => domain.status === 'blocked') ?? false}
          garminPartial={garminCoverage?.domains.some(domain => domain.status !== 'fresh') ?? false}
          garminStatusLoading={garminStatusLoading}
          garminStatusUnknown={garminStatusError || garminStatus?.syncStatus == null}
          garminCoverageLoading={coverage30Query.isLoading || garminCoverageQuery.isLoading}
          garminCoverageUnknown={coverage30Query.isError || garminCoverageQuery.isError}
          garminCoverageDays={coverage30 ? `${coverage30.summary.dailyMetricsDays}/${coverage30.range.days}` : null}
          pushConfigured={pushSettings.data?.configured ?? false}
          pushPermission={pushPermission ?? null}
          pushSubscriptions={pushSettings.data?.subscriptions.filter(sub => sub.enabled).length ?? 0}
          onNavigate={path => navigate(path)}
        />

        <SettingsGroup
          sectionId="profile"
          active={activeSection === 'profile'}
          title="Profil"
          description="Trainingszonen, Wochenziel und Phase steuern Plan- und Coach-Kontext."
        >
          <AthleteProfileCard setMessage={setMessage} />
        </SettingsGroup>
      </div>

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

      <div className="settings-secondary-grid">
        <SettingsGroup
          sectionId="coach"
          active={activeSection === 'coach'}
          title="Coach"
          description="Explizite Präferenzen steuern Ton, Zeitfenster und Trainingsmuster ohne versteckte Annahmen."
        >
          <CoachPreferencesCard setMessage={setMessage} />
        </SettingsGroup>

        <SettingsGroup
          sectionId="garmin"
          active={activeSection === 'garmin'}
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
                    onClick={() => navigate('/data?tab=quality')}
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text-2)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      minWidth: 44,
                      minHeight: 44,
                      padding: '4px 8px',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    Abdeckung
                  </button>
                </Row>
                <Row label="Backfill-Regel">
                  <Val>31 Tage max.</Val>
                </Row>
                <Row label="Ausführung">
                  <button
                    type="button"
                    onClick={() => navigate('/plan?tab=execution')}
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text-2)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      minWidth: 44,
                      minHeight: 44,
                      padding: '4px 8px',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    Plan prüfen
                  </button>
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
                borderRadius: 'var(--radius)', minHeight: 44, padding: '10px',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--accent)',
                cursor: syncing ? 'default' : 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
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
                borderRadius: 'var(--radius)', minHeight: 44, padding: '10px',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--text-2)',
                cursor: syncingCalendar ? 'default' : 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
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
          sectionId="equipment"
          active={activeSection === 'equipment'}
          title="Datenpflege"
          description="Equipment, Abdeckung und Wartung bleiben bei wiederholten Alltagsaufgaben zusammen."
        >
          <EquipmentList setMessage={setMessage} />
        </SettingsGroup>

        <SettingsGroup
          sectionId="push"
          active={activeSection === 'push'}
          title="Benachrichtigungen"
          description="Push-Regeln betreffen Geräte und Erlaubnisse, nicht Garmin-Daten."
        >
          <PushNotificationsCard setMessage={setMessage} />
        </SettingsGroup>

        <SettingsGroup
          sectionId="device"
          active={activeSection === 'device'}
          title="iPhone & PWA"
          description="Lokaler Zugriff, HTTPS und Browser-Fähigkeiten für iPhone/VPN bleiben sichtbar."
        >
          <PwaDeviceCard />
        </SettingsGroup>

        <SettingsGroup
          sectionId="health"
          active={activeSection === 'health'}
          title="Health-State"
          description="Health-State setzt harte Trainingsgrenzen und ist bewusst separat."
        >
          <HealthStateCard />
        </SettingsGroup>
      </div>
    </div>
  );
}

function SettingsDiagnosticsMatrix({
  garminStatus,
  garminBlocked,
  garminPartial,
  garminStatusLoading,
  garminStatusUnknown,
  garminCoverageLoading,
  garminCoverageUnknown,
  garminCoverageDays,
  pushConfigured,
  pushPermission,
  pushSubscriptions,
  onNavigate,
}: {
  garminStatus: GarminStatus | null;
  garminBlocked: boolean;
  garminPartial: boolean;
  garminStatusLoading: boolean;
  garminStatusUnknown: boolean;
  garminCoverageLoading: boolean;
  garminCoverageUnknown: boolean;
  garminCoverageDays: string | null;
  pushConfigured: boolean;
  pushPermission: PushPermissionState | null;
  pushSubscriptions: number;
  onNavigate: (path: string) => void;
}) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const device = browserDeviceStatus();
  const pushSupported = isPushSupported();
  const pushLabel = !pushConfigured
    ? 'Server nicht bereit'
    : !pushSupported
      ? 'Browser nicht unterstützt'
      : pushPermission === 'denied'
        ? 'Browser blockiert'
        : pushSubscriptions > 0
          ? 'Aktiv'
          : pushPermission === 'granted'
            ? 'Bereit'
            : 'Erlaubnis offen';
  const pushColor = pushSubscriptions > 0
    ? 'var(--green)'
    : pushConfigured && pushSupported && pushPermission !== 'denied'
      ? 'var(--accent)'
      : 'var(--amber)';
  const garminLoading = garminStatusLoading || garminCoverageLoading;
  const garminUnknown = garminStatusUnknown || garminCoverageUnknown;
  const garminLabel = garminLoading
    ? 'Lädt'
    : garminBlocked
    ? 'Blockiert'
    : garminUnknown
      ? 'Unbekannt'
    : garminStatus?.syncStatus === 'stale'
      ? 'Veraltet'
      : garminPartial
        ? 'Teilweise'
        : garminStatus?.connected === false
          ? 'Nicht verbunden'
          : 'Bereit';
  const garminColor = garminBlocked
    ? 'var(--rose)'
    : garminLabel === 'Bereit'
      ? 'var(--green)'
      : 'var(--amber)';
  const certificateLabel = device.secure ? 'manuell prüfen' : 'nicht sicher';
  const pushOptionalSetup = pushSubscriptions === 0;
  const garminBlocksReadiness = !garminLoading && garminLabel !== 'Bereit';

  const rows: SettingsDiagnosticRow[] = [
    {
      key: 'access',
      label: 'Zugriff',
      value: device.localNetwork ? 'lokal/VPN' : 'extern',
      color: device.secure ? 'var(--green)' : 'var(--amber)',
      detail: device.secure
        ? `${device.origin} ist als sicherer Kontext erreichbar.`
        : `${device.origin} läuft nicht als sicherer Kontext.`,
      action: { label: 'Gerät öffnen', path: '/settings?section=device' },
      blocksReadiness: !device.secure,
    },
    {
      key: 'pwa',
      label: 'PWA',
      value: device.standalone ? 'Installiert' : 'Browser',
      color: device.standalone ? 'var(--green)' : 'var(--text-3)',
      detail: device.standalone ? 'Pulse läuft im Home-Screen-Modus.' : 'Aktuell als Browser-Tab geöffnet.',
      action: { label: 'Gerät öffnen', path: '/settings?section=device' },
      blocksReadiness: false,
    },
    {
      key: 'worker',
      label: 'Service Worker',
      value: device.serviceWorker ? 'Bereit' : 'Nicht verfügbar',
      color: device.serviceWorker ? 'var(--green)' : 'var(--amber)',
      detail: device.serviceWorker ? 'Offline-/PWA-Grundlage ist im Browser vorhanden.' : 'Dieser Browser meldet keine Service-Worker-Unterstützung.',
      action: { label: 'Gerät öffnen', path: '/settings?section=device' },
      blocksReadiness: !device.serviceWorker,
    },
    {
      key: 'push',
      label: 'Push',
      value: pushLabel,
      color: pushColor,
      detail: pushPermission === 'denied'
        ? 'Erlaubnis ist im Browser blockiert; ändere sie in den Browser-/iOS-Einstellungen.'
        : pushSubscriptions > 0
          ? `${pushSubscriptions} Gerät(e) aktiv.`
          : 'Aktivierung passiert bewusst pro Browser/Gerät.',
      action: { label: 'Push öffnen', path: '/settings?section=push' },
      blocksReadiness: false,
      optionalSetup: pushOptionalSetup,
    },
    {
      key: 'garmin',
      label: 'Garmin',
      value: garminLabel,
      color: garminColor,
      detail: garminLoading
        ? 'Garmin-Status und Abdeckung werden geladen.'
        : garminBlocked
        ? 'Garmin ist momentan begrenzt; prüfe Abdeckung und Backfill.'
        : garminUnknown
          ? 'Garmin-Status ist gerade nicht belastbar; prüfe die Verbindung oder lade erneut.'
        : garminCoverageDays
          ? `Tagesmetriken 30T: ${garminCoverageDays}.`
          : 'Garmin-Status wird geladen.',
      action: { label: 'Garmin öffnen', path: '/settings?section=garmin' },
      secondaryAction: { label: 'Abdeckung', path: '/data?tab=quality' },
      blocksReadiness: garminBlocksReadiness,
    },
    {
      key: 'cert',
      label: 'Zertifikat',
      value: certificateLabel,
      color: device.secure ? 'var(--amber)' : 'var(--rose)',
      detail: 'Pulse kann iOS-Zertifikatsvertrauen nicht automatisch erkennen; Safari zeigt Warnungen selbst.',
      action: { label: 'Gerät öffnen', path: '/settings?section=device' },
      blocksReadiness: !device.secure,
    },
  ];
  const readinessProblems = rows.filter(row => row.blocksReadiness);
  const optionalActions = rows.filter(row => row.optionalSetup);
  const summaryActions = readinessProblems.length > 0 ? readinessProblems.slice(0, 3) : optionalActions.slice(0, 1);
  const ready = readinessProblems.length === 0;
  const statusTitle = ready ? 'Alles bereit' : 'Problem beheben';
  const statusDetail = ready
    ? (optionalActions.length > 0
      ? 'Keine Blocker erkannt. Optional kannst du noch Geräte- oder Push-Schritte abschließen.'
      : 'Zugriff, Garmin, Push-Basis und Gerätefähigkeit sind aktuell nutzbar.')
    : `${readinessProblems.length} ${readinessProblems.length === 1 ? 'Punkt' : 'Punkte'} prüfen: ${readinessProblems.map(row => row.label).join(', ')}.`;
  const statusPill = ready ? 'BEREIT' : 'PRÜFEN';
  const statusColor = ready ? 'var(--green)' : 'var(--amber)';

  const shortcuts: Array<{ label: string; path: string }> = [
    { label: 'Gerät', path: '/settings?section=device' },
    { label: 'Push', path: '/settings?section=push' },
    { label: 'Garmin', path: '/settings?section=garmin' },
    { label: 'Profil', path: '/settings?section=profile' },
    { label: 'Health', path: '/settings?section=health' },
  ];

  return (
    <section
      className="card"
      data-testid="settings-diagnostics-matrix"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, borderColor: 'rgba(94,230,207,0.22)' }}
    >
      <div
        data-testid="settings-status-summary"
        style={{
          border: `1px solid ${ready ? 'rgba(74,222,128,0.28)' : 'rgba(245,158,11,0.34)'}`,
          borderRadius: 6,
          background: ready ? 'rgba(74,222,128,0.05)' : 'rgba(245,158,11,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '12px 13px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div>
            <div className="label-mono" style={{ color: ready ? 'var(--green)' : 'var(--amber)', marginBottom: 4 }}>
              SETTINGS STATUS
            </div>
            <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text)', fontWeight: 650 }}>
              {statusTitle}
            </h2>
          </div>
          <Pill color={statusColor}>{statusPill}</Pill>
        </div>
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
          {statusDetail}
        </p>
        {summaryActions.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
            {summaryActions.map(row => {
              if (row.optionalSetup) {
                return (
                  <div
                    key={row.key}
                    data-testid="settings-optional-summary-row"
                    style={{
                      borderTop: '1px solid var(--border)',
                      paddingTop: 8,
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                      gap: 8,
                      alignItems: 'center',
                      minWidth: 0,
                      gridColumn: '1 / -1',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, lineHeight: 1.3 }}>
                        {row.label}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.35 }}>
                        Optional pro Gerät aktivieren.
                      </div>
                    </div>
                    <Pill color={row.color}>{row.value}</Pill>
                    <button
                      type="button"
                      onClick={() => onNavigate(row.action.path)}
                      style={{
                        minWidth: 44,
                        minHeight: 44,
                        padding: '6px 9px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        color: 'var(--text-2)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        letterSpacing: 0,
                        textTransform: 'uppercase',
                      }}
                    >
                      {row.action.label}
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={row.key}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                    background: 'var(--surface)',
                    padding: '9px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{row.label}</span>
                    <Pill color={row.color}>{row.value}</Pill>
                  </div>
                  <p style={{ margin: 0, fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.45 }}>
                    {row.detail}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => onNavigate(row.action.path)}
                      style={{
                        minWidth: 44,
                        minHeight: 44,
                        padding: '6px 9px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        color: 'var(--text-2)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        letterSpacing: 0,
                        textTransform: 'uppercase',
                      }}
                    >
                      {row.action.label}
                    </button>
                    {row.secondaryAction && (
                      <button
                        type="button"
                        onClick={() => onNavigate(row.secondaryAction!.path)}
                        style={{
                          minWidth: 44,
                          minHeight: 44,
                          padding: '6px 9px',
                          background: 'transparent',
                          border: '1px solid rgba(94,230,207,0.3)',
                          borderRadius: 4,
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          letterSpacing: 0,
                          textTransform: 'uppercase',
                        }}
                      >
                        {row.secondaryAction.label}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div className="label-mono" style={{ color: 'var(--accent)', marginBottom: 4 }}>
            DIAGNOSE
          </div>
          <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>
            Zugriff, PWA, Push & Garmin
          </h2>
        </div>
        <button
          type="button"
          aria-expanded={diagnosticsOpen}
          onClick={() => setDiagnosticsOpen(open => !open)}
          style={{
            minWidth: 44,
            minHeight: 44,
            padding: '7px 10px',
            background: diagnosticsOpen ? 'rgba(94,230,207,0.12)' : 'var(--surface-2)',
            border: `1px solid ${diagnosticsOpen ? 'rgba(94,230,207,0.38)' : 'var(--border)'}`,
            borderRadius: 4,
            color: diagnosticsOpen ? 'var(--accent)' : 'var(--text-2)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: 0,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {diagnosticsOpen ? 'Diagnose ausblenden' : 'Diagnose anzeigen'}
        </button>
      </div>

      {diagnosticsOpen && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {shortcuts.map(shortcut => (
              <button
                key={shortcut.path}
                type="button"
                onClick={() => onNavigate(shortcut.path)}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  padding: '7px 10px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: 0,
                  textTransform: 'uppercase',
                }}
              >
                {shortcut.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
            {rows.map(row => (
              <div
                key={row.key}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '10px 11px',
                  background: 'var(--surface-2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 7,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{row.label}</span>
                  <Pill color={row.color}>{row.value}</Pill>
                </div>
                <p style={{ margin: 0, fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.45 }}>
                  {row.detail}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => onNavigate(row.action.path)}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      padding: '6px 9px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text-2)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      letterSpacing: 0,
                      textTransform: 'uppercase',
                    }}
                  >
                    {row.action.label}
                  </button>
                  {row.secondaryAction && (
                    <button
                      type="button"
                      onClick={() => onNavigate(row.secondaryAction!.path)}
                      style={{
                        minWidth: 44,
                        minHeight: 44,
                        padding: '6px 9px',
                        background: 'transparent',
                        border: '1px solid rgba(94,230,207,0.3)',
                        borderRadius: 4,
                        color: 'var(--accent)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        letterSpacing: 0,
                        textTransform: 'uppercase',
                      }}
                    >
                      {row.secondaryAction.label}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p style={{ margin: 0, fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Zertifikatvertrauen bleibt ein manueller iOS-/Browser-Schritt: Pulse zeigt den lokalen HTTPS-Kontext, aber nicht, ob Safari die lokale CA dauerhaft vertraut.
          </p>
        </>
      )}
    </section>
  );
}

function SettingsGroup({ sectionId, active = false, title, description, children }: {
  sectionId: SettingsSection;
  active?: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`settings-section-${sectionId}`}
      data-settings-section={sectionId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        scrollMarginTop: 88,
        outline: active ? '1px solid rgba(94,230,207,0.32)' : 'none',
        outlineOffset: 8,
        borderRadius: 6,
      }}
    >
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
