import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  usePushSettings,
  usePushSubscribe,
  usePushUnsubscribe,
  useUpdatePushQuietHours,
  useUpdatePushTopics,
  useSendTestPush,
} from '@/pulse/hooks';
import { getPushPermissionState, isPushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/push-client';
import type { PushTopic } from '@coaching-os/shared/pulse';

const PUSH_TOPIC_LABELS: Record<PushTopic, { label: string; hint: string }> = {
  briefing: { label: 'Daily Briefing', hint: 'nach dem Morgen-Sync' },
  checkin_reminder: { label: 'Check-in Reminder', hint: 'abends' },
  risk_critical: { label: 'Risiko-Warnungen', hint: 'sofort' },
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

function Val({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>{children}</span>
  );
}

function Pill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      letterSpacing: '0.1em',
      border: `1px solid ${color}`,
      borderRadius: 3,
      padding: '2px 6px',
      color,
    }}>
      {children}
    </span>
  );
}

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

function pwaReadiness() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      origin: 'Browser',
      secure: false,
      standalone: false,
      serviceWorker: false,
      push: false,
      localNetwork: false,
    };
  }

  const serviceWorkerSupported = Boolean(navigator.serviceWorker && typeof navigator.serviceWorker.register === 'function');

  return {
    origin: window.location.origin,
    secure: window.isSecureContext,
    standalone: window.matchMedia?.('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    serviceWorker: serviceWorkerSupported,
    push: isPushSupported(),
    localNetwork: /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(window.location.hostname),
  };
}

export function PwaDeviceCard() {
  const status = pwaReadiness();

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span className="label-mono">Gerätezugriff</span>
        <Pill color={status.secure && status.serviceWorker ? 'var(--green)' : 'var(--amber)'}>
          {status.secure && status.serviceWorker ? 'BEREIT' : 'PRÜFEN'}
        </Pill>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Row label="Adresse">
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text)',
            textAlign: 'right',
            overflowWrap: 'anywhere',
            minWidth: 0,
          }}>
            {status.origin}
          </span>
        </Row>
        <Row label="HTTPS">
          <Pill color={status.secure ? 'var(--green)' : 'var(--amber)'}>
            {status.secure ? 'SICHER' : 'OFFEN'}
          </Pill>
        </Row>
        <Row label="PWA-Modus">
          <Val>{status.standalone ? 'installiert' : 'Browser'}</Val>
        </Row>
        <Row label="Service Worker">
          <Val>{status.serviceWorker ? 'unterstützt' : 'nicht verfügbar'}</Val>
        </Row>
        <Row label="Push">
          <Val>{status.push ? 'unterstützt' : 'nicht verfügbar'}</Val>
        </Row>
        <Row label="Netz">
          <Val>{status.localNetwork ? 'lokal/VPN' : 'extern'}</Val>
        </Row>
        <Row label="Zertifikat">
          <Val>{status.secure ? 'manuell prüfen' : 'nicht sicher'}</Val>
        </Row>
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.45 }}>
        Für iPhone per VPN bleibt der lokale Server die Quelle. Wenn Safari warnt, muss der verwendete Host zur lokalen HTTPS-Konfiguration passen; Pulse kann iOS-Zertifikatsvertrauen nicht automatisch erkennen.
      </p>
    </div>
  );
}

export function PushNotificationsCard({ setMessage }: {
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

  const device = pwaReadiness();
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
    if (!device.serviceWorker) {
      return {
        label: 'Service Worker fehlt',
        color: 'var(--amber)',
        detail: 'Der Browser meldet keine Service-Worker-Basis. Push kann hier nicht aktiviert werden.',
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
          disabled={!supported || !device.serviceWorker || !data?.configured || permissionState === 'denied' || subscribe.isPending}
          style={{
            flex: 1, background: 'var(--surface-2)', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius)', minHeight: 40, padding: '8px 12px',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: supported && device.serviceWorker && data?.configured && permissionState !== 'denied' ? 'var(--accent)' : 'var(--text-3)',
            cursor: supported && device.serviceWorker && data?.configured && permissionState !== 'denied' ? 'pointer' : 'default',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {subscribe.isPending ? 'Aktiviere…' : 'Push aktivieren'}
        </button>
        <button
          onClick={() => void handleTestPush()}
          disabled={!data?.configured || activeSubscriptions.length === 0 || sendTest.isPending}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            minHeight: 40, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: data?.configured && activeSubscriptions.length > 0 ? 'var(--text-2)' : 'var(--text-3)',
            cursor: data?.configured && activeSubscriptions.length > 0 ? 'pointer' : 'default',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          Test
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        <Row label="Server">
          <Val>{data?.configured ? 'bereit' : 'nicht bereit'}</Val>
        </Row>
        <Row label="Service Worker">
          <Val>{device.serviceWorker ? 'bereit' : 'nicht verfügbar'}</Val>
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
          <label key={topic} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 40 }}>
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
          style={{ width: 92, minHeight: 40, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>bis</span>
        <input
          key={`quiet-end-${data?.quietHours.end ?? 'loading'}`}
          type="time"
          defaultValue={data?.quietHours.end ?? '06:30'}
          onBlur={e => data && updateQuietHours.mutate({ start: data.quietHours.start, end: e.target.value })}
          style={{ width: 92, minHeight: 40, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}
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
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            minHeight: 40, padding: '7px 10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
            fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: unsubscribe.isPending ? 'default' : 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
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
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 3,
                  minWidth: 40, minHeight: 40, color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
                  fontSize: 11, cursor: unsubscribe.isPending ? 'default' : 'pointer', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
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
